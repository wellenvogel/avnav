package de.wellenvogel.avnav.worker;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.pm.PackageManager;
import android.location.*;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;

import net.sf.marineapi.nmea.parser.SentenceFactory;
import net.sf.marineapi.nmea.sentence.GSASentence;
import net.sf.marineapi.nmea.sentence.GSVSentence;
import net.sf.marineapi.nmea.sentence.RMCSentence;
import net.sf.marineapi.nmea.sentence.TalkerId;
import net.sf.marineapi.nmea.util.DataStatus;
import net.sf.marineapi.nmea.util.FaaMode;
import net.sf.marineapi.nmea.util.GpsFixStatus;
import net.sf.marineapi.nmea.util.Position;
import net.sf.marineapi.nmea.util.SatelliteInfo;

import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.settings.SettingsActivity;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.util.MovingSum;
import de.wellenvogel.avnav.util.NmeaQueue;

import org.json.JSONException;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.TimeZone;
import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;


/**
 * Created by andreas on 12.12.14.
 */
public class AndroidPositionHandler extends ChannelWorker implements LocationListener , GpsStatus.Listener {


    private static final long MAXLOCWAIT=2000; //max time we consider a location to be valid
    private static final long CHECKTIME=900; //if there was no location update for this time - query

    //location data
    private LocationManager locationService;
    private Location location=null;
    private String currentProvider=LocationManager.GPS_PROVIDER;
    private long lastValidLocation=0;
    private long lastRmc=0;
    private boolean isRegistered=false;
    private Handler handler=new Handler(Looper.getMainLooper());


    private static final String LOGPRFX="Avnav:AndroidPositionHandler";
    private boolean stopped=true;
    private Thread satStatusProvider;
    private String[] nmeaFilter=new String[0];
    MovingSum receiveCounter=new MovingSum(10);
    private synchronized void addNmea(String nmea){
        String[] filter=nmeaFilter; //atomic
        nmea=nmea.trim();
        if (!AvnUtil.matchesNmeaFilter(nmea,filter)) return;
        if (nmea.length()>= 6){
            if (nmea.substring(3,6).equals("RMC")){
                //we assume RMC means valid location
                long now=SystemClock.uptimeMillis();
                lastValidLocation=now;
                lastRmc=now;
            }
        }
        receiveCounter.add(1);
        int priority=getPriority(PRIORITY_PARAMETER);
        queue.add(nmea,getSourceName(),priority);
    }
    private OnNmeaMessageListener onNmeaListener;
    private GpsStatus.NmeaListener nmeaListener;
    private LocationListener locationListener=new LocationListener() {
        @Override
        public void onLocationChanged(@NonNull Location location) {
            AndroidPositionHandler.this.onLocationChanged(location);
        }

        @Override
        public void onStatusChanged(String provider, int status, Bundle extras) {
            AndroidPositionHandler.this.onStatusChanged(provider, status, extras);
        }

        @Override
        public void onProviderEnabled(@NonNull String provider) {
            AndroidPositionHandler.this.onProviderEnabled(provider);
        }

        @Override
        public void onProviderDisabled(@NonNull String provider) {
            AndroidPositionHandler.this.onProviderDisabled(provider);
        }
    };

    private final Executor executor= Executors.newFixedThreadPool(1);
    private EditableParameter.StringParameter filterParameter;
    private static EditableParameter.IntegerParameter PRIORITY_PARAMETER= SOURCE_PRIORITY_PARAMETER.clone(40);
    AndroidPositionHandler(String name, GpsService ctx, NmeaQueue queue) {
        super(name,ctx,queue);
        filterParameter= FILTER_PARAM.clone("$RMC,$GGA,$GSV,$GSA,$GLL");
        filterParameter.description=filterParameter.description+"\nThis filter allows only the mentioned sentences to pass from Android to AvNav";
        parameterDescriptions.addParams(
                ENABLED_PARAMETER,
                SOURCENAME_PARAMETER,
                PRIORITY_PARAMETER,
                filterParameter
                );
        status.canEdit=true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            this.onNmeaListener= new OnNmeaMessageListener() {
                @Override
                public void onNmeaMessage(String message, long timestamp) {
                    AvnLog.i("ANDROID NMEA",message);
                    AndroidPositionHandler.this.addNmea(message);
                }
            };
        }
        else{
            this.nmeaListener=new GpsStatus.NmeaListener() {
                @Override
                public void onNmeaReceived(long timestamp, String nmea) {
                    AvnLog.i("ANDROID NMEA",nmea);
                    AndroidPositionHandler.this.addNmea(nmea);
                }
            };
        }
    }

    public static class Creator extends WorkerFactory.Creator{
        @Override
        ChannelWorker create(String name, GpsService ctx, NmeaQueue queue) {
            return new AndroidPositionHandler(name,ctx,queue);
        }
        @Override
        boolean canAdd(GpsService ctx) {
            return false;
        }
    }

    private void checkBackgroundGps(){
        boolean backgroundOk= SettingsActivity.checkPowerSavingMode(gpsService);
        if (! backgroundOk){
            status.setChildStatus("background", WorkerStatus.Status.ERROR,gpsService.getString(R.string.backgroundGpsDisabled));
        }
        else{
            status.setChildStatus("background", WorkerStatus.Status.NMEA,gpsService.getString(R.string.backgroundGpsEnabled));
        }
    }

    @Override
    public void run(int startSequence) throws JSONException, IOException {
        nmeaFilter=AvnUtil.splitNmeaFilter(filterParameter.fromJson(parameters));
        stopped=false;
        locationService=(LocationManager) gpsService.getSystemService(gpsService.LOCATION_SERVICE);
        tryEnableLocation();
        checkBackgroundGps();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
            satStatusProvider = new Thread(new Runnable() {
                @Override
                public void run() {
                    int priority=getPriority(PRIORITY_PARAMETER);
                    SentenceFactory sf = SentenceFactory.getInstance();
                    while (!shouldStop(startSequence)) {
                        try {
                            int numSat = 0;
                            GpsStatus status = null;
                            status=locationService.getGpsStatus(null);
                            ArrayList<SatelliteInfo> sats = new ArrayList<SatelliteInfo>();
                            ArrayList<String> fixSats = new ArrayList<String>();
                            for (GpsSatellite s : status.getSatellites()) {
                                numSat++;
                                if (s.usedInFix() && fixSats.size() < 12)
                                    fixSats.add(String.format("%02d", s.getPrn()));
                                SatelliteInfo sat = new SatelliteInfo(String.format("%02d", s.getPrn()),
                                        (int) Math.round(Math.toDegrees(s.getElevation())),
                                        (int) Math.round(Math.toDegrees(s.getAzimuth())),
                                        (int) Math.round(10 * Math.log10(s.getSnr()))
                                );
                                sats.add(sat);
                            }
                            int numGsv = (numSat + 3) / 4;
                            for (int i = 0; i < numGsv; i++) {
                                GSVSentence gsv = (GSVSentence) sf.createParser(TalkerId.GP, "GSV");
                                gsv.setSentenceCount(numGsv);
                                gsv.setSentenceIndex(i + 1);
                                gsv.setSatelliteCount(numSat);
                                ArrayList<SatelliteInfo> glist = new ArrayList<SatelliteInfo>();
                                for (int j = i * 4; j < (i + 1) * 4 && j < numSat; j++) {
                                    glist.add(sats.get(j));
                                }
                                gsv.setSatelliteInfo(glist);
                                queue.add(gsv.toSentence(), getSourceName(),priority);
                            }
                            Location loc = location;
                            if (loc != null && (SystemClock.uptimeMillis() <= (lastValidLocation + MAXLOCWAIT))) {
                                GSASentence gsa = (GSASentence) sf.createParser(TalkerId.GP, "GSA");
                                gsa.setMode(FaaMode.AUTOMATIC);
                                gsa.setFixStatus(GpsFixStatus.GPS_3D);
                                String[] fsats = new String[fixSats.size()];
                                fsats = fixSats.toArray(fsats);
                                gsa.setSatelliteIds(fsats);
                                //TODO: XDOP
                                queue.add(gsa.toSentence(), getSourceName(),priority);
                            }
                        } catch (Throwable t) {
                            AvnLog.e("error in sat status loop", t);
                        }
                        if (!sleep(1000)) break;
                    }
                    AvnLog.i("sat status thread stopped");
                }
            });
            satStatusProvider.setDaemon(true);
            satStatusProvider.start();
        }
        while (! shouldStop(startSequence)){
            receiveCounter.add(0);
            boolean hasData = receiveCounter.val() > 0;
            String info=String.format("rcv=%.2f/s ", receiveCounter.avg());
            status.setChildStatus("NMEA",hasData? WorkerStatus.Status.NMEA: WorkerStatus.Status.RUNNING,info);
            if (!sleep(1000)) break;
            checkBackgroundGps();
        }
    }


    @SuppressLint("MissingPermission")
    public void check(){
        if (stopped) return;
        if (! isRegistered) tryEnableLocation();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if ((lastValidLocation+CHECKTIME*2) < SystemClock.uptimeMillis()) {
                setStatus(WorkerStatus.Status.RUNNING,"waiting for location");
                try {
                    locationService.getCurrentLocation(LocationManager.GPS_PROVIDER, null, executor, new Consumer<Location>() {
                        @Override
                        public void accept(Location location) {
                            onLocationChanged(location);
                        }
                    });
                } catch (Throwable t) {
                }
            }
        }
    }

    @Override
    public synchronized void onLocationChanged(@NonNull Location location) {
        if (location == null){
            this.location=null;
            setStatus(WorkerStatus.Status.RUNNING,"waiting for location");
            return;
        }
        AvnLog.d(LOGPRFX, "location: changed, acc=" + location.getAccuracy() + ", provider=" + location.getProvider() +
                ", date=" + new Date((location != null) ? location.getTime() : 0).toString());
        this.location=new Location(location);
        setStatus(WorkerStatus.Status.NMEA,"location available, acc="+location.getAccuracy());
            try {
                long now=SystemClock.uptimeMillis();
                //slightly shorter then check interval
                if (now > (lastRmc+CHECKTIME*1.8)) {
                    //build an NMEA RMC record and write out
                    RMCSentence rmc = positionToRmc(location);
                    queue.add(rmc.toSentence(), getSourceName(), getPriority(PRIORITY_PARAMETER));
                    lastRmc=now;
                }
            }catch(Exception e){
                AvnLog.e("unable to create RMC from position: "+e);
            }

        lastValidLocation= SystemClock.uptimeMillis();

    }

    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {
        AvnLog.d(LOGPRFX,"location: status changed for "+provider+", new status="+status);
        tryEnableLocation();
    }

    @Override
    public void onProviderEnabled(String provider) {
        AvnLog.d(LOGPRFX,"location: provider enabled "+provider);
        tryEnableLocation();
    }

    @Override
    public void onProviderDisabled(String provider) {
        AvnLog.d(LOGPRFX,"location: provider disabled "+provider);
        tryEnableLocation();
    }
    private void deregister(){
        if (locationService != null) {
            handler.post(new Runnable() {
                @Override
                public void run() {
                    locationService.removeUpdates(locationListener);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                        locationService.removeNmeaListener(AndroidPositionHandler.this.onNmeaListener);
                    }
                    else {
                        locationService.removeGpsStatusListener(AndroidPositionHandler.this);
                        locationService.removeNmeaListener(AndroidPositionHandler.this.nmeaListener);
                    }
                    isRegistered=false;
                }
            });
            setStatus(WorkerStatus.Status.INACTIVE,"deregistered");
        }
    }

    private synchronized void tryEnableLocation(){
        if (stopped) return;
        AvnLog.d(LOGPRFX,"tryEnableLocation");
        if (locationService != null && locationService.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
            if (!isRegistered) {
                if (Build.VERSION.SDK_INT >= 23) {
                    if (ContextCompat.checkSelfPermission(gpsService, Manifest.permission.ACCESS_FINE_LOCATION) !=
                            PackageManager.PERMISSION_GRANTED) {
                        location = null;
                        lastValidLocation = 0;
                        isRegistered = false;
                        setStatus(WorkerStatus.Status.ERROR, "no gps permission");
                        return;
                    }
                }
                handler.post(new Runnable() {
                    @SuppressLint("MissingPermission")
                    @Override
                    public void run() {
                        locationService.requestLocationUpdates(currentProvider, CHECKTIME/2, 0, locationListener);
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                            locationService.addNmeaListener(AndroidPositionHandler.this.onNmeaListener,null);
                                //locationService.registerGnssStatusCallback(AndroidPositionHandler.this.gpsService.getMainExecutor(), AndroidPositionHandler.this.gnssStatus);
                        }
                        else {
                            locationService.addNmeaListener(AndroidPositionHandler.this.nmeaListener);
                            //locationService.addGpsStatusListener(AndroidPositionHandler.this);
                        }
                    }
                });
                location = null;
                lastValidLocation = 0;
                isRegistered = true;
                setStatus(WorkerStatus.Status.STARTED, "waiting for position");
            }

        }
        else {
            AvnLog.d(LOGPRFX, "location: no gps");
            location=null;
            lastValidLocation=0;
            isRegistered=false;
            setStatus(WorkerStatus.Status.ERROR,"no gps enabled");
        }
    }

    @Override
    public void stop() {
        stopped=true;
        super.stop();
        deregister();
    }

    @Override
    NeededPermissions needsPermissions() {
        NeededPermissions rt=new NeededPermissions();
        rt.gps= isEnabled()?NeededPermissions.Mode.NEEDED: NeededPermissions.Mode.NOT_NEEDED;
        return rt;
    }

    /**
     * get the current position data
     * @return
     */

    @Override
    public void onGpsStatusChanged(int event) {
    }
    private static net.sf.marineapi.nmea.util.Date toSfDate(long timestamp){
        Calendar cal=Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        cal.setTimeInMillis(timestamp);
        net.sf.marineapi.nmea.util.Date rt=new net.sf.marineapi.nmea.util.Date(cal.get(Calendar.YEAR),cal.get(Calendar.MONTH)+1,cal.get(Calendar.DAY_OF_MONTH));
        return rt;
    }

    private static net.sf.marineapi.nmea.util.Time toSfTime(long timestamp){
        Calendar cal=Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        cal.setTimeInMillis(timestamp);
        net.sf.marineapi.nmea.util.Time rt=new net.sf.marineapi.nmea.util.Time(cal.get(Calendar.HOUR_OF_DAY),cal.get(Calendar.MINUTE),cal.get(Calendar.SECOND));
        return rt;
    }

    private static RMCSentence positionToRmc(Location location){
        SentenceFactory sf = SentenceFactory.getInstance();
        RMCSentence rmc = (RMCSentence) sf.createParser(TalkerId.GP, "RMC");
        Position pos = new Position(location.getLatitude(), location.getLongitude());
        rmc.setPosition(pos);
        rmc.setSpeed(location.getSpeed() * AvnUtil.msToKn);
        rmc.setCourse(location.getBearing());
        rmc.setMode(FaaMode.DGPS);
        rmc.setDate(toSfDate(location.getTime()));
        rmc.setTime(toSfTime(location.getTime()));
        rmc.setStatus(DataStatus.ACTIVE);
        return rmc;
    }
}
