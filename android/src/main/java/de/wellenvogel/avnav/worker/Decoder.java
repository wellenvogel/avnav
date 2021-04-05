package de.wellenvogel.avnav.worker;

import android.content.Context;
import android.location.Location;
import android.util.Log;

import net.sf.marineapi.nmea.parser.SentenceFactory;
import net.sf.marineapi.nmea.sentence.DBTSentence;
import net.sf.marineapi.nmea.sentence.DPTSentence;
import net.sf.marineapi.nmea.sentence.DateSentence;
import net.sf.marineapi.nmea.sentence.GGASentence;
import net.sf.marineapi.nmea.sentence.GLLSentence;
import net.sf.marineapi.nmea.sentence.GSASentence;
import net.sf.marineapi.nmea.sentence.GSVSentence;
import net.sf.marineapi.nmea.sentence.MWVSentence;
import net.sf.marineapi.nmea.sentence.PositionSentence;
import net.sf.marineapi.nmea.sentence.RMCSentence;
import net.sf.marineapi.nmea.sentence.Sentence;
import net.sf.marineapi.nmea.sentence.SentenceValidator;
import net.sf.marineapi.nmea.sentence.TalkerId;
import net.sf.marineapi.nmea.sentence.TimeSentence;
import net.sf.marineapi.nmea.sentence.XDRSentence;
import net.sf.marineapi.nmea.util.DataStatus;
import net.sf.marineapi.nmea.util.Measurement;
import net.sf.marineapi.nmea.util.Position;
import net.sf.marineapi.nmea.util.Units;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.TimeZone;

import de.wellenvogel.avnav.aislib.messages.message.AisMessage;
import de.wellenvogel.avnav.aislib.messages.sentence.Abk;
import de.wellenvogel.avnav.aislib.packet.AisPacket;
import de.wellenvogel.avnav.aislib.packet.AisPacketParser;
import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.util.NmeaQueue;

/**
 * Created by andreas on 25.12.14.
 */
public class Decoder extends Worker {
    public SimpleDateFormat dateFormat=new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSSZ");
    private long lastAisCleanup=0;
    private AisStore store=null;
    private GSVStore currentGsvStore=null;
    private GSVStore validGsvStore=null;
    private SatStatus stat=new SatStatus(0,0);
    private Location location=null;
    private long lastPositionReceived=0;
    public static final String LOGPRFX="AvNav:Decoder";
    private Context context;
    private INmeaLogger nmeaLogger;
    private NmeaQueue queue;
    private static final long AIS_CLEANUP_INTERVAL=60000;
    private long lastReceived=0;

    private static final EditableParameter.IntegerParameter POSITION_AGE= new
            EditableParameter.IntegerParameter("posAge",R.string.labelSettingsPosAge,10);
    private static final EditableParameter.IntegerParameter GPS_AGE= new
            EditableParameter.IntegerParameter("gpsAge",R.string.labelSettingsAuxAge,600);
    private static final EditableParameter.IntegerParameter AIS_AGE= new
            EditableParameter.IntegerParameter("aisAge", R.string.labelSettingsAisLifetime,1200);
    private static final EditableParameter.StringParameter OWN_MMSI= new
            EditableParameter.StringParameter("ownMMSI",R.string.labelSettingsOwnMMSI,"");
    private void addParameters(){
        parameterDescriptions.addParams(OWN_MMSI,POSITION_AGE,GPS_AGE,AIS_AGE);
    }
    static class AuxiliaryEntry{
        public long timestamp;
        public JSONObject data=new JSONObject();
    }
    private final HashMap<String,AuxiliaryEntry> auxiliaryData=new HashMap<String,AuxiliaryEntry>();

    private void addAuxiliaryData(String key, AuxiliaryEntry entry){
        entry.timestamp=System.currentTimeMillis();
        auxiliaryData.put(key,entry);
    }
    private void mergeAuxiliaryData(JSONObject json) throws JSONException {
        long minTimestamp=System.currentTimeMillis()-GPS_AGE.fromJson(parameters)*1000;
        //TODO: consider timestamp
        for (AuxiliaryEntry e: auxiliaryData.values()){
            if (e.timestamp < minTimestamp) continue;
            Iterator<String> akeys=e.data.keys();
            while (akeys.hasNext()){
                String k=akeys.next();
                if (json.has(k)) continue;
                json.put(k,e.data.get(k));
            }
        }
    }

    static class GSVStore{
        public static final int MAXGSV=20; //max number of gsv sentences without one that is the last
        public static final int GSVAGE=60000; //max age of gsv data in ms
        int numGsv=0;
        int lastReceived=0;
        boolean isValid=false;
        Date validDate=null;
        HashMap<Integer,GSVSentence> sentences=new HashMap<Integer,GSVSentence>();
        public void addSentence(GSVSentence gsv){
            if (gsv.isFirst()){
                numGsv=gsv.getSentenceCount();
                sentences.clear();
                isValid=false;
                validDate=null;
            }
            if (gsv.isLast()){
                isValid=true;
                validDate=new Date();
            }
            lastReceived=gsv.getSentenceIndex();
            sentences.put(gsv.getSentenceIndex(),gsv);
        }
        public boolean getValid(){
            if (! isValid) return false;
            if (validDate == null) return false;
            Date now=new Date();
            if ((now.getTime()-validDate.getTime()) > GSVAGE) return false;
            return true;
        }
        public int getSatCount(){
            if (! isValid) return 0;
            for (GSVSentence s: sentences.values()){
                return s.getSatelliteCount();
            }
            return 0;
        }
    }
    private net.sf.marineapi.nmea.util.Date lastDate;
    private double convertTransducerValue(String ttype, String tunit, double tval) {
        if("C".equals(tunit)){
            return tval+273.15;
        }
        if ("B".equals(tunit)){
            return tval*100000;
        }
        return tval;
    }


        private String correctTalker(String nmea){
            try{
                //if we have no exceptionthe talker is ok
                TalkerId.parse(nmea);
                return nmea;
            }catch(RuntimeException e){
                //seems that we did not find a valid talker ID
                //in this case we use the special "$P" that is handled by the lib
                //as we change the NMEA we remove the checksum (has already been checked before...)
                AvnLog.d(LOGPRFX,"unknown talker in "+nmea);
                int csdel=nmea.indexOf('*');
                if (csdel >= 0){
                    return "$P"+nmea.substring(3,csdel);
                }
                return "$P"+nmea.substring(3);
            }
        }
        @Override
        public void run(int startSequence) throws JSONException {
            store=new AisStore(OWN_MMSI.fromJson(parameters));
            int numGsv = 0; //number of gsv sentences without being the last
            long lastConnect = 0;
            int sequence = -1;
            SentenceFactory factory = SentenceFactory.getInstance();
            AisPacketParser aisparser = new AisPacketParser();
            Thread cleanupThread=new Thread(new Runnable() {
                @Override
                public void run() {
                    while (! shouldStop(startSequence)) {
                        AvnLog.d(LOGPRFX, getTypeName() + ": cleanup AIS data");
                        try {
                            cleanupAis(AIS_AGE.fromJson(parameters));
                        } catch (Throwable t) {
                            AvnLog.e("exception in AIS cleanup", t);
                        }
                        sleep(10000);
                        if (shouldStop(startSequence)) break;
                    }
                    AvnLog.i(LOGPRFX,"Ais cleanup finished");
                }
            });
            cleanupThread.start();
            AvnLog.d(LOGPRFX,getTypeName()+":starting decoder");
            while (!shouldStop(startSequence)) {
                NmeaQueue.Entry entry;
                try {
                    entry = queue.fetch(sequence, 2000);
                } catch (InterruptedException e) {
                    if (shouldStop(startSequence)) return;
                    if ((lastReceived+ Constants.NO_DATA_TIME) < System.currentTimeMillis()){
                        stat.gpsEnabled=false;
                        setStatus(WorkerStatus.Status.INACTIVE,"no NMEA data");
                    }
                    sleep(2000);
                    continue;
                }
                if ((lastReceived+ Constants.NO_DATA_TIME) < System.currentTimeMillis()){
                    stat.gpsEnabled=false;
                    setStatus(WorkerStatus.Status.INACTIVE,"no NMEA data");
                }
                if (entry == null) {
                    continue;
                }
                sequence = entry.sequence;
                try {
                    String line = entry.data;
                    if (line.startsWith("$")) {
                        if (nmeaLogger != null) nmeaLogger.logNmea(line);
                        //NMEA
                        if (SentenceValidator.isValid(line)) {
                            setStatus(WorkerStatus.Status.NMEA,"receiving NMEA data");
                            stat.gpsEnabled=true;
                            lastReceived=System.currentTimeMillis();
                            try {
                                line = correctTalker(line);
                                Sentence s = factory.createParser(line);
                                if (s instanceof DateSentence) {
                                    lastDate = ((DateSentence) s).getDate();
                                }
                                if (s instanceof GSVSentence) {
                                    numGsv++;
                                    if (currentGsvStore == null) currentGsvStore = new GSVStore();
                                    GSVSentence gsv = (GSVSentence) s;
                                    currentGsvStore.addSentence(gsv);
                                    AvnLog.d(getTypeName() + ": GSV sentence (" + gsv.getSentenceIndex() + "/" + gsv.getSentenceCount() +
                                            "), numSat=" + gsv.getSatelliteCount());
                                    if (currentGsvStore.getValid()) {
                                        numGsv = 0;
                                        validGsvStore = currentGsvStore;
                                        currentGsvStore = new GSVStore();
                                        stat.numSat = validGsvStore.getSatCount();
                                        //TODO: aging of validGSVStore
                                        AvnLog.d(getTypeName() + ": GSV sentence last, numSat=" + stat.numSat);
                                    }
                                    if (numGsv > GSVStore.MAXGSV) {
                                        AvnLog.e(getTypeName() + ": to many gsv sentences without a final one " + numGsv);
                                        stat.numSat = 0;
                                        validGsvStore = null;
                                    }

                                    continue;
                                }
                                if (s instanceof GSASentence) {
                                    stat.numUsed = ((GSASentence) s).getSatelliteIds().length;
                                    AvnLog.d(getTypeName() + ": GSA sentence, used=" + stat.numUsed);
                                    continue;
                                }
                                if (s instanceof MWVSentence) {
                                    MWVSentence m = (MWVSentence) s;
                                    AvnLog.d(getTypeName() + ": MWV sentence");
                                    AuxiliaryEntry e = new AuxiliaryEntry();
                                    e.data.put("windAngle", m.getAngle());
                                    e.data.put("windReference", m.isTrue() ? "T" : "R");
                                    double speed = m.getSpeed();
                                    if (m.getSpeedUnit().equals(Units.KMH)) {
                                        speed = speed / 3.6;
                                    }
                                    if (m.getSpeedUnit().equals(Units.KNOT)) {
                                        speed = speed / 3600.0 * 1852.0;
                                    }
                                    e.data.put("windSpeed", speed);
                                    addAuxiliaryData(s.getSentenceId(), e);
                                    continue;
                                }
                                if (s instanceof DPTSentence) {
                                    DPTSentence d = (DPTSentence) s;
                                    AvnLog.d(getTypeName() + ": DPT sentence");
                                    AuxiliaryEntry e = new AuxiliaryEntry();
                                    double depth = d.getDepth();
                                    e.data.put("depthBelowTransducer", depth);
                                    double offset = d.getOffset();
                                    if (offset >= 0) {
                                        e.data.put("depthBelowWaterline", depth + offset);
                                    } else {
                                        e.data.put("depthBelowKeel", depth + offset);
                                    }
                                    addAuxiliaryData(s.getSentenceId(), e);
                                    continue;
                                }
                                if (s instanceof DBTSentence) {
                                    DBTSentence d = (DBTSentence) s;
                                    AvnLog.d(getTypeName() + ": DBT sentence");
                                    AuxiliaryEntry e = new AuxiliaryEntry();
                                    double depth = d.getDepth();
                                    e.data.put("depthBelowTransducer", depth);
                                    addAuxiliaryData(s.getSentenceId(), e);
                                    continue;
                                }
                                if (s instanceof XDRSentence) {
                                    List<Measurement> transducers = ((XDRSentence) s).getMeasurements();
                                    for (Measurement transducer : transducers) {
                                        String tname = transducer.getName();
                                        String ttype = transducer.getType();
                                        String tunit = transducer.getUnits();
                                        double tval = transducer.getValue();
                                        if (tname != null && ttype != null && tunit != null) {
                                            AuxiliaryEntry e = new AuxiliaryEntry();
                                            e.data.put("transducers." + tname, convertTransducerValue(ttype, tunit, tval));
                                            addAuxiliaryData(s.getSentenceId() + "." + tname, e);
                                        }
                                    }

                                }
                                Position p = null;
                                if (s instanceof PositionSentence) {
                                    //we need to verify the position quality
                                    //it could be either RMC or GLL - they have DataStatus or GGA - GpsFixQuality
                                    boolean isValid = false;
                                    if (s instanceof RMCSentence) {
                                        isValid = ((RMCSentence) s).getStatus() == DataStatus.ACTIVE;
                                        AvnLog.d(getTypeName() + ": RMC sentence, valid=" + isValid);
                                    }
                                    if (s instanceof GLLSentence) {
                                        isValid = ((GLLSentence) s).getStatus() == DataStatus.ACTIVE;
                                        AvnLog.d(getTypeName() + ": GLL sentence, valid=" + isValid);
                                    }
                                    if (s instanceof GGASentence) {
                                        int qual = ((GGASentence) s).getFixQuality().toInt();
                                        isValid = qual > 0;
                                        AvnLog.d(getTypeName() + ": GGA sentence, quality=" + qual + ", valid=" + isValid);
                                    }
                                    if (isValid) {
                                        p = ((PositionSentence) s).getPosition();
                                        AvnLog.d(LOGPRFX, getTypeName() + ": external position " + p);
                                    }
                                }
                                net.sf.marineapi.nmea.util.Time time = null;
                                if (s instanceof TimeSentence) {
                                    try {
                                        time = ((TimeSentence) s).getTime();
                                    } catch (RuntimeException e) {
                                        AvnLog.d(LOGPRFX, "empty time in " + line);
                                    }
                                }
                                if (time != null && lastDate != null && p != null) {
                                    synchronized (this) {
                                        Location lastLocation = location;
                                        Location newLocation = null;
                                        if (lastLocation != null) {
                                            newLocation = new Location(lastLocation);
                                        } else {
                                            newLocation = new Location((String) null);
                                        }
                                        lastPositionReceived = System.currentTimeMillis();
                                        newLocation.setLatitude(p.getLatitude());
                                        newLocation.setLongitude(p.getLongitude());
                                        newLocation.setTime(AvnUtil.toTimeStamp(lastDate, time));
                                        location = newLocation;
                                        if (s.getSentenceId().equals("RMC")) {
                                            try {
                                                location.setSpeed((float) (((RMCSentence) s).getSpeed() / AvnUtil.msToKn));
                                            } catch (Exception i) {
                                                AvnLog.d(getTypeName() + ": Exception querying speed: " + i.getLocalizedMessage());
                                            }
                                            try {
                                                location.setBearing((float) (((RMCSentence) s).getCourse()));
                                            } catch (Exception i) {
                                                AvnLog.d(getTypeName() + ": Exception querying bearing: " + i.getLocalizedMessage());
                                            }
                                        }
                                        AvnLog.d(LOGPRFX, getTypeName() + ": location: " + location);
                                    }
                                } else {
                                    AvnLog.d(LOGPRFX, getTypeName() + ": ignoring sentence " + line + " - no position or time");
                                }
                            } catch (Exception i) {
                                Log.e(LOGPRFX, getTypeName() + ": exception in NMEA parser " + i.getLocalizedMessage());
                                i.printStackTrace();
                            }
                        } else {
                            AvnLog.d(LOGPRFX, getTypeName() + ": ignore invalid nmea");
                        }
                    }
                    if (line.startsWith("!")) {
                        if (nmeaLogger != null) nmeaLogger.logNmea(line);
                        if (Abk.isAbk(line)) {
                            aisparser.newVdm();
                            AvnLog.i(LOGPRFX, getTypeName() + ": ignore abk line " + line);
                        }
                        try {
                            AisPacket p = aisparser.readLine(line);
                            if (p != null) {
                                AisMessage m = p.getAisMessage();
                                AvnLog.i(LOGPRFX, getTypeName() + ": AisPacket received: " + m.toString());
                                store.addAisMessage(m);
                                lastReceived= System.currentTimeMillis();
                                stat.gpsEnabled=true;
                                setStatus(WorkerStatus.Status.NMEA,"receiving NMEA");
                            }
                        } catch (Exception e) {
                            Log.e(LOGPRFX, getTypeName() + ": AIS exception while parsing " + line);
                            e.printStackTrace();
                        }
                    }

                } catch (Throwable e) {
                    Log.e(LOGPRFX, getTypeName() + ": Exception during decode " + e.getLocalizedMessage());
                }
            }
        }


    public void cleanupAis(long lifetime){
        if (store != null) {
            long now=System.currentTimeMillis();
            if (now > (lastAisCleanup+AIS_CLEANUP_INTERVAL)) {
                lastAisCleanup=now;
                store.cleanup(lifetime);
            }
        }//satellite view
    }

    Decoder(String name, Context ctx, NmeaQueue queue){
        super(name);
        context=ctx;
        if (ctx instanceof INmeaLogger) nmeaLogger=(INmeaLogger)ctx;
        this.queue=queue;
        addParameters();
        status.canEdit=true;
        dateFormat.setTimeZone(TimeZone.getTimeZone("UTC"));
    }

    @Override
    public synchronized void setParameters(JSONObject newParam, boolean replace) throws JSONException {
        if (replace){
            try{
                super.setParameters(newParam,true);
            }catch (JSONException e){
                AvnLog.e(getTypeName()+": config error",e);
                //we fall back to save settings
                super.setParameters(new JSONObject(),true);
            }
            return;
        }
        super.setParameters(newParam, replace);
    }

    SatStatus getSatStatus() {
        return new SatStatus(stat);
    }


    @Override
    public synchronized void stop() {
        super.stop();
        queue.clear();
    }


    public Location getLocation() throws JSONException {
        long current=System.currentTimeMillis();
        if (current > (lastPositionReceived+POSITION_AGE.fromJson(parameters)*1000)){
            return null;
        }
        Location rt=location;
        if (rt == null) return rt;
        rt=new Location(rt);
        rt.setTime(rt.getTime()+TIMEOFFSET_PARAMETER.fromJson(parameters)*1000);
        return rt;
    }

    public static final String G_LON="lon";
    public static final String G_LAT="lat";
    public static final String G_COURSE="course";
    public static final String G_SPEED="speed";
    public static final String G_MODE="mode";
    public static final String G_TIME="time";
    /**
     * service function to convert an android location
     * @return
     * @throws JSONException
     */
    JSONObject getGpsData() throws JSONException{
        Location curLoc=getLocation();
        if (curLoc == null) {
            AvnLog.d(LOGPRFX, "getGpsData returns empty data");
            return null;
        }
        JSONObject rt=new JSONObject();
        rt.put(G_MODE,1);
        rt.put(G_LAT,curLoc.getLatitude());
        rt.put(G_LON,curLoc.getLongitude());
        rt.put(G_COURSE,curLoc.getBearing());
        rt.put(G_SPEED,curLoc.getSpeed());
        rt.put(G_TIME, dateFormat.format(new Date(curLoc.getTime())));
        mergeAuxiliaryData(rt);
        AvnLog.d(LOGPRFX,"getGpsData: "+rt.toString());
        return rt;
    }


    /**
     * get AIS data (limited to distance)
     * @param lat
     * @param lon
     * @param distance in nm
     * @return
     */
    public JSONArray  getAisData(double lat,double lon,double distance){
        if (store != null) return store.getAisData(lat,lon,distance);
        return new JSONArray();

    }

    public int numAisData(){
        return store.numAisEntries();
    }


    @Override
    public synchronized JSONObject getJsonStatus() throws JSONException {
        WorkerStatus workerStatus = new WorkerStatus(status);
        SatStatus st = getSatStatus();
        Location loc = getLocation();
        int numAis = numAisData();
        if (loc != null) {
            String info = "valid position, sats: " + st.numSat + " / " + st.numUsed;
            workerStatus.setChildStatus("position", WorkerStatus.Status.NMEA, info);
        } else {
            String info = "no position, sats: " + st.numSat + " / " + st.numUsed;
            workerStatus.setChildStatus("position", WorkerStatus.Status.INACTIVE, info);
        }
        if (numAis > 0) {
            workerStatus.setChildStatus("ais", WorkerStatus.Status.NMEA,"valid AIS data, " + numAis + " targets");
        } else {
            workerStatus.setChildStatus("ais", WorkerStatus.Status.INACTIVE,"no AIS data");
        }
        return workerStatus.toJson();
    }

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
            this.gpsEnabled=other.gpsEnabled;
        }
        public String toString(){
            return "Sat num="+numSat+", used="+numUsed;
        }
    }
}
