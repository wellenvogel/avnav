package de.wellenvogel.avnav.gps;

import android.app.Notification;
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
import android.os.Binder;
import android.os.Handler;
import android.os.IBinder;
import android.util.Log;

import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.Dummy;
import de.wellenvogel.avnav.main.IMediaUpdater;
import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.main.RequestHandler;
import de.wellenvogel.avnav.settings.NmeaSettingsFragment;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

/**
 * Created by andreas on 12.12.14.
 */
public class GpsService extends Service implements INmeaLogger {


    public static String PROP_TRACKDIR="track.dir";
    public static String PROP_CHECKONLY="checkonly";
    private static final long MAXLOCAGE=10000; //max age of location in milliseconds
    private static final long MAXLOCWAIT=2000; //max time we wait until we explicitely query the location again


    private Context ctx;
    private long writerInterval=0;
    private String outfile=null;
    private ArrayList<Location> trackpoints=new ArrayList<Location>();
    private long lastTrackWrite=0;
    private long lastTrackCount;
    private final IBinder mBinder = new GpsServiceBinder();
    private GpsDataProvider internalProvider=null;
    private IpPositionHandler externalProvider=null;
    private BluetoothPositionHandler bluetoothProvider=null;
    private UsbSerialPositionHandler usbProvider =null;

    private boolean isRunning;  //this is our view whether we are running or not
                                //running means that we are registered for updates and have our timer active

    //properties
    private File trackDir=null;
    private long trackInterval; //interval for writing out the xml file
    private long trackDistance; //min distance in m
    private long trackMintime; //min interval between 2 points
    private long trackTime;   //length of track


    private TrackWriter trackWriter;
    private RouteHandler routeHandler;
    private NmeaLogger nmeaLogger;
    private Handler handler = new Handler();
    private long timerSequence=1;
    private Runnable runnable;
    private IMediaUpdater mediaUpdater;
    private boolean trackLoading=true; //if set to true - do not write the track
    private long loadSequence=1;
    private static final int NOTIFY_ID=1;
    private Object loggerLock=new Object();
    private HashMap<String,Alarm> alarmStatus=new HashMap<String, Alarm>();

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

    /**
     * a class for asynchronously loading the tracks
     * this honors the load sequence to avoid overwriting data from
     * a new load that has been started by a restarted service
     */
    private class LoadRunner implements Runnable{
        private long myLoadSequence;

        LoadRunner(long loadSequence){
            myLoadSequence=loadSequence;
        }

        @Override
        public void run() {
            try {
                ArrayList<Location> filetp = new ArrayList<Location>();
                //read the track data from today and yesterday
                //we rely on the cleanup to handle outdated entries
                long mintime = System.currentTimeMillis() - trackTime;
                Date dt = new Date();
                ArrayList<Location> rt = trackWriter.parseTrackFile(new Date(dt.getTime() - 24 * 60 * 60 * 1000), mintime, trackDistance);
                filetp.addAll(rt);
                if (myLoadSequence != loadSequence){
                    AvnLog.d(LOGPRFX, "load sequence has changed, stop loading");
                }
                rt = trackWriter.parseTrackFile(dt, mintime, trackDistance);
                filetp.addAll(rt);
                synchronized (GpsService.this) {
                    if (myLoadSequence == loadSequence) {
                        lastTrackWrite = dt.getTime();
                        if (rt.size() == 0) {
                            //empty track file - trigger write very soon
                            lastTrackWrite = 0;
                        }
                        ArrayList<Location> newTp = trackpoints;
                        trackpoints = filetp;
                        trackpoints.addAll(newTp);
                    }
                    else{
                        AvnLog.d(LOGPRFX,"unable to store loaded track as new load has already started");
                    }
                }
            }catch (Exception e){}
            AvnLog.d(LOGPRFX, "read " + trackpoints.size() + " trackpoints from files");
            if (myLoadSequence == loadSequence) trackLoading=false;

        }
    }

    private void handleNotification(boolean start){
        if (start) {
            Notification.Builder notificationBuilder =
                    new Notification.Builder(this)
                            .setSmallIcon(R.drawable.sailboat)
                            .setContentTitle(getResources().getString(R.string.notifyTitle))
                            .setContentText(getResources().getString(R.string.notifyText));
            Intent notificationIntent = new Intent(this, Dummy.class);
            PendingIntent contentIntent = PendingIntent.getActivity(this, 0,
                    notificationIntent, PendingIntent.FLAG_UPDATE_CURRENT);

            notificationBuilder.setContentIntent(contentIntent);



            NotificationManager mNotificationManager =
                    (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            Notification not=notificationBuilder.getNotification();
            not.flags|=Notification.FLAG_ONGOING_EVENT;
            mNotificationManager.notify(NOTIFY_ID,
                    not);
        }
        else{
            NotificationManager mNotificationManager =
                    (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            mNotificationManager.cancel(NOTIFY_ID);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        super.onStartCommand(intent,flags,startId);
        if (intent != null && intent.getBooleanExtra(PROP_CHECKONLY,false)){
            return Service.START_REDELIVER_INTENT;
        }
        SharedPreferences prefs=getSharedPreferences(Constants.PREFNAME,Context.MODE_PRIVATE);
        handleNotification(true);
        //we rely on the activity to check before...
        File newTrackDir=new File(new File(prefs.getString(Constants.WORKDIR,"")),"tracks");
        boolean loadTrack=true;
        if (trackDir != null && trackDir.getAbsolutePath().equals(newTrackDir.getAbsolutePath())){
            //seems to be a restart - so do not load again
            loadTrack=false;
            AvnLog.d(LOGPRFX,"restart: do not load track data");
        }

        trackInterval=1000* AvnUtil.getLongPref(prefs, Constants.TRACKINTERVAL, 300);
        trackDistance=AvnUtil.getLongPref(prefs, Constants.TRACKDISTANCE, 25);
        trackMintime=1000*AvnUtil.getLongPref(prefs, Constants.TRACKMINTIME, 10);
        trackTime=1000*60*60*AvnUtil.getLongPref(prefs, Constants.TRACKTIME, 25); //25h - to ensure that we at least have the whole day...
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
            if (loggerProperties.logNmea||loggerProperties.logAis) {
                if (nmeaLogger != null) nmeaLogger.stop();
                nmeaLogger = new NmeaLogger(trackDir,mediaUpdater,loggerProperties);
            } else {
                if (nmeaLogger != null) nmeaLogger.stop();
                nmeaLogger = null;
            }
        }
        if (loadTrack) {
            trackpoints.clear();
            loadSequence++;
            trackWriter = new TrackWriter(trackDir);
            trackLoading=true;
            Thread readThread=new Thread(new LoadRunner(loadSequence));
            readThread.start();
            timerSequence++;
        }
        else{
            trackLoading=false;
        }
        File routeDir=new File(new File(prefs.getString(Constants.WORKDIR,"")),"routes");
        routeHandler=new RouteHandler(routeDir);
        routeHandler.setMediaUpdater(mediaUpdater);
        routeHandler.start();
        runnable=new TimerRunnable(timerSequence);
        handler.postDelayed(runnable, trackMintime);
        if (! receiverRegistered) {
            registerReceiver(usbReceiver, new IntentFilter(UsbManager.ACTION_USB_DEVICE_DETACHED));
            receiverRegistered=true;
        }
        if (nmeaMode.equals(Constants.MODE_INTERNAL)){
            if (internalProvider == null || internalProvider.isStopped()) {
                AvnLog.d(LOGPRFX,"start internal provider");
                GpsDataProvider.Properties prop=new GpsDataProvider.Properties();
                internalProvider=new AndroidPositionHandler(this,1000*AvnUtil.getLongPref(prefs,Constants.GPSOFFSET,prop.timeOffset));
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
        isRunning=true;
        return Service.START_REDELIVER_INTENT;
    }
    public void onCreate()
    {
        super.onCreate();
        ctx = this;

    }

    private String getAlarmSound(Alarm alarm){
        SharedPreferences prefs=getSharedPreferences(Constants.PREFNAME,Context.MODE_PRIVATE);
        String sound=prefs.getString("alarm."+alarm.name,"");
        if (sound.isEmpty()) return null;
        if (sound.startsWith("/")){
            return "file:/"+sound;
        }
        return RequestHandler.URLPREFIX+"sounds/"+sound;
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

    private void timerAction(){
        checkAnchor();
        handleNotification(true);
        checkTrackWriter();
        for (GpsDataProvider provider: getAllProviders()) {
            if (provider != null) provider.check();
        }
    }

    private void checkAnchor(){
        if (routeHandler == null) return;
        if (! routeHandler.anchorWatchActive()){
            resetAlarm(Alarm.GPS.name);
            resetAlarm(Alarm.ANCHOR.name);
            return;
        }
        Location current=getLocation();
        if (current == null){
            resetAlarm(Alarm.ANCHOR.name);
            //TODO: avoid repeated GPS alarm
            setAlarm(Alarm.GPS.name);
            return;
        }
        resetAlarm(Alarm.GPS.name);
        if (! routeHandler.checkAnchor(current)){
            resetAlarm(Alarm.ANCHOR.name);
            return;
        }
        setAlarm(Alarm.ANCHOR.name);
    }

    /**
     * will be called whe we intend to really stop
     */
    private void handleStop(boolean emptyTrack){
        for (GpsDataProvider provider: getAllProviders()) {
            if (provider != null) {
                provider.stop();
            }
        }
        //this is not completely OK: we could fail to write our last track points
        //if we still load the track - but otherwise we could reeally empty the track
        if (trackpoints.size() >0){
            if (! trackLoading) {
                try {
                    //when we shut down completely we have to wait until the track is written
                    //if we only restart, we write the track in background
                    trackWriter.writeTrackFile(getTrackCopy(), new Date(), !emptyTrack, mediaUpdater);
                } catch (FileNotFoundException e) {
                    AvnLog.d(LOGPRFX, "Exception while finally writing trackfile: " + e.getLocalizedMessage());
                }
            }
            else {
                AvnLog.i(LOGPRFX,"unable to write trackfile as still loading");
            }
        }
        if (emptyTrack) {
            trackpoints.clear();
            trackDir = null;
        }
        loadSequence++;
        if (routeHandler != null) routeHandler.stop();
        isRunning=false;
        handleNotification(false);
        AvnLog.d(LOGPRFX, "service stopped");
    }

    public void stopMe(boolean doShutdown){
        handleStop(doShutdown);
        stopSelf();
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
    }


    /**
     * will be called from within the timer thread
     * check if position has changed and write track entries
     * write out the track file in regular intervals
     */
    private void checkTrackWriter(){
        if (! isRunning) return;
        if (trackLoading) return;
        boolean writeOut=false;
        long current = System.currentTimeMillis();
        Location l=getLocation();
        synchronized (this) {
            if (l != null) {
                boolean add = false;
                //check if distance is reached
                float distance = 0;
                if (trackpoints.size() > 0) {
                    Location last = trackpoints.get(trackpoints.size() - 1);
                    distance = last.distanceTo(l);
                    if (distance >= trackDistance) {
                        add = true;

                    }
                } else {
                    add = true;
                }
                if (add) {
                    AvnLog.d(LOGPRFX, "add location to track logNmea " + l.getLatitude() + "," + l.getLongitude() + ", distance=" + distance);
                    Location nloc = new Location(l);
                    nloc.setTime(current);
                    trackpoints.add(nloc);
                }
            }
            //now check if we should write out
            if (current > (lastTrackWrite + trackInterval) && trackpoints.size() != lastTrackCount) {
                AvnLog.d(LOGPRFX, "start writing track");
                //cleanup
                int deleted = 0;
                long deleteTime = current - trackTime;
                trackWriter.cleanup(trackpoints,deleteTime);
                writeOut=true;
            }
        }
        if (writeOut) {
            ArrayList<Location> w=getTrackCopy();
            lastTrackCount = w.size();
            lastTrackWrite = current;
            try {
                //we have to be careful to get a copy when having a lock
                trackWriter.writeTrackFile(w, new Date(current), true,mediaUpdater);
            } catch (IOException io) {

            }

        }
    }

    /**
     * get the current track
     * @param maxnum - max number of points (including the newest one)
     * @param interval - min time distance between 2 points
     * @return the track points in inverse order, i.e. the newest is at index 0
     */
    public synchronized  ArrayList<Location> getTrack(int maxnum, long interval){
        ArrayList<Location> rt=new ArrayList<Location>();
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

    public synchronized ArrayList<Location> getTrackCopy(){
        ArrayList<Location> rt=new ArrayList<Location>(trackpoints);
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
        alarmStatus.remove(type);
    }

    private void setAlarm(String type){
        Alarm a=Alarm.createAlarm(type);
        if (a == null) return;
        a.running=true;
        Alarm current=alarmStatus.get(a.name);
        if (current != null && current.running) return;
        String sound=getAlarmSound(a);
        if (sound != null){
            a.url=sound;
        }
        AvnLog.i("set alarm "+type);
        alarmStatus.put(type,a);
    }

    public JSONObject getGpsData() throws JSONException{
        for (GpsDataProvider provider: getAllProviders()){
            if (isProviderActive(provider) && provider.handlesNmea()) return provider.getGpsData();
        }
        return null;
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

    public ArrayList<TrackWriter.TrackInfo> listTracks(){
        if (trackWriter == null) return new ArrayList<TrackWriter.TrackInfo>();
        return trackWriter.listTracks();
    }
    public File getTrackDir(){
        return trackDir;
    }

    public void deleteTrackFile(String name) throws Exception{
        File trackfile = new File(trackDir, name);
        if (! trackfile.isFile()){
            throw new Exception("track "+name+" not found");
        }
        else {
            trackfile.delete();
            if (mediaUpdater != null) mediaUpdater.triggerUpdateMtp(trackfile);
            if (name.endsWith(".gpx")){
                if (name.replace(".gpx","").equals(TrackWriter.getCurrentTrackname(new Date()))){
                    AvnLog.i("deleting current trackfile");
                    synchronized (this){
                        trackpoints=new ArrayList<Location>();
                    }
                }
            }
        }
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
            if (handler != null) {
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
        JSONArray rt = new JSONArray();
        JSONObject item=new JSONObject();
        item.put("name","Writer");
        if (trackWriter != null && lastTrackWrite != 0){
            item.put("info",trackpoints.size()+" points, writing to "+trackWriter.getTrackFile(new Date(lastTrackWrite)).getAbsolutePath());
            item.put("status",GpsDataProvider.STATUS_NMEA);
        }
        else {
            item.put("info","waiting");
            item.put("status",GpsDataProvider.STATUS_INACTIVE);
        }
        rt.put(item);
        JSONObject out = new JSONObject();
        out.put("name", "TrackWriter");
        out.put("items", rt);
        return out;
    }

    public RouteHandler getRouteHandler(){
        return routeHandler;
    }
}
