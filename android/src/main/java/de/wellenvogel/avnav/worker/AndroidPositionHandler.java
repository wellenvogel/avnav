package de.wellenvogel.avnav.worker;

import android.content.Context;
import android.location.*;
import android.os.Bundle;
import android.widget.Toast;

import net.sf.marineapi.nmea.parser.SentenceFactory;
import net.sf.marineapi.nmea.sentence.GSASentence;
import net.sf.marineapi.nmea.sentence.GSVSentence;
import net.sf.marineapi.nmea.sentence.RMCSentence;
import net.sf.marineapi.nmea.sentence.TalkerId;
import net.sf.marineapi.nmea.util.FaaMode;
import net.sf.marineapi.nmea.util.GpsFixStatus;
import net.sf.marineapi.nmea.util.SatelliteInfo;

import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.NmeaQueue;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;

/**
 * Created by andreas on 12.12.14.
 */
public class AndroidPositionHandler extends GpsDataProvider implements LocationListener , GpsStatus.Listener {


    private static final long MAXLOCAGE=10000; //max age of location in milliseconds
    private static final long MAXLOCWAIT=2000; //max time we wait until we explicitely query the location again

    //location data
    private LocationManager locationService;
    private Location location=null;
    private String currentProvider=LocationManager.GPS_PROVIDER;
    private long lastValidLocation=0;
    private Context context;
    private boolean isRegistered=false;
    private long timeOffset=0;
    private final Object waiter = new Object();
    private NmeaQueue queue;


    private static final String LOGPRFX="Avnav:AndroidPositionHandler";
    private boolean stopped=false;
    private Thread satStatusProvider;

    AndroidPositionHandler(Context ctx, long timeOffset, NmeaQueue queue){
        this.context=ctx;
        this.queue=queue;
        this.timeOffset=timeOffset;
        locationService=(LocationManager)context.getSystemService(context.LOCATION_SERVICE);
        tryEnableLocation(true);
        satStatusProvider=new Thread(new Runnable() {
            @Override
            public void run() {
                SentenceFactory sf=SentenceFactory.getInstance();
                while (! stopped){
                    try {
                        int numSat = 0;
                        GpsStatus status = locationService.getGpsStatus(null);
                        ArrayList<SatelliteInfo> sats = new ArrayList<SatelliteInfo>();
                        ArrayList<String> fixSats = new ArrayList<String>();
                        for (GpsSatellite s : status.getSatellites()) {
                            numSat++;
                            if (s.usedInFix()) fixSats.add(String.format("%02d", s.getPrn()));
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
                            queue.add(gsv.toSentence(), getName());
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
                            queue.add(gsa.toSentence(), getName());
                        }
                    }catch (Throwable t){
                        AvnLog.e("error in sat status loop",t);
                    }
                    synchronized (waiter){
                        try {
                            waiter.wait(1000);
                        } catch (InterruptedException e) {
                            break;
                        }
                    }
                }
                AvnLog.i("sat status thread stopped");
            }
        });
        satStatusProvider.setDaemon(true);
        satStatusProvider.start();
    }




    /**
     * will be called whe we intend to really stop
     * after a call to this method the object is not working any more
     */
    @Override
    public void stop(){
        deregister();
        location=null;
        lastValidLocation=0;
        AvnLog.d(LOGPRFX,"stopped");
        stopped=true;
    }
    @Override
    public boolean isStopped(){
        return this.stopped;
    }

    public void check(){
        if (! isRegistered) tryEnableLocation();
    }

    @Override
    public void onLocationChanged(Location location) {
        AvnLog.d(LOGPRFX, "location: changed, acc=" + location.getAccuracy() + ", provider=" + location.getProvider() +
                ", date=" + new Date((location != null) ? location.getTime() : 0).toString());
        this.location=new Location(location);
            try {
                //build an NMEA RMC record and write out
                RMCSentence rmc=positionToRmc(location);
                queue.add(rmc.toSentence(),getName());
            }catch(Exception e){
                AvnLog.e("unable to log NMEA data: "+e);
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
            locationService.removeUpdates(this);
            locationService.removeGpsStatusListener(this);
            isRegistered=false;
        }
    }
    private synchronized void tryEnableLocation(){
        tryEnableLocation(false);
    }
    private synchronized void tryEnableLocation(boolean notify){
        AvnLog.d(LOGPRFX,"tryEnableLocation");
        if (locationService != null && locationService.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
            if (! isRegistered) {
                locationService.requestLocationUpdates(currentProvider, 400, 0, this);
                locationService.addGpsStatusListener(this);
                location=null;
                lastValidLocation=0;
                /*
                location = locationService.getLastKnownLocation(currentProvider);
                if (location != null) lastValidLocation = System.currentTimeMillis();
                AvnLog.d(LOGPRFX, "location: location provider=" + currentProvider + " location acc=" + ((location != null) ? location.getAccuracy() : "<null>") + ", date=" + new Date((location != null) ? location.getTime() : 0).toString());
                */
                isRegistered=true;
            }

        }
        else {
            AvnLog.d(LOGPRFX, "location: no gps");
            location=null;
            lastValidLocation=0;
            isRegistered=false;
            if (notify)Toast.makeText(context, "no gps ",
                    Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    public String getName() {
        return "internal";
    }

    /**
     * get the current position data
     * @return
     */

    @Override
    public void onGpsStatusChanged(int event) {

    }

    @Override
    JSONObject getHandlerStatus() throws JSONException {
        JSONObject item=new JSONObject();
        item.put("name","internal GPS");
        return item;
    }
}
