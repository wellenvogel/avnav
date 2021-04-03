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

        public SatStatus(int numSat,int numUsed){
            this.numSat=numSat;
            this.numUsed=numUsed;
            this.gpsEnabled=(numUsed>0)?true:false;
        }
        public SatStatus(SatStatus other){
            this(other.numSat,other.numUsed);
        }
        public String toString(){
            return "Sat num="+numSat+", used="+numUsed;
        }
    }

    public abstract String getName();
    public String getConnectionId(){ return "";}

    public static class Properties{
        int connectTimeout=5;
        long postionAge=10000; //max allowed age of position
        long auxiliaryAge=1200; //20min
        long aisLifetime=1200; //20 min
        long aisCleanupInterval=60; //1min
        boolean readAis=false;
        boolean readNmea=false;
        long timeOffset=0;
        String ownMmsi=null;
        String nmeaFilter=null;
        boolean sendPosition=false;
        long readWait=1000; //ms
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



    JSONObject getHandlerStatus() throws JSONException {
        return new JSONObject();
    };



    public static InetSocketAddress convertAddress(String host, String port) {
        return new InetSocketAddress(host,Integer.parseInt(port));
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
