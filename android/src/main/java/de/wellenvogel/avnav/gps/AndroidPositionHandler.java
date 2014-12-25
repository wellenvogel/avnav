package de.wellenvogel.avnav.gps;

import android.content.Context;
import android.location.*;
import android.os.Bundle;
import android.util.Log;
import android.widget.Toast;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.*;

/**
 * Created by andreas on 12.12.14.
 */
public class AndroidPositionHandler extends GpsDataProvider implements LocationListener  {


    private static final long MAXLOCAGE=10000; //max age of location in milliseconds
    private static final long MAXLOCWAIT=2000; //max time we wait until we explicitely query the location again

    //location data
    private LocationManager locationService;
    private Location location=null;
    private String currentProvider=null;
    private long lastValidLocation=0;
    private Context context;


    private static final String LOGPRFX="Avnav:AndroidPositionHandler";

    AndroidPositionHandler(Context ctx){
        this.context=ctx;
        locationService=(LocationManager)context.getSystemService(context.LOCATION_SERVICE);
        tryEnableLocation(true);
    }




    /**
     * will be called whe we intend to really stop
     * after a call to this method the object is not working any more
     */
    public void stop(){
        if (locationService != null) {
            locationService.removeUpdates(this);
        }
        location=null;
        lastValidLocation=0;
        Log.d(LOGPRFX,"stopped");
    }

    public void check(){
        if (currentProvider == null) tryEnableLocation();
    }

    @Override
    public void onLocationChanged(Location location) {
        Log.d(LOGPRFX, "location: changed, acc=" + location.getAccuracy() + ", provider=" + location.getProvider() +
                ", date=" + new Date((location != null) ? location.getTime() : 0).toString());
        this.location=new Location(location);
        lastValidLocation=System.currentTimeMillis();

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
        tryEnableLocation(false);
    }
    private synchronized void tryEnableLocation(boolean notify){
        Log.d(LOGPRFX,"tryEnableLocation");
        if (locationService != null && locationService.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
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
                if (notify)Toast.makeText(context, "no location provider ",
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
            if (notify)Toast.makeText(context, "no gps ",
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
    public Location getCurrentLocation(){
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
            if (locdiff < (currtime - lastValidLocation - 5*MAXLOCAGE)){
                Log.d(LOGPRFX,"location: location updates too slow - only "+(locdiff/1000)+" seconds for time diff "+(currtime-lastValidLocation)/1000);
                return null;
            }
            Log.d(LOGPRFX,"location: refreshed location successfully");
            location=nlocation;
            lastValidLocation=lastValidLocation+(long)Math.floor(locdiff*1.1); //we allow the gps to be 10% slower than realtime
        }
        return location;
    }

    @Override
    public SatStatus getSatStatus(){
        SatStatus rt=new SatStatus(0,0);
        GpsStatus status=locationService.getGpsStatus(null);
        for (GpsSatellite s: status.getSatellites()){
            rt.numSat++;
            if (s.usedInFix()) rt.numUsed++;
        }
        rt.gpsEnabled=(currentProvider != null);
        Log.d(LOGPRFX,"getSatStatus returns "+rt);
        return rt;
    }

    /**
     * get the current position data
     * @return
     */
    @Override
    public JSONObject getGpsData() throws JSONException{
        Location curLoc=getCurrentLocation();
        return getGpsData(curLoc);
    }

    @Override
    public Location getLocation() {
        return getCurrentLocation();
    }
}
