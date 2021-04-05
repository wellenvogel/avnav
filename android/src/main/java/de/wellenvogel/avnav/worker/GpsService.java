package de.wellenvogel.avnav.worker;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.location.Location;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Binder;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.support.v4.app.NotificationCompat;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.IOException;
import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationTargetException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import de.wellenvogel.avnav.appapi.ExtendedWebResourceResponse;
import de.wellenvogel.avnav.appapi.INavRequestHandler;
import de.wellenvogel.avnav.appapi.PostVars;
import de.wellenvogel.avnav.appapi.RequestHandler;
import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.Dummy;
import de.wellenvogel.avnav.main.IMediaUpdater;
import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.settings.AudioEditTextPreference;
import de.wellenvogel.avnav.settings.NmeaSettingsFragment;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.util.NmeaQueue;

/**
 * Created by andreas on 12.12.14.
 */
public class GpsService extends Service implements INmeaLogger, RouteHandler.UpdateReceiver, INavRequestHandler {


    private static final String CHANNEL_ID = "main" ;
    private static final String CHANNEL_ID_NEW = "main_new" ;
    public static String PROP_TRACKDIR="track.dir";


    private Context ctx;

    private final IBinder mBinder = new GpsServiceBinder();
    private boolean isRunning;  //this is our view whether we are running or not
                                //running means that we are registered for updates and have our timer active

    //properties
    private File trackDir=null;

    private NmeaLogger nmeaLogger;
    private Handler handler = new Handler();
    private long timerSequence=1;
    private Runnable runnable;
    private IMediaUpdater mediaUpdater;
    private static final int NOTIFY_ID=Constants.LOCALNOTIFY;
    private final Object loggerLock=new Object();
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

    private RouteHandler.RoutePoint lastAlarmWp=null;
    private final NmeaQueue queue=new NmeaQueue();
    long trackMintime;
    Alarm lastNotifiedAlarm=null;
    boolean notificationSend=false;
    private long alarmSequence=System.currentTimeMillis();
    private final ArrayList<IWorker> workers =new ArrayList<>();
    private final ArrayList<IWorker> internalWorkers=new ArrayList<>();
    private static final int MIN_WORKER_ID=10;
    private int workerId=MIN_WORKER_ID; //1-9 reserverd for fixed workers like decoder,...

    private final BroadcastReceiver usbReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context ctx, Intent intent) {

            if (intent.getAction().equals(UsbManager.ACTION_USB_DEVICE_DETACHED)) {
                UsbDevice dev = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
                if (dev != null) {
                    for (IWorker w : workers) {
                        if (w instanceof UsbConnectionHandler){
                            ((UsbConnectionHandler)w).deviceDetach(dev);
                        }
                    }
                }
            }
        }
    };
    boolean receiverRegistered=false;


    private static final String LOGPRFX="Avnav:GpsService";


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
        handler.post(runnable);
        sendBroadcast(new Intent(Constants.BC_RELOAD_DATA));

    }

    @Override
    public ExtendedWebResourceResponse handleDownload(String name, Uri uri) throws Exception {
        return null;
    }

    @Override
    public boolean handleUpload(PostVars postData, String name, boolean ignoreExisting) throws Exception {
        return false;
    }

    @Override
    public JSONArray handleList(Uri uri, RequestHandler.ServerInfo serverInfo) throws Exception {
        return null;
    }

    @Override
    public boolean handleDelete(String name, Uri uri) throws Exception {
        return false;
    }

    @Override
    public JSONObject handleApiRequest(Uri uri, PostVars postData, RequestHandler.ServerInfo serverInfo) throws Exception {
        String command=AvnUtil.getMandatoryParameter(uri,"command");
        if ("createHandler".equals(command)){
            String typeName=AvnUtil.getMandatoryParameter(uri,"handlerName");
            String config=postData.getAsString();
            addWorker(typeName,new JSONObject(config));
            return RequestHandler.getReturn();
        }
        if ("getAddables".equals(command)){
            List<String> names=WorkerFactory.getInstance().getKnownTypes(true);
            JSONArray data=new JSONArray(names);
            return RequestHandler.getReturn(new RequestHandler.KeyValue<JSONArray>("data",data));
        }
        if ("getAddAttributes".equals(command)){
            String typeName=AvnUtil.getMandatoryParameter(uri,"handlerName");
            try{
                IWorker w=WorkerFactory.getInstance().createWorker(typeName,this,null);
                return RequestHandler.getReturn(new RequestHandler.KeyValue<JSONArray>("data",w.getParameterDescriptions(null)));
            }catch (WorkerFactory.WorkerNotFound e){
                return RequestHandler.getErrorReturn("not handler of type "+typeName+" found");
            }
        }
        if ("canRestart".equals(command)){
            return RequestHandler.getReturn(new RequestHandler.KeyValue<Boolean>("canRestart",false));
        }
        int id=Integer.parseInt(AvnUtil.getMandatoryParameter(uri,"handlerId"));
        IWorker worker=findWorkerById(id);
        if (worker == null){
            return RequestHandler.getErrorReturn("worker with id "+id+" not found");
        }
        if ("getEditables".equals(command)){
            JSONObject rt=worker.getEditableParameters(true,this);
            rt.put("status","OK");
            return rt;
        }
        if ("setConfig".equals(command)){
            String config=postData.getAsString();
            updateWorkerConfig(worker,new JSONObject(config));
            return RequestHandler.getReturn();
        }
        if ("deleteHandler".equals(command)){
            if (! worker.getStatus().canDelete){
                return RequestHandler.getErrorReturn("handler "+id+" cannot be deleted");
            }
            deleteWorker(worker);
            return RequestHandler.getReturn();
        }
        return RequestHandler.getErrorReturn("invalid command "+command);
    }

    @Override
    public ExtendedWebResourceResponse handleDirectRequest(Uri uri, RequestHandler handler) throws Exception {
        return null;
    }

    @Override
    public String getPrefix() {
        return null;
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

    private static class WorkerConfig{
        Class wclass;
        int id;
        String configName;
        String typeName;
        WorkerConfig(String typeName,Class wclass,int id){
            this.wclass=wclass;
            this.id=id;
            this.configName="internal."+typeName;
            this.typeName=typeName;
        }
        IWorker createWorker(Context ctx,NmeaQueue queue) throws NoSuchMethodException, IllegalAccessException, InvocationTargetException, InstantiationException, IOException {
            Constructor<IWorker> ctor =wclass.getDeclaredConstructor(String.class,Context.class,NmeaQueue.class);
            return (IWorker)(ctor.newInstance(typeName,ctx,queue));
        }
    }

    private final WorkerConfig WDECODER=new WorkerConfig("Decoder",Decoder.class,1);
    private final WorkerConfig WROUTER=new WorkerConfig("Router",RouteHandler.class,2){
        @Override
        IWorker createWorker(Context ctx, NmeaQueue queue) throws NoSuchMethodException, IllegalAccessException, InvocationTargetException, InstantiationException, IOException {
            SharedPreferences prefs=getSharedPreferences(Constants.PREFNAME,Context.MODE_PRIVATE);
            File routeDir=new File(AvnUtil.getWorkDir(prefs,GpsService.this),"routes");
            RouteHandler rt=new RouteHandler(routeDir,GpsService.this);
            rt.setMediaUpdater(mediaUpdater);
            return rt;
        }
    };
    private final WorkerConfig WTRACK=new WorkerConfig("Track",TrackWriter.class,3){
        @Override
        IWorker createWorker(Context ctx, NmeaQueue queue) throws NoSuchMethodException, IllegalAccessException, InvocationTargetException, InstantiationException, IOException {
            SharedPreferences prefs=getSharedPreferences(Constants.PREFNAME,Context.MODE_PRIVATE);
            File newTrackDir=new File(AvnUtil.getWorkDir(prefs,GpsService.this),"tracks");
            TrackWriter rt=new TrackWriter(newTrackDir,mediaUpdater);
            return rt;
        }
    };
    private final WorkerConfig[] INTERNAL_WORKERS ={WDECODER,WROUTER,WTRACK};

    private synchronized int getNextWorkerId(){
        workerId++;
        return workerId;
    }
    private synchronized IWorker findWorkerById(int id){
        if (id >= MIN_WORKER_ID) {
            for (IWorker w : workers) {
                if (w.getId() == id) return w;
            }
        }
        else {
            for (IWorker w : internalWorkers) {
                if (w.getId() == id) return w;
            }
        }
        return null;
    }
    private JSONArray getWorkerConfig() throws JSONException {
        SharedPreferences prefs=getSharedPreferences(Constants.PREFNAME,Context.MODE_PRIVATE);
        String config=prefs.getString(Constants.HANDLER_CONFIG,null);
        JSONArray rt=null;
        boolean hasNewConfig=false;
        if (config != null){
            hasNewConfig=true;
            try{
                rt=new JSONArray(config);
            }catch (Throwable t){
                AvnLog.e("unable to parse Handler config "+config,t);
            }
        }
        if (rt != null) {
            //ensure to have the internal handler in any case
            //ans make some checks
            boolean hasInternal=false;
            for (int i=0;i<rt.length();i++){
                try {
                    JSONObject o = rt.getJSONObject(i);
                    if (Worker.TYPENAME_PARAMETER.fromJson(o).equals(WorkerFactory.ANDROID_NAME)){
                        hasInternal=true;
                    }
                }catch(Throwable t){
                    AvnLog.e("error parsing handler config",t);
                    rt=null;
                    break;
                }
            }
            if (rt != null && ! hasInternal){
                JSONObject intGps=new JSONObject();
                intGps.put(Worker.TYPENAME_PARAMETER.name,WorkerFactory.ANDROID_NAME);
                rt.put(intGps);
            }
            if (rt != null) return rt;
        }
        rt=new JSONArray();
        if (! hasNewConfig) {
            //TODO: migrate from old config
        }
        JSONObject h1=new JSONObject();
        h1.put(Worker.TYPENAME_PARAMETER.name,WorkerFactory.ANDROID_NAME);
        rt.put(h1);
        prefs.edit().putString(Constants.HANDLER_CONFIG,rt.toString()).apply();
        return rt;
    }

    private Decoder getDecoder(){
        IWorker decoder=findWorkerById(WDECODER.id);
        return (Decoder)decoder;
    }
    public RouteHandler getRouteHandler(){
        IWorker handler=findWorkerById(WROUTER.id);
        return (RouteHandler)handler;
    }
    public TrackWriter getTrackWriter(){
        IWorker writer=findWorkerById(WTRACK.id);
        return (TrackWriter)writer;
    }

    private void saveWorkerConfig(IWorker worker) throws JSONException {
        SharedPreferences prefs = getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor edit=prefs.edit();
        if (worker == null || worker.getId() >= MIN_WORKER_ID) {
            JSONArray newConfig = new JSONArray();
            for (IWorker w : workers) {
                JSONObject wc = w.getConfig();
                wc.put(Worker.TYPENAME_PARAMETER.name, w.getTypeName());
                newConfig.put(wc);
            }
            edit.putString(Constants.HANDLER_CONFIG, newConfig.toString());
        }
        else if (worker != null){
            for (WorkerConfig cfg: INTERNAL_WORKERS){
                if (cfg.id == worker.getId()){
                    JSONObject jo=worker.getConfig();
                    edit.putString(cfg.configName,jo.toString());
                    break;
                }
            }
        }
        edit.commit();
    }
    private synchronized void updateWorkerConfig(IWorker worker, JSONObject newConfig) throws JSONException {
        worker.setParameters(newConfig, false);
        worker.start(); //will restart
        saveWorkerConfig(worker);
    }
    private synchronized void addWorker(String typeName, JSONObject newConfig) throws WorkerFactory.WorkerNotFound, JSONException, IOException {
        IWorker newWorker=WorkerFactory.getInstance().createWorker(typeName,this,queue);
        newWorker.setId(getNextWorkerId());
        newWorker.setParameters(newConfig, true);
        newWorker.start();
        String currentType=null;
        boolean inserted=false;
        for (int i=0;i<workers.size();i++){
            if (typeName.equals(currentType) && !workers.get(i).getTypeName().equals(typeName)){
                inserted=true;
                workers.add(i,newWorker);
                break;
            }
        }
        if (! inserted){
            workers.add(newWorker);
        }
        saveWorkerConfig(newWorker);
    }
    private synchronized void deleteWorker(IWorker worker) throws JSONException {
        worker.stop();
        int workerId=-1;
        for (int i=0;i<workers.size();i++){
            if (worker.getId() == workers.get(i).getId()){
                workerId=i;
                break;
            }
        }
        if (workerId >= 0){
            workers.remove(workerId);
        }
        saveWorkerConfig(worker);
    }
    private void stopWorkers(){
        for (IWorker w: workers){
            try{
                w.stop();
            }catch (Throwable t){
                AvnLog.e("unable to stop worker "+w.getStatus().toString());
            }
        }
        workers.clear();
        for (IWorker w: internalWorkers){
            try{
                w.stop();
            }catch (Throwable t){
                AvnLog.e("unable to stop worker "+w.getStatus().toString());
            }
        }
        internalWorkers.clear();
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
        if (! isWatchdog) stopWorkers();
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
        if (! isWatchdog || runnable == null) {
            runnable = new TimerRunnable(timerSequence);
            handler.postDelayed(runnable, trackMintime);
        }
        if (! receiverRegistered) {
            registerReceiver(usbReceiver, new IntentFilter(UsbManager.ACTION_USB_DEVICE_DETACHED));
            receiverRegistered=true;
        }
        if (! isWatchdog || internalWorkers.size() == 0) {
            for (WorkerConfig cfg : INTERNAL_WORKERS){
                try {
                    IWorker worker=cfg.createWorker(this,queue);
                    worker.setId(cfg.id);
                    String parameters=prefs.getString(cfg.configName,null);
                    if (parameters != null){
                        try{
                            JSONObject po=new JSONObject(parameters);
                            worker.setParameters(po,true);
                        }catch (JSONException e){
                            //all internal workers must be able to run with empty parameters
                            AvnLog.e("error parsing decoder parameters",e);
                        }
                    }
                    worker.start();
                    internalWorkers.add(worker);
                } catch (Throwable t) {
                    AvnLog.e("unable to create worker "+cfg.typeName,t);
                    Toast.makeText(this,"Unable to create "+cfg.typeName+": "+t.getMessage(),Toast.LENGTH_LONG).show();
                }

            }
        }
        if (! isWatchdog || workers.size() == 0) {
            try {
                JSONArray handlerConfig = getWorkerConfig();
                for (int i = 0; i < handlerConfig.length(); i++) {
                    try {
                        JSONObject config = handlerConfig.getJSONObject(i);
                        IWorker worker = WorkerFactory.getInstance().createWorker(
                                Worker.TYPENAME_PARAMETER.fromJson(config), this, queue);
                        worker.setId(getNextWorkerId());
                        worker.setParameters(config, true);
                        worker.start();
                        workers.add(worker);
                    } catch (Throwable t) {
                        AvnLog.e("unable to create handler " + i, t);
                    }
                }
            } catch (Throwable t) {
                AvnLog.e("unable to create channels", t);
            }
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
                RouteHandler routeHandler=getRouteHandler();
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
            try {
                timerAction();
            } catch (JSONException e) {
                AvnLog.e("error in timer",e);
            }
            handler.postDelayed(this, trackMintime);
        }
    }

    public void timerAction() throws JSONException {
        checkAnchor();
        checkApproach();
        checkMob();
        handleNotification(true,false);
        checkTrackWriter();
        for (IWorker w: workers) {
            if (w != null) {
                try {
                    w.check();
                } catch (JSONException e) {
                    AvnLog.e("error in check for "+w.getTypeName());
                }
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

    private void checkAnchor() throws JSONException {
        RouteHandler routeHandler=getRouteHandler();
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
    private void checkApproach() throws JSONException {
        RouteHandler routeHandler=getRouteHandler();
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
        RouteHandler routeHandler=getRouteHandler();
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
        stopWorkers();
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
    private void checkTrackWriter() throws JSONException {
        if (! isRunning) return;
        Location l=getLocation();
        TrackWriter trackWriter=getTrackWriter();
        if (trackWriter != null) trackWriter.checkWrite(l,mediaUpdater);

    }

    /**
     * get the current track
     * @param maxnum - max number of points (including the newest one)
     * @param interval - min time distance between 2 points
     * @return the track points in inverse order, i.e. the newest is at index 0
     */
    public synchronized  ArrayList<Location> getTrack(int maxnum, long interval){
        ArrayList<Location> rt=new ArrayList<Location>();
        TrackWriter trackWriter=getTrackWriter();
        if (trackWriter == null) return rt;
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
        Decoder dec=getDecoder();
        JSONObject rt=dec!=null?dec.getGpsData():null;
        if (rt == null){
            rt=new JSONObject();
        }
        rt.put("updatealarm",alarmSequence);
        long legSequence=-1;
        RouteHandler routeHandler=getRouteHandler();
        if (routeHandler != null) legSequence=routeHandler.getLegSequence();
        rt.put("updateleg",legSequence);
        return rt;
    }

    private Location getLocation() throws JSONException {
        Decoder dec=getDecoder();
        return dec!=null?dec.getLocation():null;
    }

    public JSONArray getAisData(double lat,double lon, double distance){
        Decoder dec=getDecoder();
        return dec != null?dec.getAisData(lat,lon,distance):null;
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
    public JSONObject getNmeaStatus() throws JSONException {
        JSONObject nmea = new JSONObject();
        nmea.put("source", "unknown");
        nmea.put("status", "red");
        nmea.put("info", "disabled");
        JSONObject ais = new JSONObject();
        ais.put("source", "unknown");
        ais.put("status", "red");
        ais.put("info", "disabled");
        Decoder decoder=getDecoder();
        if (decoder != null) {
            Decoder.SatStatus st = decoder.getSatStatus();
            Location loc = decoder.getLocation();
            String addr = "decoder";
            nmea.put("source", decoder.getSourceName());
            if (loc != null) {
                nmea.put("status", "green");
                nmea.put("info", "(" + addr + ") sats: " + st.numSat + " / " + st.numUsed);
            } else {
                if (st.gpsEnabled) {
                    nmea.put("info", "(" + addr + ") con, sats: " + st.numSat + " / " + st.numUsed);
                    nmea.put("status", "yellow");
                } else {
                    nmea.put("info", "(" + addr + ") disconnected");
                    nmea.put("status", "red");
                }
            }
            ais.put("source", addr);
            int aisTargets = decoder.numAisData();
            if (aisTargets > 0) {
                ais.put("status", "green");
                ais.put("info", "(" + addr + "), " + aisTargets + " targets");
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
        JSONObject rt = new JSONObject();
        rt.put("nmea", nmea);
        rt.put("ais", ais);
        return rt;
    }
    public JSONArray getStatus() throws JSONException {
        JSONArray rt=new JSONArray();
        for (IWorker w : workers){
            rt.put(w.getJsonStatus());
        }
        for (IWorker w: internalWorkers){
            rt.put(w.getJsonStatus());
        }
        return rt;
    }

}
