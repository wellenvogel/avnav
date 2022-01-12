package de.wellenvogel.avnav.worker;

import android.Manifest;
import android.content.pm.PackageManager;
import android.location.*;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.support.v4.content.ContextCompat;
import android.widget.Toast;

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
import de.wellenvogel.avnav.util.NmeaQueue;

import org.json.JSONException;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.TimeZone;


/**
 * Created by andreas on 12.12.14.
 */
public class AndroidPositionHandler extends ChannelWorker implements LocationListener , GpsStatus.Listener {


    private static final long MAXLOCWAIT=2000; //max time we wait until we explicitely query the location again

    //location data
    private LocationManager locationService;
    private Location location=null;
    private String currentProvider=LocationManager.GPS_PROVIDER;
    private long lastValidLocation=0;
    private boolean isRegistered=false;
    private Handler handler=new Handler(Looper.getMainLooper());


    private static final String LOGPRFX="Avnav:AndroidPositionHandler";
    private boolean stopped=true;
    private Thread satStatusProvider;

    AndroidPositionHandler(String name, GpsService ctx, NmeaQueue queue) {
        super(name,ctx,queue);
        parameterDescriptions.addParams(
                ENABLED_PARAMETER,
                SOURCENAME_PARAMETER
                );
        status.canEdit=true;
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
        stopped=false;
        locationService=(LocationManager) gpsService.getSystemService(gpsService.LOCATION_SERVICE);
        tryEnableLocation();
        checkBackgroundGps();
        satStatusProvider=new Thread(new Runnable() {
            @Override
            public void run() {
                SentenceFactory sf=SentenceFactory.getInstance();
                while (! shouldStop(startSequence)){
                    try {
                        int numSat = 0;
                        GpsStatus status = locationService.getGpsStatus(null);
                        ArrayList<SatelliteInfo> sats = new ArrayList<SatelliteInfo>();
                        ArrayList<String> fixSats = new ArrayList<String>();
                        for (GpsSatellite s : status.getSatellites()) {
                            numSat++;
                            if (s.usedInFix() && fixSats.size() < 12) fixSats.add(String.format("%02d", s.getPrn()));
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
                            queue.add(gsv.toSentence(), getSourceName());
                        }
                        Location loc = location;
                        if (loc != null && (System.currentTimeMillis() <= (lastValidLocation + MAXLOCWAIT))) {
                            GSASentence gsa = (GSASentence) sf.createParser(TalkerId.GP, "GSA");
                            gsa.setMode(FaaMode.AUTOMATIC);
                            gsa.setFixStatus(GpsFixStatus.GPS_3D);
                            String[] fsats = new String[fixSats.size()];
                            fsats = fixSats.toArray(fsats);
                            gsa.setSatelliteIds(fsats);
                            //TODO: XDOP
                            queue.add(gsa.toSentence(), getSourceName());
                        }
                    }catch (Throwable t){
                        AvnLog.e("error in sat status loop",t);
                    }
                    if (!sleep(1000)) break;
                }
                AvnLog.i("sat status thread stopped");
            }
        });
        satStatusProvider.setDaemon(true);
        satStatusProvider.start();
        while (! shouldStop(startSequence)){
            if (!sleep(5000)) break;
            checkBackgroundGps();
        }
    }


    public void check(){
        if (stopped) return;
        if (! isRegistered) tryEnableLocation();
    }

    @Override
    public void onLocationChanged(Location location) {
        AvnLog.d(LOGPRFX, "location: changed, acc=" + location.getAccuracy() + ", provider=" + location.getProvider() +
                ", date=" + new Date((location != null) ? location.getTime() : 0).toString());
        this.location=new Location(location);
        setStatus(WorkerStatus.Status.NMEA,"location available, acc="+location.getAccuracy());
            try {
                //build an NMEA RMC record and write out
                RMCSentence rmc=positionToRmc(location);
                queue.add(rmc.toSentence(),getSourceName());
            }catch(Exception e){
                AvnLog.e("unable to create RMC from position: "+e);
            }

        lastValidLocation=System.currentTimeMillis();

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
                    locationService.removeUpdates(AndroidPositionHandler.this);
                    locationService.removeGpsStatusListener(AndroidPositionHandler.this);
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
                    @Override
                    public void run() {
                        locationService.requestLocationUpdates(currentProvider, 400, 0, AndroidPositionHandler.this);
                        locationService.addGpsStatusListener(AndroidPositionHandler.this);
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
