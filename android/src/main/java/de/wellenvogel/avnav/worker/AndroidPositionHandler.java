package de.wellenvogel.avnav.worker;

import android.content.Context;
import android.location.*;
import android.os.Bundle;
import android.widget.Toast;

import net.sf.marineapi.nmea.sentence.RMCSentence;

import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.NmeaQueue;

import org.json.JSONException;
import org.json.JSONObject;

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
    private NmeaQueue queue;


    private static final String LOGPRFX="Avnav:AndroidPositionHandler";
    private boolean stopped=false;

    AndroidPositionHandler(Context ctx, long timeOffset, NmeaQueue queue){
        this.context=ctx;
        this.queue=queue;
        this.timeOffset=timeOffset;
        locationService=(LocationManager)context.getSystemService(context.LOCATION_SERVICE);
        tryEnableLocation(true);
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

    /**
     * get the current location checking for a recent update
     * we do not directly compare our system time with the location time as this would break test data at all
     * instead we check that the time elapsed since the last location update is not too far away from the really elapsed time
     * //TODO: should we make this tread safe?
     * @return
     */
    public Location getCurrentLocation(){
        Location curloc=location;
        if (curloc == null) return null;
        long currtime=System.currentTimeMillis();
        if ((currtime - lastValidLocation) > MAXLOCWAIT){
            //no location update during this time - query directly
            if (! isRegistered){
                AvnLog.d(LOGPRFX,"location: too old to return and no provider");
                return null;
            }
            Location nlocation = locationService.getLastKnownLocation(currentProvider);
            if (nlocation == null){
                location=null;
                AvnLog.d(LOGPRFX,"location: now new location for too old location");
                return null;
            }
            //the diff in location times must not be too far away from the really elapsed time
            //we assume at least MAXLOCAGE
            long locdiff=nlocation.getTime()-curloc.getTime();
            if (locdiff < (currtime - lastValidLocation - 5*MAXLOCAGE)){
                AvnLog.d(LOGPRFX,"location: location updates too slow - only "+(locdiff/1000)+" seconds for time diff "+(currtime-lastValidLocation)/1000);
                return null;
            }
            AvnLog.d(LOGPRFX,"location: refreshed location successfully");
            location=nlocation;
            lastValidLocation=lastValidLocation+(long)Math.floor(locdiff*1.1); //we allow the gps to be 10% slower than realtime
        }
        if (location == null) return location;
        Location rt=new Location(location);
        rt.setTime(rt.getTime()+timeOffset);
        return rt;
    }



    @Override
    public boolean handlesNmea() {
        return true;
    }

    @Override
    public boolean handlesAis() {
        return false;
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
