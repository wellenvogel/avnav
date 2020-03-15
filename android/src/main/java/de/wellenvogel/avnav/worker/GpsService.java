package de.wellenvogel.avnav.worker;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.bluetooth.BluetoothDevice;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.location.*;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Binder;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.support.v4.app.NotificationCompat;
import android.util.Log;
import android.view.View;
import android.widget.RemoteViews;

import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.Dummy;
import de.wellenvogel.avnav.main.IMediaUpdater;
import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.settings.AudioEditTextPreference;
import de.wellenvogel.avnav.settings.NmeaSettingsFragment;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileNotFoundException;
import java.net.InetSocketAddress;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Created by andreas on 12.12.14.
 */
public class GpsService extends Service implements INmeaLogger, RouteHandler.UpdateReceiver {


    private static final String CHANNEL_ID = "main" ;
    private static final String CHANNEL_ID_NEW = "main_new" ;
    public static String PROP_TRACKDIR="track.dir";
    private static final long MAXLOCAGE=10000; //max age of location in milliseconds
    private static final long MAXLOCWAIT=2000; //max time we wait until we explicitely query the location again


    private Context ctx;

    private final IBinder mBinder = new GpsServiceBinder();
    private GpsDataProvider internalProvider=null;
    private IpPositionHandler externalProvider=null;
    private BluetoothPositionHandler bluetoothProvider=null;
    private UsbSerialPositionHandler usbProvider =null;

    private boolean isRunning;  //this is our view whether we are running or not
                                //running means that we are registered for updates and have our timer active

    //properties
    private File trackDir=null;

    private TrackWriter trackWriter;
    private RouteHandler routeHandler;
    private NmeaLogger nmeaLogger;
    private Handler handler = new Handler();
    private long timerSequence=1;
    private Runnable runnable;
    private IMediaUpdater mediaUpdater;
    private static final int NOTIFY_ID=Constants.LOCALNOTIFY;
    private Object loggerLock=new Object();
    private HashMap<String,Alarm> alarmStatus=new HashMap<String, Alarm>();
    private MediaPlayer mediaPlayer=null;
    private int mediaRepeatCount=0;
    private boolean gpsLostAlarmed=false;
    private boolean mobAlarm=false;
    private BroadcastReceiver broadCastReceiver;
    private BroadcastReceiver triggerReceiver; //trigger rescans...
    private boolean shouldStop=false;
    PendingIntent watchdogIntent=null;
    private static final String WATCHDOGACTION="restart";

    private PositionWriter positionWriter;
    private Thread positionWriterThread;
    private RouteHandler.RoutePoint lastAlarmWp=null;
    long trackMintime;
    Alarm lastNotifiedAlarm=null;
    boolean notificationSend=false;
    private long alarmSequence=System.currentTimeMillis();

    private final BroadcastReceiver usbReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context ctx, Intent intent) {

            if (intent.getAction().equals(UsbManager.ACTION_USB_DEVICE_DETACHED)) {
                UsbDevice dev = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
                if (dev != null && usbProvider != null) {
                    usbProvider.deviceDetach(dev);
                }

            }
        }
    };
    boolean receiverRegistered=false;


    private static final String LOGPRFX="Avnav:GpsService";

    /**
     * get the providers in the correct order of their priority
     * @return
     */
    private GpsDataProvider[] getAllProviders(){
        return new GpsDataProvider[]{internalProvider,externalProvider,bluetoothProvider, usbProvider};
    }
    private boolean isProviderActive(GpsDataProvider provider){
        return (provider != null) && ! provider.isStopped();
    }
    @Override
    public void logNmea(String data) {
        synchronized (loggerLock){
            if (nmeaLogger != null){
                nmeaLogger.addRecord(data);
            }
        }

    }

    @Override
    public void updated() {
        timerAction();
        sendBroadcast(new Intent(Constants.BC_RELOAD_DATA));

    }

    public class GpsServiceBinder extends Binder{
      public GpsService getService(){
          return GpsService.this;
      }
    };

    @Override
    public IBinder onBind(Intent arg0)
    {
        return mBinder;
    }

    private class PositionWriter implements Runnable{
        private boolean stop=false;
        @Override
        public void run() {
            while (! stop) {
                GpsDataProvider locationProvider = null;
                Location location = null;
                for (GpsDataProvider provider : getAllProviders()) {
                    if (isProviderActive(provider) && provider.handlesNmea()) {
                        location = provider.getLocation();
                        locationProvider = provider;
                        break;
                    }
                }
                for (GpsDataProvider provider : getAllProviders()) {
                    if (provider != null && provider != locationProvider) {
                        try {
                            if (location != null) provider.sendPosition(location);
                        }catch (Throwable t){
                            AvnLog.e("error when writing position at "+provider.getName(),t);
                        }
                    }
                }
                try {
                    Thread.sleep(1000);
                } catch (InterruptedException e) {
                    return;
                }
            }
        }
        public void doStop(){
            stop=true;
        }
        public boolean isStopped(){
            return stop;
        }
    }


    private void createNotificationChannel() {
        // Create the NotificationChannel, but only on API 26+ because
        // the NotificationChannel class is new and not in the support library
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = getString(R.string.channel_name);
            String description = getString(R.string.channel_description);
            int importance = NotificationManager.IMPORTANCE_DEFAULT;
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID_NEW, name, importance);
            channel.setDescription(description);
            channel.setSound(null,null);
            // Register the channel with the system; you can't change the importance
            // or other notification behaviors after this
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            notificationManager.createNotificationChannel(channel);
            try{
                //we need a new channel as we did not disable the sound initially - but we cannot change an existing one
                notificationManager.deleteNotificationChannel(CHANNEL_ID);
            }catch (Throwable t){}
        }
    }

    private void handleNotification(boolean start, boolean startForeground){
        if (start) {
            Alarm currentAlarm=getCurrentAlarm();
            if (! notificationSend || (currentAlarm != null && ! currentAlarm.equals(lastNotifiedAlarm))|| (currentAlarm == null && lastNotifiedAlarm != null))
            {
                createNotificationChannel();
                Intent notificationIntent = new Intent(this, Dummy.class);
                PendingIntent contentIntent = PendingIntent.getActivity(this, 0,
                        notificationIntent, PendingIntent.FLAG_UPDATE_CURRENT);
                Intent broadcastIntent = new Intent();
                broadcastIntent.setAction(Constants.BC_STOPALARM);
                PendingIntent stopAlarmPi = PendingIntent.getBroadcast(ctx, 1, broadcastIntent, PendingIntent.FLAG_CANCEL_CURRENT);
                Intent broadcastIntentStop = new Intent();
                broadcastIntentStop.setAction(Constants.BC_STOPAPPL);
                PendingIntent stopAppl = PendingIntent.getBroadcast(ctx, 1, broadcastIntentStop, PendingIntent.FLAG_CANCEL_CURRENT);
                RemoteViews nv = new RemoteViews(getPackageName(), R.layout.notification);
                nv.setOnClickPendingIntent(R.id.button2, stopAlarmPi);
                nv.setOnClickPendingIntent(R.id.button3, stopAppl);
                nv.setOnClickPendingIntent(R.id.notification, contentIntent);
                //TODO: show/hide alarm button
                if (currentAlarm != null) {
                    nv.setViewVisibility(R.id.button2, View.VISIBLE);
                    nv.setViewVisibility(R.id.button3, View.GONE);
                } else {
                    nv.setViewVisibility(R.id.button2, View.GONE);
                    nv.setViewVisibility(R.id.button3, View.VISIBLE);
                }
                NotificationCompat.Builder notificationBuilder =
                        new NotificationCompat.Builder(this, CHANNEL_ID_NEW);
                notificationBuilder.setSmallIcon(R.drawable.sailboat);
                notificationBuilder.setContentTitle(getString(R.string.notifyTitle));
                if (currentAlarm == null) {
                    notificationBuilder.setContentText(getString(R.string.notifyText));
                    nv.setTextViewText(R.id.notificationText, getString(R.string.notifyText));
                } else {
                    notificationBuilder.setContentText(currentAlarm.name + " Alarm");
                    nv.setTextViewText(R.id.notificationText, currentAlarm.name + " Alarm");
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
                    notificationBuilder.setContent(nv);
                }
                //notificationBuilder.addAction(R.drawable.alarm256red,"alarm",stopAlarmPi);
                notificationBuilder.setContentIntent(contentIntent);
                notificationBuilder.setOngoing(true);
                notificationBuilder.setAutoCancel(false);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    notificationBuilder.setVisibility(Notification.VISIBILITY_PUBLIC);
                }
                NotificationManager mNotificationManager =
                        (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (startForeground) {
                    startForeground(NOTIFY_ID, notificationBuilder.build());
                } else {
                    mNotificationManager.notify(NOTIFY_ID, notificationBuilder.build());
                }
                lastNotifiedAlarm=currentAlarm;
                notificationSend=true;
            }

        }
        else{
            notificationSend=false;
            lastNotifiedAlarm=null;
            NotificationManager mNotificationManager =
                    (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            mNotificationManager.cancel(NOTIFY_ID);

        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        super.onStartCommand(intent,flags,startId);
        boolean isWatchdog=false;
        if (intent != null && intent.getAction() != null && intent.getAction().equals(WATCHDOGACTION)) isWatchdog=true;
        if (isWatchdog) AvnLog.i("service onStartCommand, watchdog=true");
        else {
            AvnLog.i("service onStartCommand");
        }
        SharedPreferences prefs=getSharedPreferences(Constants.PREFNAME,Context.MODE_PRIVATE);
        handleNotification(true,true);
        //we rely on the activity to check before...
        File newTrackDir=new File(AvnUtil.getWorkDir(prefs,this),"tracks");
        boolean loadTrack=true;
        if (trackDir != null && trackDir.getAbsolutePath().equals(newTrackDir.getAbsolutePath())){
            //seems to be a restart - so do not load again
            loadTrack=false;
            AvnLog.d(LOGPRFX,"restart: do not load track data");
        }

        long trackInterval=1000* AvnUtil.getLongPref(prefs, Constants.TRACKINTERVAL, 300);
        long trackDistance=AvnUtil.getLongPref(prefs, Constants.TRACKDISTANCE, 25);
        trackMintime=1000*AvnUtil.getLongPref(prefs, Constants.TRACKMINTIME, 10);
        long trackTime=1000*60*60*AvnUtil.getLongPref(prefs, Constants.TRACKTIME, 25); //25h - to ensure that we at least have the whole day...
        String aisMode= NmeaSettingsFragment.getAisMode(prefs);
        String nmeaMode=NmeaSettingsFragment.getNmeaMode(prefs);
        Properties loggerProperties=new Properties();
        loggerProperties.logAis=prefs.getBoolean(Constants.AISLOG,false);
        loggerProperties.logNmea=prefs.getBoolean(Constants.NMEALOG,false);
        loggerProperties.nmeaFilter=prefs.getString(Constants.NMEALOGFILTER,null);
        AvnLog.d(LOGPRFX,"started with dir="+newTrackDir.getAbsolutePath()+", interval="+(trackInterval/1000)+
                ", distance="+trackDistance+", mintime="+(trackMintime/1000)+
                ", maxtime(h)="+(trackTime/3600/1000)+
                ", AISmode="+aisMode+
                ", NmeaMode="+nmeaMode
                );
        trackDir = newTrackDir;
        synchronized (loggerLock) {
            if (! isWatchdog || nmeaLogger == null) {
                if (loggerProperties.logNmea || loggerProperties.logAis) {
                    if (nmeaLogger != null) nmeaLogger.stop();
                    nmeaLogger = new NmeaLogger(trackDir, mediaUpdater, loggerProperties);
                } else {
                    if (nmeaLogger != null) nmeaLogger.stop();
                    nmeaLogger = null;
                }
            }
        }
        if (loadTrack) {
            trackWriter = new TrackWriter(trackDir,trackTime,trackDistance,trackMintime,trackInterval);
            timerSequence++;
        }
        File routeDir=new File(AvnUtil.getWorkDir(prefs,this),"routes");
        if (routeHandler == null || routeHandler.isStopped()) {
            routeHandler = new RouteHandler(routeDir,this);
            routeHandler.setMediaUpdater(mediaUpdater);
            routeHandler.start();
        }
        if (! isWatchdog || runnable == null) {
            runnable = new TimerRunnable(timerSequence);
            handler.postDelayed(runnable, trackMintime);
        }
        if (! receiverRegistered) {
            registerReceiver(usbReceiver, new IntentFilter(UsbManager.ACTION_USB_DEVICE_DETACHED));
            receiverRegistered=true;
        }
        if (nmeaMode.equals(Constants.MODE_INTERNAL)){
            if (internalProvider == null || internalProvider.isStopped()) {
                AvnLog.d(LOGPRFX,"start internal provider");
                GpsDataProvider.Properties prop=new GpsDataProvider.Properties();
                try {
                    internalProvider = new AndroidPositionHandler(this, 1000 * AvnUtil.getLongPref(prefs, Constants.GPSOFFSET, prop.timeOffset));
                }catch (Exception i){
                    Log.e(LOGPRFX,"unable to start external service: "+i.getLocalizedMessage());
                }
            }
        }
        else {
            if (internalProvider != null){
                AvnLog.d(LOGPRFX,"stopping internal provider");
                internalProvider.stop();
                internalProvider=null;
            }
        }
        if (aisMode.equals(Constants.MODE_IP) || nmeaMode.equals(Constants.MODE_IP)){
            if (externalProvider == null|| externalProvider.isStopped()){
                try {
                    InetSocketAddress addr = GpsDataProvider.convertAddress(prefs.getString(Constants.IPADDR, ""),
                            prefs.getString(Constants.IPPORT, ""));
                    AvnLog.d(LOGPRFX,"starting external receiver for "+addr.toString());
                    GpsDataProvider.Properties prop=new GpsDataProvider.Properties();
                    prop.aisCleanupInterval=1000*AvnUtil.getLongPref(prefs, Constants.IPAISCLEANUPIV, prop.aisCleanupInterval);
                    prop.aisLifetime=1000*AvnUtil.getLongPref(prefs,Constants.AISLIFETIME, prop.aisLifetime);
                    prop.postionAge=1000*AvnUtil.getLongPref(prefs,Constants.IPPOSAGE,prop.postionAge);
                    prop.connectTimeout=1000*(int)AvnUtil.getLongPref(prefs,Constants.IPCONNTIMEOUT, prop.connectTimeout);
                    prop.timeOffset=1000*AvnUtil.getLongPref(prefs,Constants.IPOFFSET,prop.timeOffset);
                    prop.ownMmsi=prefs.getString(Constants.AISOWN,null);
                    prop.readAis=aisMode.equals(Constants.MODE_IP);
                    prop.readNmea=nmeaMode.equals(Constants.MODE_IP);
                    prop.nmeaFilter=prefs.getString(Constants.NMEAFILTER,null);
                    prop.sendPosition=prefs.getBoolean(Constants.AISSENDPOS,false) && (prop.readAis && ! prop.readNmea);
                    externalProvider=new IpPositionHandler(this,addr,prop);
                }catch (Exception i){
                    Log.e(LOGPRFX,"unable to start external service: "+i.getLocalizedMessage());
                }

            }
        }
        else{
            if (externalProvider != null){
                AvnLog.d(LOGPRFX,"stopping external service");
                externalProvider.stop();
            }
        }
        if (aisMode.equals(Constants.MODE_BLUETOOTH) || nmeaMode.equals(Constants.MODE_BLUETOOTH)){
            if (bluetoothProvider == null|| bluetoothProvider.isStopped()){
                try {
                    String dname=prefs.getString(Constants.BTDEVICE, "");
                    BluetoothDevice dev=BluetoothPositionHandler.getDeviceForName(dname);
                    if (dev == null){
                        throw new Exception("no bluetooth device found for"+dname);
                    }
                    AvnLog.d(LOGPRFX,"starting bluetooth receiver for "+dname+": "+ dev.getAddress());
                    GpsDataProvider.Properties prop=new GpsDataProvider.Properties();
                    prop.aisCleanupInterval=1000*AvnUtil.getLongPref(prefs, Constants.IPAISCLEANUPIV, prop.aisCleanupInterval);
                    prop.aisLifetime=1000*AvnUtil.getLongPref(prefs,Constants.AISLIFETIME, prop.aisLifetime);
                    prop.postionAge=1000*AvnUtil.getLongPref(prefs,Constants.IPPOSAGE,prop.postionAge);
                    prop.connectTimeout=(int)(1000*AvnUtil.getLongPref(prefs,Constants.IPCONNTIMEOUT, prop.connectTimeout));
                    prop.ownMmsi=prefs.getString(Constants.AISOWN,null);
                    prop.readAis=aisMode.equals(Constants.MODE_BLUETOOTH);
                    prop.readNmea=nmeaMode.equals(Constants.MODE_BLUETOOTH);
                    prop.timeOffset=1000*AvnUtil.getLongPref(prefs,Constants.BTOFFSET,prop.timeOffset);
                    prop.nmeaFilter=prefs.getString(Constants.NMEAFILTER,null);
                    prop.sendPosition=prefs.getBoolean(Constants.AISSENDPOS,false) && (prop.readAis && ! prop.readNmea);
                    bluetoothProvider=new BluetoothPositionHandler(this,dev,prop);
                }catch (Exception i){
                    Log.e(LOGPRFX,"unable to start external service "+i.getLocalizedMessage());
                }

            }
        }
        else{
            if (bluetoothProvider != null){
                AvnLog.d(LOGPRFX,"stopping bluetooth service");
                bluetoothProvider.stop();
            }
        }

        if (aisMode.equals(Constants.MODE_USB) || nmeaMode.equals(Constants.MODE_USB)){
            if (usbProvider == null || usbProvider.isStopped()){
                try {
                    String dname=prefs.getString(Constants.USBDEVICE, "");
                    UsbDevice dev=UsbSerialPositionHandler.getDeviceForName(this,dname);
                    if (dev == null){
                        throw new Exception("no usb device found for"+dname);
                    }
                    AvnLog.d(LOGPRFX,"starting usb serial receiver for "+dname+": "+ dev.getDeviceName());
                    GpsDataProvider.Properties prop=new GpsDataProvider.Properties();
                    prop.aisCleanupInterval=1000*AvnUtil.getLongPref(prefs, Constants.IPAISCLEANUPIV, prop.aisCleanupInterval);
                    prop.aisLifetime=1000*AvnUtil.getLongPref(prefs,Constants.AISLIFETIME, prop.aisLifetime);
                    prop.postionAge=1000*AvnUtil.getLongPref(prefs,Constants.IPPOSAGE,prop.postionAge);
                    prop.connectTimeout=(int)(1000*AvnUtil.getLongPref(prefs,Constants.IPCONNTIMEOUT, prop.connectTimeout));
                    prop.ownMmsi=prefs.getString(Constants.AISOWN,null);
                    prop.readAis=aisMode.equals(Constants.MODE_USB);
                    prop.readNmea=nmeaMode.equals(Constants.MODE_USB);
                    prop.timeOffset=1000*AvnUtil.getLongPref(prefs,Constants.BTOFFSET,prop.timeOffset);
                    prop.nmeaFilter=prefs.getString(Constants.NMEAFILTER,null);
                    prop.sendPosition=prefs.getBoolean(Constants.AISSENDPOS,false) && (prop.readAis && ! prop.readNmea);
                    usbProvider =new UsbSerialPositionHandler(this,dev,prefs.getString(Constants.USBBAUD,"4800"),prop);
                }catch (Exception i){
                    Log.e(LOGPRFX,"unable to start external service "+i.getLocalizedMessage());
                }

            }
        }
        else{
            if (usbProvider != null){
                AvnLog.d(LOGPRFX,"stopping usbProvider service");
                usbProvider.stop();
            }
        }
        if (positionWriter == null || positionWriter.isStopped()) {
            positionWriter = new PositionWriter();
            positionWriterThread = new Thread(positionWriter);
            positionWriterThread.setDaemon(true);
            positionWriterThread.start();
        }
        isRunning=true;
        return Service.START_REDELIVER_INTENT;
    }
    public void onCreate()
    {
        super.onCreate();
        notificationSend=false;
        lastNotifiedAlarm=null;
        ctx = this;
        mediaPlayer=new MediaPlayer();
        mediaPlayer.setAudioStreamType(AudioManager.STREAM_MUSIC);
        mediaPlayer.setOnErrorListener(new MediaPlayer.OnErrorListener() {
            @Override
            public boolean onError(MediaPlayer mp, int what, int extra) {
                AvnLog.e("Media player error "+what+","+extra);
                return true;
            }
        });
        mediaPlayer.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
            @Override
            public void onCompletion(MediaPlayer mp) {
                if (mediaRepeatCount > 0) mediaRepeatCount--;
                if (mediaRepeatCount > 0){
                    mediaPlayer.start();
                }
            }
        });

        IntentFilter filter=new IntentFilter(Constants.BC_STOPALARM);
        broadCastReceiver=new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                AvnLog.i("received stop alarm");
                resetAllAlarms();
                handleNotification(true,false);
            }
        };
        registerReceiver(broadCastReceiver,filter);
        triggerReceiver=new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (routeHandler != null) routeHandler.triggerParser();
            }
        };
        IntentFilter triggerFilter=new IntentFilter((Constants.BC_TRIGGER));
        registerReceiver(triggerReceiver,triggerFilter);
        Intent watchdog = new Intent(getApplicationContext(), GpsService.class);
        watchdog.setAction(WATCHDOGACTION);
        watchdogIntent=PendingIntent.getService(
                getApplicationContext(),
                0,
                watchdog,
                0);

        ((AlarmManager) getApplicationContext().getSystemService(Context.ALARM_SERVICE))
                .setInexactRepeating(
                        AlarmManager.ELAPSED_REALTIME,
                        0,
                        Constants.WATCHDOGTIME,
                        watchdogIntent
                );

    }
    /**
     * a timer handler
     * we compare the sequence from the start with our current sequence to prevent
     * multiple runs...
     */
    private class TimerRunnable implements Runnable{
        private long sequence=0;
        TimerRunnable(long seq){sequence=seq;}
        public void run(){
            if (! isRunning) return;
            if (timerSequence != sequence) return;
            timerAction();
            handler.postDelayed(this, trackMintime);
        }
    };

    public void timerAction(){
        checkAnchor();
        checkApproach();
        checkMob();
        handleNotification(true,false);
        checkTrackWriter();
        for (GpsDataProvider provider: getAllProviders()) {
            if (provider != null) {
                provider.check();
            }
        }
        SharedPreferences prefs=getSharedPreferences(Constants.PREFNAME,Context.MODE_PRIVATE);
        if (!prefs.getBoolean(Constants.ALARMSOUNDS,true)) {
            try{
                if (mediaPlayer != null){
                    mediaPlayer.reset();
                }
            }catch (Exception e){}
        }
    }

    private void checkAnchor(){
        if (routeHandler == null) return;
        if (! routeHandler.anchorWatchActive()){
            resetAlarm(Alarm.GPS.name);
            resetAlarm(Alarm.ANCHOR.name);
            gpsLostAlarmed=false;
            return;
        }
        Location current=getLocation();
        if (current == null){
            resetAlarm(Alarm.ANCHOR.name);
            if (gpsLostAlarmed) return;
            gpsLostAlarmed=true;
            setAlarm(Alarm.GPS.name);
            return;
        }
        resetAlarm(Alarm.GPS.name);
        gpsLostAlarmed=false;
        if (! routeHandler.checkAnchor(current)){
            resetAlarm(Alarm.ANCHOR.name);
            return;
        }
        setAlarm(Alarm.ANCHOR.name);
    }
    private void checkApproach(){
        if (routeHandler == null) return;
        Location current=getLocation();
        if (current == null){
            resetAlarm(Alarm.WAYPOINT.name);
            return;
        }
        if (! routeHandler.handleApproach(current)){
            lastAlarmWp=null;
            resetAlarm(Alarm.WAYPOINT.name);
            return;
        }
        if (lastAlarmWp == routeHandler.getCurrentTarget() ){
            return;
        }
        lastAlarmWp=routeHandler.getCurrentTarget();
        setAlarm(Alarm.WAYPOINT.name);
    }

    private void checkMob(){
        if (routeHandler == null) return;
        if (! routeHandler.mobActive()){
            mobAlarm=false;
            resetAlarm(Alarm.MOB.name);
            return;
        }
        if (mobAlarm) return;
        setAlarm(Alarm.MOB.name);
        mobAlarm=true;
    }

    /**
     * will be called whe we intend to really stop
     */
    private void handleStop(boolean emptyTrack) {
        for (GpsDataProvider provider : getAllProviders()) {
            if (provider != null) {
                provider.stop();
            }
        }
        //this is not completely OK: we could fail to write our last track points
        //if we still load the track - but otherwise we could reeally empty the track
        try {
            //when we shut down completely we have to wait until the track is written
            //if we only restart, we write the track in background
            trackWriter.writeSync(mediaUpdater);
        } catch (FileNotFoundException e) {
            AvnLog.d(LOGPRFX, "Exception while finally writing trackfile: " + e.getLocalizedMessage());
        }
        if (emptyTrack) {
            trackWriter.clearTrack();
            trackDir = null;
        }
        if (routeHandler != null) routeHandler.stop();
        if (positionWriter != null) positionWriter.doStop();
        isRunning = false;
        handleNotification(false, false);
        AvnLog.i(LOGPRFX, "service stopped");
    }

    public void stopMe(boolean doShutdown){
        shouldStop=doShutdown;
        handleStop(doShutdown);
        if (shouldStop){
            ((AlarmManager) getApplicationContext().getSystemService(Context.ALARM_SERVICE)).
                    cancel(watchdogIntent);
            AvnLog.i(LOGPRFX,"alarm deregistered");
        }
        stopSelf();
    }

    @Override
    public boolean onUnbind(Intent intent) {
        AvnLog.i("service unbind");
        return super.onUnbind(intent);
    }

    @Override
    public void onDestroy()
    {
        super.onDestroy();
        handleStop(true);
        if (receiverRegistered) {
            unregisterReceiver(usbReceiver);
            receiverRegistered=false;
        }
        if (mediaPlayer != null){
            try{
                mediaPlayer.release();
            }catch (Exception e){

            }
        }
        if (broadCastReceiver != null){
            unregisterReceiver(broadCastReceiver);
        }
        if (triggerReceiver != null){
            unregisterReceiver(triggerReceiver);
        }
        if (shouldStop){
            ((AlarmManager) getApplicationContext().getSystemService(Context.ALARM_SERVICE)).
                    cancel(watchdogIntent);
        }
        lastNotifiedAlarm=null;
        notificationSend=false;
    }


    /**
     * will be called from within the timer thread
     * check if position has changed and write track entries
     * write out the track file in regular intervals
     */
    private void checkTrackWriter(){
        if (! isRunning) return;
        Location l=getLocation();
        trackWriter.checkWrite(l,mediaUpdater);

    }

    /**
     * get the current track
     * @param maxnum - max number of points (including the newest one)
     * @param interval - min time distance between 2 points
     * @return the track points in inverse order, i.e. the newest is at index 0
     */
    public synchronized  ArrayList<Location> getTrack(int maxnum, long interval){
        ArrayList<Location> rt=new ArrayList<Location>();
        List<Location> trackpoints=trackWriter.getTrackPoints(true);
        if (! isRunning) return rt;
        long currts=-1;
        long num=0;
        try {
            for (int i = trackpoints.size() - 1; i >= 0; i--) {
                Location l = trackpoints.get(i);
                if (currts == -1) {
                    currts = l.getTime();
                    rt.add(l);
                    num++;
                } else {
                    long nts = l.getTime();
                    if ((currts - nts) >= interval || interval == 0) {
                        currts = nts;
                        rt.add(l);
                        num++;
                    }
                }

                if (num >= maxnum) break;
            }
        }catch (Exception e){
            //we are tolerant - if we hit cleanup an do not get the track once, this should be no issue
        }
        AvnLog.d(LOGPRFX,"getTrack returns "+num+" points");
        return rt;
    }

    public boolean isRunning(){
        return isRunning;
    }



    public GpsDataProvider.SatStatus getSatStatus(){
        GpsDataProvider.SatStatus rt=new GpsDataProvider.SatStatus(0,0);
        if (! isRunning ) return rt;
        for (GpsDataProvider provider: getAllProviders()){
            if (isProviderActive(provider) && provider.handlesNmea()){
                rt=provider.getSatStatus();
                AvnLog.d(LOGPRFX,"getSatStatus returns "+rt);
                return rt;
            }
        }
        return rt;
    }


    public Map<String,Alarm> getAlarmStatus() {
        return alarmStatus;
    }
    public JSONObject getAlarStatusJson() throws JSONException {
        Map<String,Alarm> alarms=getAlarmStatus();
        JSONObject rt=new JSONObject();
        for (String k: alarms.keySet()){
            rt.put(k,alarms.get(k).toJson());
        }
        return rt;
    }

    public void resetAlarm(String type){
        AvnLog.i("reset alarm "+type);
        Alarm a=alarmStatus.get(type);
        if (a != null && a.isPlaying){
            if (mediaPlayer != null) mediaPlayer.stop();
            mediaRepeatCount=0;
            alarmSequence++;
        }
        alarmStatus.remove(type);
    }
    public void resetAllAlarms(){
        ArrayList<String> alarms=new ArrayList<String>();
        for (String type: alarmStatus.keySet()){
            alarms.add(type);
        }
        for (String alarm: alarms){
            resetAlarm(alarm);
        }
    }
    public Alarm getCurrentAlarm(){
        if (alarmStatus.size() == 0) return null;
        Alarm activeAlarm=null;
        Alarm soundAlarm=null;
        for (Alarm alarm:alarmStatus.values()){
           if (alarm.running && activeAlarm==null) activeAlarm=alarm;
           if (alarm.isPlaying && soundAlarm == null) soundAlarm=alarm;
        }
        if (soundAlarm != null) return soundAlarm;
        return activeAlarm;
    }

    private void setAlarm(String type){
        Alarm a=Alarm.createAlarm(type);
        if (a == null) return;
        a.running=true;
        Alarm current=alarmStatus.get(a.name);
        if (current != null && current.running) return;
        alarmSequence++;
        AvnLog.i("set alarm "+type);
        alarmStatus.put(type,a);
        SharedPreferences prefs=getSharedPreferences(Constants.PREFNAME,Context.MODE_PRIVATE);
        if (!prefs.getBoolean(Constants.ALARMSOUNDS,true)) {
            try{
                if (mediaPlayer != null){
                    mediaPlayer.reset();
                }
            }catch(Exception e){}
            return;
        }
        AudioEditTextPreference.AudioInfo sound = AudioEditTextPreference.getAudioInfoForAlarmName(a.name,this);
        if (sound != null) {
            try {
                if (mediaPlayer != null) {
                    if (mediaPlayer.isPlaying()) {
                        mediaPlayer.stop();
                    }
                    mediaPlayer.reset();
                    mediaPlayer.setAudioStreamType(AudioManager.STREAM_NOTIFICATION);
                    AudioEditTextPreference.setPlayerSource(mediaPlayer,sound,this);
                    mediaRepeatCount=a.repeat;
                    mediaPlayer.setLooping(false);
                    mediaPlayer.prepare();
                    mediaPlayer.start();
                }
                a.isPlaying = true;
            } catch (Exception e) {
            }
        }

    }

    public JSONObject getGpsData() throws JSONException{
        JSONObject rt=null;
        for (GpsDataProvider provider: getAllProviders()){
            if (isProviderActive(provider) && provider.handlesNmea()){
                rt=provider.getGpsData();
                break;
            }
        }
        if (rt == null){
            rt=new JSONObject();
        }
        rt.put("updatealarm",alarmSequence);
        long legSequence=-1;
        if (routeHandler != null) legSequence=routeHandler.getLegSequence();
        rt.put("updateleg",legSequence);
        return rt;
    }

    private Location getLocation(){
        for (GpsDataProvider provider: getAllProviders()){
            if (isProviderActive(provider) && provider.handlesNmea()) return provider.getLocation();
        }
        return null;
    }

    public JSONArray getAisData(double lat,double lon, double distance){
        JSONArray rt=new JSONArray();
        for (GpsDataProvider h: getAllProviders()){
            if (h != null){
                try {
                    JSONArray items = h.getAisData(lat, lon, distance);
                    if (items == null) continue;
                    for (int i = 0; i < items.length(); i++) {
                        rt.put(items.get(i));
                    }
                }catch (JSONException e){
                    Log.e(LOGPRFX,"exception while merging AIS data: "+e.getLocalizedMessage());
                }
            }
        }
        return rt;
    }

    public void setMediaUpdater(IMediaUpdater u){

        mediaUpdater=u;
        synchronized (loggerLock) {
            if (mediaUpdater != null && nmeaLogger != null) {
                nmeaLogger.setMediaUpdater(mediaUpdater);
            }
        }
    }

    public IMediaUpdater getMediaUpdater(){
        return mediaUpdater;
    }


    /**
     * get the status for NMEA and AIS
     * @return
     * nmea: { source: internal, status: green , info: 3 visible/2 used}
     * ais: [ source: IP, status: yellow, info: connected to 10.222.9.1:34567}
     * @throws JSONException
     */
    public JSONObject getNmeaStatus() throws JSONException{
        JSONObject nmea=new JSONObject();
        nmea.put("source","unknown");
        nmea.put("status","red");
        nmea.put("info","disabled");
        JSONObject ais=new JSONObject();
        ais.put("source","unknown");
        ais.put("status","red");
        ais.put("info","disabled");
        for (GpsDataProvider provider: getAllProviders()) {
            if (isProviderActive(provider)) {
                GpsDataProvider.SatStatus st = provider.getSatStatus();
                Location loc = provider.getLocation();
                String addr = provider.getConnectionId();
                if (provider.handlesNmea()) {
                    nmea.put("source", provider.getName());
                    if (loc != null) {
                        nmea.put("status", "green");
                        nmea.put("info", "(" + addr + ") sats: " + st.numSat + " / " + st.numUsed );
                    } else {
                        if (st.gpsEnabled) {
                            nmea.put("info", "(" + addr + ") con, sats: " + st.numSat + " / " + st.numUsed );
                            nmea.put("status", "yellow");
                        } else {
                            nmea.put("info", "(" + addr + ") disconnected");
                            nmea.put("status", "red");
                        }
                    }
                }
                if (provider.handlesAis()) {
                    ais.put("source", provider.getName());
                    int aisTargets=provider.numAisData();
                    if (aisTargets> 0) {
                        ais.put("status", "green");
                        ais.put("info", "(" + addr + "), "+aisTargets+" targets");
                    } else {
                        if (st.gpsEnabled) {
                            ais.put("info", "(" + addr + ") connected");
                            ais.put("status", "yellow");
                        } else {
                            ais.put("info", "(" + addr + ") disconnected");
                            ais.put("status", "red");
                        }
                    }
                }
            }
        }
        JSONObject rt=new JSONObject();
        rt.put("nmea",nmea);
        rt.put("ais",ais);
        return rt;
    }
    public JSONObject getStatus() throws JSONException {
        JSONArray rt=new JSONArray();
        for (GpsDataProvider handler: getAllProviders()) {
            if (isProviderActive(handler)) {
                try {
                    rt.put(handler.getHandlerStatus());
                }catch (JSONException e){
                    AvnLog.d("exception while querying handler status: "+e);
                }
            }
        }
        JSONObject out=new JSONObject();
        out.put("name","GPS");
        out.put("items",rt);
        return out;
    }

    public JSONObject getTrackStatus() throws JSONException {
        if (trackWriter == null) return new JSONObject();
        return trackWriter.getTrackStatus();
    }

    public RouteHandler getRouteHandler(){
        return routeHandler;
    }
    public TrackWriter getTrackWriter(){ return trackWriter;}
}
