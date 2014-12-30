package de.wellenvogel.avnav.gps;

import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.location.*;
import android.os.Binder;
import android.os.Handler;
import android.os.IBinder;
import android.util.Log;
import de.wellenvogel.avnav.main.AvNav;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.text.DecimalFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.Timer;
import java.util.TimerTask;

/**
 * Created by andreas on 12.12.14.
 */
public class GpsService extends Service  {

    public static String PROP_TRACKINTERVAL="track.interval";
    public static String PROP_TRACKDIR="track.dir";
    public static String PROP_TRACKDISTANCE="track.distance";
    public static String PROP_TRACKMINTIME="track.mintime";
    public static String PROP_TRACKTIME="track.time";
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

    private boolean isRunning;  //this is our view whether we are running or not
                                //running means that we are registered for updates and have our timer active

    //properties
    private File trackDir=null;
    private long trackInterval; //interval for writing out the xml file
    private long trackDistance; //min distance in m
    private long trackMintime; //min interval between 2 points
    private long trackTime;   //length of track
    private boolean useInternalProvider=false;
    private boolean ipNmea=false;
    private boolean ipAis=false;

    private TrackWriter trackWriter;
    private Handler handler = new Handler();
    private long timerSequence=1;
    private Runnable runnable;
    //location data


    private static final String LOGPRFX="Avnav:GpsService";

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

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        super.onStartCommand(intent,flags,startId);
        if (intent != null && intent.getBooleanExtra(PROP_CHECKONLY,false)){
            return Service.START_REDELIVER_INTENT;
        }
        String trackdir=intent.getStringExtra(PROP_TRACKDIR);
        //we rely on the activity to check before...
        File newTrackDir=new File(trackdir);
        boolean loadTrack=true;
        if (trackDir != null && trackDir.getAbsolutePath().equals(newTrackDir.getAbsolutePath())){
            //seems to be a restart - so do not load again
            loadTrack=false;
            Log.d(LOGPRFX,"restart: do not load track data");
        }

        trackInterval=intent.getLongExtra(PROP_TRACKINTERVAL,300000);
        trackDistance=intent.getLongExtra(PROP_TRACKDISTANCE,25);
        trackMintime=intent.getLongExtra(PROP_TRACKMINTIME,10000); //not used
        trackTime=intent.getLongExtra(PROP_TRACKTIME,25*60*60*1000); //25h - to ensure that we at least have the whole day...
        SharedPreferences prefs=getSharedPreferences(AvNav.PREFNAME,Context.MODE_PRIVATE);
        useInternalProvider=prefs.getBoolean(AvNav.INTERNALGPS,true);
        ipAis=prefs.getBoolean(AvNav.IPAIS,false);
        ipNmea=prefs.getBoolean(AvNav.IPNMEA,false);
        Log.d(LOGPRFX,"started with dir="+trackdir+", interval="+(trackInterval/1000)+
                ", distance="+trackDistance+", mintime="+(trackMintime/1000)+
                ", maxtime(h)="+(trackTime/3600/1000)+
                ", internalGps="+useInternalProvider+
                ", ipNmea="+ipNmea+
                ", ipAis="+ipAis);
        trackDir = new File(trackdir);
        if (loadTrack) {
            Thread readThread=new Thread(new Runnable() {
                @Override
                public void run() {
                    ArrayList<Location> filetp=new ArrayList<Location>();
                    //read the track data from today and yesterday
                    //we rely on the cleanup to handle outdated entries
                    trackWriter = new TrackWriter(trackDir);
                    long mintime = System.currentTimeMillis() - trackTime;
                    Date dt = new Date();
                    lastTrackWrite = dt.getTime();
                    ArrayList<Location> rt = trackWriter.parseTrackFile(new Date(dt.getTime() - 24 * 60 * 60 * 1000), mintime, trackDistance);
                    filetp.addAll(rt);
                    rt = trackWriter.parseTrackFile(dt, mintime, trackDistance);
                    if (rt.size() == 0) {
                        //empty track file - trigger write very soon
                        lastTrackWrite = 0;
                    }
                    filetp.addAll(rt);
                    synchronized (this) {
                        ArrayList<Location> newTp=trackpoints;
                        trackpoints=filetp;
                        trackpoints.addAll(newTp);
                    }
                    Log.d(LOGPRFX, "read " + trackpoints.size() + " trackpoints from files");
                }
            });
            readThread.start();
            timerSequence++;
            runnable=new TimerRunnable(timerSequence);
            handler.postDelayed(runnable, trackMintime);
        }
        if (useInternalProvider){
            if (internalProvider == null) {
                Log.d(LOGPRFX,"start internal provider");
                internalProvider=new AndroidPositionHandler(this);
            }
        }
        else {
            if (internalProvider != null){
                Log.d(LOGPRFX,"stopping internal provider");
                internalProvider.stop();
                internalProvider=null;
            }
        }
        if (ipAis || ipNmea){
            if (externalProvider == null){
                try {
                    InetSocketAddress addr = GpsDataProvider.convertAddress(prefs.getString(AvNav.IPADDR, ""),
                            prefs.getString(AvNav.IPPORT, ""));
                    Log.d(LOGPRFX,"starting external receiver for "+addr.toString());
                    GpsDataProvider.Properties prop=new GpsDataProvider.Properties();
                    prop.aisCleanupInterval=prefs.getLong(AvNav.IPAISCLEANUPIV,prop.aisCleanupInterval);
                    prop.aisLifetime=prefs.getLong(AvNav.IPAISLIFETIME,prop.aisLifetime);
                    prop.postionAge=prefs.getLong(AvNav.IPPOSAGE,prop.postionAge);
                    prop.connectTimeout=prefs.getInt(AvNav.IPCONNTIMEOUT,prop.connectTimeout);
                    prop.readAis=ipAis;
                    prop.readNmea=ipNmea;
                    externalProvider=new IpPositionHandler(this,addr,prop);
                }catch (Exception i){
                    Log.e(LOGPRFX,"unable to start external service");
                }

            }
        }
        else{
            if (externalProvider != null){
                Log.d(LOGPRFX,"stopping external service");
                externalProvider.stop();
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
            checkTrackWriter();
            if (internalProvider != null) internalProvider.check();
            if (externalProvider != null) externalProvider.check();
    }

    /**
     * will be called whe we intend to really stop
     */
    private void handleStop(){
        if (internalProvider != null){
            internalProvider.stop();
            internalProvider=null;
        }
        if (externalProvider != null){
            externalProvider.stop();
            externalProvider=null;
        }
        if (trackpoints.size() > 0){
            try {
                trackWriter.writeTrackFile(trackpoints, new Date(),false);
                AvNav.updateMtp(trackWriter.getTrackFile(new Date()),this);
            } catch (FileNotFoundException e) {
                Log.d(LOGPRFX,"Exception while finally writing trackfile: "+e.getLocalizedMessage());
            }
        }
        trackpoints.clear();
        trackDir=null;
        isRunning=false;
        Log.d(LOGPRFX,"service stopped");
    }

    public void stopMe(){
        handleStop();
        stopSelf();
    }

    @Override
    public void onDestroy()
    {
        super.onDestroy();
        handleStop();

    }


    /**
     * will be called from within the timer thread
     * check if position has changed and write track entries
     * write out the track file in regular intervals
     */
    private void checkTrackWriter(){
        if (! isRunning) return;
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
                    Log.d(LOGPRFX, "add location to log " + l.getLatitude() + "," + l.getLongitude() + ", distance=" + distance);
                    Location nloc = new Location(l);
                    nloc.setTime(current);
                    trackpoints.add(nloc);
                }
            }
            //now check if we should write out
            if (current > (lastTrackWrite + trackInterval) && trackpoints.size() != lastTrackCount) {
                Log.d(LOGPRFX, "start writing track");
                //cleanup
                int deleted = 0;
                long deleteTime = current - trackTime;
                Log.d(LOGPRFX, "deleting trackpoints older " + new Date(deleteTime).toString());
                while (trackpoints.size() > 0) {
                    Location first = trackpoints.get(0);
                    if (first.getTime() < deleteTime) {
                        trackpoints.remove(0);
                        deleted++;
                    } else break;
                }
                Log.d(LOGPRFX, "deleted " + deleted + " trackpoints");
                writeOut=true;
            }
        }
        if (writeOut) {
            ArrayList<Location> w=getTrackCopy();
            lastTrackCount = w.size();
            lastTrackWrite = current;
            try {
                //we have to be careful to get a copy when having a lock
                trackWriter.writeTrackFile(w, new Date(current), true);
            } catch (IOException io) {

            }
            //trigger the MTP update here (even if we are not done yet)
            AvNav.updateMtp(trackWriter.getTrackFile(new Date(current)),this);

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
        Log.d(LOGPRFX,"getTrack returns "+num+" points");
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
        if (internalProvider == null) {
            if (externalProvider != null) return externalProvider.getSatStatus();
            return rt;
        }
        rt=internalProvider.getSatStatus();
        Log.d(LOGPRFX,"getSatStatus returns "+rt);
        return rt;
    }

    public GpsDataProvider.SatStatus getExternalStatus(){
        GpsDataProvider.SatStatus rt=new GpsDataProvider.SatStatus(0,0);
        if (! isRunning) return rt;
        if (externalProvider != null) return externalProvider.getSatStatus();
        return rt;
    }

    public JSONObject getGpsData() throws JSONException{
        if (internalProvider != null) return internalProvider.getGpsData();
        if (externalProvider != null) return externalProvider.getGpsData();
        return null;
    }

    private Location getLocation(){
        if (internalProvider != null) return internalProvider.getLocation();
        if (externalProvider != null) return externalProvider.getLocation();
        return null;
    }

    public JSONArray getAisData(double lat,double lon, double distance){
        if (externalProvider == null) return new JSONArray();
        return externalProvider.getAisData(lat,lon,distance);
    }


}
