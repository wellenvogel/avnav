package de.wellenvogel.avnav.worker;

import android.location.Location;

import net.sf.marineapi.nmea.parser.SentenceFactory;
import net.sf.marineapi.nmea.sentence.RMCSentence;
import net.sf.marineapi.nmea.sentence.TalkerId;
import net.sf.marineapi.nmea.util.DataStatus;
import net.sf.marineapi.nmea.util.FaaMode;
import net.sf.marineapi.nmea.util.Position;

import de.wellenvogel.avnav.util.AvnLog;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.net.InetSocketAddress;
import java.text.DecimalFormat;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.TimeZone;

/**
 * Created by andreas on 25.12.14.
 */
public abstract class GpsDataProvider {
    public SimpleDateFormat dateFormat=new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSSZ");
    public GpsDataProvider(){
        dateFormat.setTimeZone(TimeZone.getTimeZone("UTC"));
    }
    public static final String STATUS_INACTIVE ="INACTIVE";
    public static final String STATUS_STARTED="STARTED";
    public static final String STATUS_RUNNING="RUNNING";
    public static final String STATUS_NMEA="NMEA";
    public static final String STATUS_ERROR="ERROR";

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

    public abstract boolean handlesNmea();
    public abstract boolean handlesAis();
    public abstract String getName();
    public int numAisData(){return 0;}
    public String getConnectionId(){ return "";}

    public static class Properties{
        int connectTimeout=5;
        long postionAge=10; //max allowed age of position
        long aisLifetime=1200; //20 min
        long aisCleanupInterval=60; //1min
        boolean readAis=false;
        boolean readNmea=false;
        long timeOffset=0;
        String ownMmsi=null;
        String nmeaFilter=null;
        boolean sendPosition=false;
    };

    /**
     * stop the service and free all resources
     * afterwards the provider will not be used any more
     */
    public void stop(){}

    /**
     * check if the handler is stopped and should be reinitialized
     * @return
     */
    public boolean isStopped(){
        return false;
    }

    /**<EditTextPreference
        android:key="gps.offset"
        android:defaultValue="0"
        android:inputType="numberSigned"
        android:title="@string/labelSettingsGpsOffset"></EditTextPreference>
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
     * get the AIS data the same way as we return it in the Json response
     * (i.e. the format used by gpsd)
     * @return
     */
    public JSONArray getAisData(double lat,double lon,double distance) throws JSONException{ return null;}


    /**
     * will be called from a timer in regular intervals
     * should be used to check (e.g. check if provider enabled or socket can be opened)
     */
    public void check(){}

    /**
     * send out the current position if enabled
     * @param curLoc
     */
    public void sendPosition(Location curLoc){

    }

    /**
     * service function to convert an android location
     * @param curLoc
     * @return
     * @throws JSONException
     */
    JSONObject getGpsData(Location curLoc) throws JSONException{
        if (curLoc == null) {
            AvnLog.d(LOGPRFX, "getGpsData returns empty data");
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
        AvnLog.d(LOGPRFX,"getGpsData: "+rt.toString());
        return rt;
    }

    JSONObject getHandlerStatus() throws JSONException {
        return new JSONObject();
    };

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

    public static long toTimeStamp(net.sf.marineapi.nmea.util.Date date,net.sf.marineapi.nmea.util.Time time){
        if (date == null) return 0;
        Calendar cal=Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        cal.set(Calendar.YEAR, date.getYear());
        cal.set(Calendar.MONTH, date.getMonth()-1); //!!! the java calendar counts from 0
        cal.set(Calendar.DAY_OF_MONTH, date.getDay());
        cal.set(Calendar.HOUR_OF_DAY, 0);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        cal.add(Calendar.MILLISECOND, (int) (time.getMilliseconds()));
        long millis=cal.getTime().getTime();
        return millis;
    }

    public static net.sf.marineapi.nmea.util.Date toSfDate(long timestamp){
        Calendar cal=Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        cal.setTimeInMillis(timestamp);
        net.sf.marineapi.nmea.util.Date rt=new net.sf.marineapi.nmea.util.Date(cal.get(Calendar.YEAR),cal.get(Calendar.MONTH)+1,cal.get(Calendar.DAY_OF_MONTH));
        return rt;
    }

    public static net.sf.marineapi.nmea.util.Time toSfTime(long timestamp){
        Calendar cal=Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        cal.setTimeInMillis(timestamp);
        net.sf.marineapi.nmea.util.Time rt=new net.sf.marineapi.nmea.util.Time(cal.get(Calendar.HOUR_OF_DAY),cal.get(Calendar.MINUTE)+1,cal.get(Calendar.SECOND));
        return rt;
    }

    public static RMCSentence positionToRmc(Location location){
        SentenceFactory sf = SentenceFactory.getInstance();
        RMCSentence rmc = (RMCSentence) sf.createParser(TalkerId.GP, "RMC");
        Position pos = new Position(location.getLatitude(), location.getLongitude());
        rmc.setPosition(pos);
        rmc.setSpeed(location.getSpeed() * msToKn);
        rmc.setCourse(location.getBearing());
        rmc.setMode(FaaMode.DGPS);
        rmc.setDate(toSfDate(location.getTime()));
        rmc.setTime(toSfTime(location.getTime()));
        rmc.setStatus(DataStatus.ACTIVE);
        return rmc;
    }

}
