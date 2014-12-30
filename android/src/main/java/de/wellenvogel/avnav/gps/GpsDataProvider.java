package de.wellenvogel.avnav.gps;

import android.location.Location;
import android.util.Log;
import org.json.JSONException;
import org.json.JSONObject;

import java.net.InetSocketAddress;
import java.text.DecimalFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Map;

/**
 * Created by andreas on 25.12.14.
 */
public class GpsDataProvider {
    public static final double msToKn=3600.0/1852.0;
    private static final String LOGPRFX="GpsDataProvider";
    public static class SatStatus{
        public int numSat=0;
        public int numUsed=0;
        public boolean gpsEnabled; //for external connections this shows if it is connected
        public String statusText=null;
        public SatStatus(int numSat,int numUsed){
            this.numSat=numSat;
            this.numUsed=numUsed;
            this.gpsEnabled=(numUsed>0)?true:false;
        }
        public String toString(){
            return "Sat num="+numSat+", used="+numUsed;
        }
    }

    SatStatus getSatStatus(){return null;}

    public static class Properties{
        int connectTimeout=5000;
        long postionAge=10000; //max allowed age of position
        long aisLifetime=1200000; //20 min
        long aisCleanupInterval=6000; //1min
        boolean readAis=false;
        boolean readNmea=false;
    };

    /**
     * stop the service and free all resources
     * afterwards the provider will not be used any more
     */
    public void stop(){}

    /**
     * get the current location if any available or null
     * @return
     */
    public Location getLocation() {return null;}

    /**
     * get the GPS data the same way as we return it in the Json response
     * (i.e. the format used by gpsd)
     * @return
     */
    public JSONObject getGpsData() throws JSONException{ return null;}

    /**
     * will be called from a timer in regular intervals
     * should be used to check (e.g. check if provider enabled or socket can be opened)
     */
    public void check(){}

    /**
     * service function to convert an android location
     * @param curLoc
     * @return
     * @throws JSONException
     */
    JSONObject getGpsData(Location curLoc) throws JSONException{
        if (curLoc == null) {
            Log.d(LOGPRFX, "getGpsData returns empty data");
            return null;
        }
        JSONObject rt=new JSONObject();
        rt.put(G_CLASS, GV_CLASS_TPV);
        rt.put(G_TAG,GV_TAG_RMC);
        rt.put(G_MODE,1);
        rt.put(G_LAT,curLoc.getLatitude());
        rt.put(G_LON,curLoc.getLongitude());
        rt.put(G_COURSE,curLoc.getBearing());
        rt.put(G_SPEED,curLoc.getSpeed());
        rt.put(G_TIME,dateFormat.format(new Date(curLoc.getTime())));
        Log.d(LOGPRFX,"getGpsData: "+rt.toString());
        return rt;
    }

    //GPS position data
    public static final String G_CLASS="class";
    public static final String G_TAG="tag";
    public static final String GV_CLASS_TPV="TPV";
    //simple gps position reports
    public static final String GV_TAG_RMC="RMC";
    public static final String G_LON="lon";
    public static final String G_LAT="lat";
    public static final String G_COURSE="course";
    public static final String G_SPEED="speed";
    public static final String G_MODE="mode";
    public static final String G_TIME="time";

    public static SimpleDateFormat dateFormat=new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSSZ");

    public static String formatCoord(double coord,boolean isLat){
        StringBuilder rt=new StringBuilder();
        String dir=isLat?"N":"E";
        if (coord < 0){
            dir=isLat?"S":"W";
            coord=-coord;
        }
        double deg=Math.floor(coord);
        double min=(coord-deg)*60;
        DecimalFormat degFormat=isLat?new DecimalFormat("00"):new DecimalFormat("000");
        rt.append(degFormat.format(deg));
        rt.append("°");
        rt.append(" ");
        DecimalFormat minFormat=new DecimalFormat("00.000");
        rt.append(minFormat.format(min));
        rt.append("'").append(dir);
        return rt.toString();
    }

    public static InetSocketAddress convertAddress(String host, String port) {
        return new InetSocketAddress(host,Integer.parseInt(port));
    }


}
