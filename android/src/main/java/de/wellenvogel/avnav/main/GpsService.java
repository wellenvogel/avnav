package de.wellenvogel.avnav.main;

import android.app.AlertDialog;
import android.app.Service;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.location.Criteria;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Binder;
import android.os.Bundle;
import android.os.IBinder;
import android.provider.Settings;
import android.util.Log;
import android.widget.Toast;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Date;
import java.util.Timer;
import java.util.TimerTask;

/**
 * Created by andreas on 12.12.14.
 */
public class GpsService extends Service implements LocationListener {

    public static String PROP_TRACKINTERVAL="track.interval";
    public static String PROP_TRACKDIR="track.dir";
    public static String PROP_TRACKDISTANCE="track.distance";
    public static String PROP_TRACKMINTIME="track.mintime";
    public static String PROP_TRACKTIME="track.time";
    private static final long MAXLOCAGE=10000; //max age of location in milliseconds
    private static final long MAXLOCWAIT=2000; //max time we wait until we explicitely query the location again


    private static Timer timer =null;
    private Context ctx;
    private long writerInterval=0;
    private String outfile=null;
    private ArrayList<Location> trackpoints=new ArrayList<Location>();
    private long lastTrackWrite=0;
    private long lastTrackCount;
    private final IBinder mBinder = new GpsServiceBinder();

    //properties
    private File trackDir;
    private long trackInterval; //interval for writing out the xml file
    private long trackDistance; //min distance in m
    private long trackMintime; //min interval between 2 points
    private long trackTime;   //length of track

    private TrackWriter trackWriter;
    //location data
    private LocationManager locationService;
    private Location location=null;
    private String currentProvider;
    private long lastValidLocation=0;


    private static final String LOGPRFX="Avnav:GpsService";

    class GpsServiceBinder extends Binder{
      GpsService getService(){
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
        String trackdir=intent.getStringExtra(PROP_TRACKDIR);
        //we rely on the activity to check before...
        trackDir=new File(trackdir);
        trackInterval=intent.getLongExtra(PROP_TRACKINTERVAL,300000);
        trackDistance=intent.getLongExtra(PROP_TRACKDISTANCE,25);
        trackMintime=intent.getLongExtra(PROP_TRACKMINTIME,10000); //not used
        trackTime=intent.getLongExtra(PROP_TRACKTIME,25*60*60*1000); //25h - to ensure that we at least have the whole day...
        Log.d(LOGPRFX,"started with dir="+trackdir+", interval="+(trackInterval/1000)+", distance="+trackDistance+", mintime="+(trackMintime/1000)+", maxtime(h)="+(trackTime/3600/1000));
        //read the track data from today and yesterday
        //we rely on the cleanup to handle outdated entries
        trackWriter=new TrackWriter(trackDir);
        long mintime=System.currentTimeMillis()-trackTime;
        Date dt=new Date();
        lastTrackWrite=dt.getTime();
        ArrayList<Location> rt=trackWriter.parseTrackFile(new Date(dt.getTime()-24*60*60*1000),mintime);
        trackpoints.addAll(rt);
        rt=trackWriter.parseTrackFile(dt,mintime);
        if (rt.size() == 0){
            //empty track file - trigger write very soon
            lastTrackWrite=0;
        }
        trackpoints.addAll(rt);
        Log.d(LOGPRFX,"read "+trackpoints.size()+" trackpoints from files");
        startTimer();
        checkLocationService();
        return Service.START_REDELIVER_INTENT;
    }
    public void onCreate()
    {
        super.onCreate();
        ctx = this;

    }

    /**
     * start a timer for writing out the track
     */
    private void startTimer()
    {
        if (timer != null) {
            try {
                timer.cancel();
            } catch (Exception e) {
                Log.d(LOGPRFX, "cancel timer failed");
            }
        }
        timer=new Timer();
        timer.scheduleAtFixedRate(new timerTask(), 0, trackInterval);
    }

    private class timerTask extends TimerTask
    {
        public void run()
        {
            Log.d(LOGPRFX,"timer fired");
           // checkTrackWriter(GpsService.this.location);
        }
    }
    @Override
    public void onDestroy()
    {
        super.onDestroy();
        locationService.removeUpdates(this);
        location=null;
        lastValidLocation=0;
        if (trackpoints.size() > 0){
            try {
                trackWriter.writeTrackFile(trackpoints, new Date(),false);
            } catch (FileNotFoundException e) {
                Log.d(LOGPRFX,"Exception while finally writing trackfile: "+e.getLocalizedMessage());
            }
        }
        Log.d(LOGPRFX,"service stopped");
        //Toast.makeText(this, "Location Service Stopped ...", Toast.LENGTH_SHORT).show();
    }

    private void checkLocationService(){
        //location services
        locationService = (LocationManager) getSystemService(LOCATION_SERVICE);
        boolean enabled = locationService.isProviderEnabled(LocationManager.GPS_PROVIDER);
        if (enabled){
            tryEnableLocation();
        }

    }



    @Override
    public void onLocationChanged(Location location) {
        Log.d(LOGPRFX, "location: changed, acc=" + location.getAccuracy() + ", provider=" + location.getProvider() +
                ", date=" + new Date((location != null) ? location.getTime() : 0).toString());
        this.location=new Location(location);
        lastValidLocation=System.currentTimeMillis();
        checkTrackWriter(this.location);
    }

    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {
        Log.d(LOGPRFX,"location: status changed for "+provider+", new status="+status);
        tryEnableLocation();
    }

    @Override
    public void onProviderEnabled(String provider) {
        Log.d(LOGPRFX,"location: provider enabled "+provider);
        tryEnableLocation();
    }

    @Override
    public void onProviderDisabled(String provider) {
        Log.d(LOGPRFX,"location: provider disabled "+provider);
        tryEnableLocation();
    }

    private synchronized void tryEnableLocation(){
        if (locationService.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
            Criteria criteria = new Criteria();
            currentProvider = locationService.getBestProvider(criteria, false);
            if (currentProvider != null) {
                locationService.requestLocationUpdates(currentProvider, 400, 1, this);
                location = locationService.getLastKnownLocation(currentProvider);
                if (location != null) lastValidLocation=System.currentTimeMillis();
                Log.d(LOGPRFX,"location: location provider="+currentProvider+" location acc="+((location != null)?location.getAccuracy():"<null>")+", date="+new Date((location!=null)?location.getTime():0).toString());
            }
            else{
                Log.d(LOGPRFX,"location: no location provider");
                Toast.makeText(this, "no location provider ",
                        Toast.LENGTH_SHORT).show();
                location=null;
                lastValidLocation=0;
                currentProvider=null;
            }
        }
        else {
            Log.d(LOGPRFX,"location: no gps");
            location=null;
            lastValidLocation=0;
            Toast.makeText(this, "no gps ",
                    Toast.LENGTH_SHORT).show();
            currentProvider=null;
        }
    }

    /**
     * get the current location checking for a recent update
     * we do not directly compare our system time with the location time as this would break test data at all
     * instead we check that the time elapsed since the last location update is not too far away from the really elapsed time
     * //TODO: should we make this tread safe?
     * @return
     */
    Location getCurrentLocation(){
        Location curloc=location;
        if (curloc == null) return null;
        long currtime=System.currentTimeMillis();
        if ((currtime - lastValidLocation) > MAXLOCWAIT){
            //no location update during this time - query directly
            if (currentProvider == null){
                Log.d(LOGPRFX,"location: too old to return and no provider");
                return null;
            }
            Location nlocation = locationService.getLastKnownLocation(currentProvider);
            if (nlocation == null){
                location=null;
                Log.d(LOGPRFX,"location: now new location for too old location");
                return null;
            }
            //the diff in location times must not be too far away from the really elapsed time
            //we assume at least MAXLOCAGE
            long locdiff=nlocation.getTime()-curloc.getTime();
            if (locdiff < (currtime - lastValidLocation - MAXLOCAGE)){
                Log.d(LOGPRFX,"location: location updates too slow - only "+(locdiff/1000)+" seconds for time diff "+(currtime-lastValidLocation)/1000);
                return null;
            }
            Log.d(LOGPRFX,"location: refreshed location successfully");
            location=nlocation;
            lastValidLocation=lastValidLocation+(long)Math.floor(locdiff*1.1); //we allow the gps to be 10% slower than realtime
        }
        return location;
    }

    /**
     * will be called from within the timer thread and from position updates
     * @param l
     */
    private void checkTrackWriter(Location l){
        boolean writeOut=false;
        long current = System.currentTimeMillis();
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
}
