package de.wellenvogel.avnav.worker;

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
import net.sf.marineapi.nmea.sentence.HDGSentence;
import net.sf.marineapi.nmea.sentence.HDMSentence;
import net.sf.marineapi.nmea.sentence.HDTSentence;
import net.sf.marineapi.nmea.sentence.MTWSentence;
import net.sf.marineapi.nmea.sentence.MWVSentence;
import net.sf.marineapi.nmea.sentence.PositionSentence;
import net.sf.marineapi.nmea.sentence.RMCSentence;
import net.sf.marineapi.nmea.sentence.Sentence;
import net.sf.marineapi.nmea.sentence.SentenceValidator;
import net.sf.marineapi.nmea.sentence.TalkerId;
import net.sf.marineapi.nmea.sentence.TimeSentence;
import net.sf.marineapi.nmea.sentence.VHWSentence;
import net.sf.marineapi.nmea.sentence.VWRSentence;
import net.sf.marineapi.nmea.sentence.XDRSentence;
import net.sf.marineapi.nmea.util.DataStatus;
import net.sf.marineapi.nmea.util.Direction;
import net.sf.marineapi.nmea.util.Measurement;
import net.sf.marineapi.nmea.util.Position;
import net.sf.marineapi.nmea.util.Units;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
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
    private final SatStatus stat=new SatStatus(0,0);
    private Location location=null;
    private long lastPositionReceived=0;
    public static final String LOGPRFX="AvNav:Decoder";
    private NmeaQueue queue;
    private static final long AIS_CLEANUP_INTERVAL=60000;
    private long lastReceived=0;

    public static final EditableParameter.IntegerParameter POSITION_AGE= new
            EditableParameter.IntegerParameter("posAge",R.string.labelSettingsPosAge,10);
    public static final EditableParameter.IntegerParameter NMEA_AGE = new
            EditableParameter.IntegerParameter("nmeaAge",R.string.labelSettingsAuxAge,600);
    public static final EditableParameter.IntegerParameter AIS_AGE= new
            EditableParameter.IntegerParameter("aisAge", R.string.labelSettingsAisLifetime,1200);
    public static final EditableParameter.StringParameter OWN_MMSI= new
            EditableParameter.StringParameter("ownMMSI",R.string.labelSettingsOwnMMSI,"");
    private void addParameters(){
        parameterDescriptions.addParams(OWN_MMSI,POSITION_AGE, NMEA_AGE,AIS_AGE,READ_TIMEOUT_PARAMETER);
    }
    static class AuxiliaryEntry{
        public long timeout;
        public JSONObject data=new JSONObject();
        public int priority=0;
    }
    private final HashMap<String,AuxiliaryEntry> auxiliaryData=new HashMap<String,AuxiliaryEntry>();

    private void addAuxiliaryData(String key, AuxiliaryEntry entry,long maxAge){
        long now=System.currentTimeMillis();
        entry.timeout=now+maxAge;
        AuxiliaryEntry current=auxiliaryData.get(key);
        if (current != null){
            //if not expired and higher prio - keep current
            if (current.timeout > now
                    && current.priority > entry.priority
            ) return;
        }
        auxiliaryData.put(key,entry);
    }
    private void mergeAuxiliaryData(JSONObject json) throws JSONException {
        long now=System.currentTimeMillis();
        //TODO: consider timestamp
        for (AuxiliaryEntry e: auxiliaryData.values()){
            if (e.timeout < now) continue;
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
        long validDate=0;
        long lastReceivedTime=System.currentTimeMillis();

        HashMap<Integer,GSVSentence> sentences=new HashMap<Integer,GSVSentence>();
        public void addSentence(GSVSentence gsv){
            lastReceivedTime=System.currentTimeMillis();
            if (gsv.isFirst()){
                numGsv=gsv.getSentenceCount();
                sentences.clear();
                isValid=false;
                validDate=0;
            }
            lastReceived=gsv.getSentenceIndex();
            sentences.put(gsv.getSentenceIndex(),gsv);
            if (gsv.isLast()){
                if (sentences.size() != numGsv){
                    AvnLog.e("missing GSV sentence expected count="+numGsv+", has="+sentences.size());
                }
                isValid=true;
                validDate=System.currentTimeMillis();
            }
        }
        public boolean getValid(){
            if (! isValid) return false;
            if (validDate == 0) return false;
            long now=System.currentTimeMillis();
            if ((now-validDate) > GSVAGE) return false;
            return true;
        }
        public int getSatCount(){
            if (! isValid) return 0;
            for (GSVSentence s: sentences.values()){
                return s.getSatelliteCount();
            }
            return 0;
        }
        public boolean isOutDated(){
            long now=System.currentTimeMillis();
            return ((now-lastReceivedTime) > GSVAGE);
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

    private static double knToMs(double v){
        return v/3600.0*AvnUtil.NM;
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
            int noDataTime=READ_TIMEOUT_PARAMETER.fromJson(parameters)*1000;
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
            long auxAge= NMEA_AGE.fromJson(parameters)*1000;
            long posAge= POSITION_AGE.fromJson(parameters) *1000;
            while (!shouldStop(startSequence)) {
                NmeaQueue.Entry entry;
                try {
                    entry = queue.fetch(sequence, 2000);
                } catch (InterruptedException e) {
                    if (shouldStop(startSequence)) return;
                    if ((lastReceived+ noDataTime) < System.currentTimeMillis()){
                        stat.gpsEnabled=false;
                        setStatus(WorkerStatus.Status.INACTIVE,"no NMEA data");
                    }
                    sleep(2000);
                    continue;
                }
                if ((lastReceived+ noDataTime) < System.currentTimeMillis()){
                    stat.gpsEnabled=false;
                    setStatus(WorkerStatus.Status.INACTIVE,"no NMEA data");
                }
                if (currentGsvStore == null || currentGsvStore.isOutDated()){
                    synchronized (stat){
                        stat.numSat=0;
                        stat.numUsed=0;
                    }
                }
                if (entry == null) {
                    continue;
                }
                sequence = entry.sequence;
                String line = entry.data;
                try {
                    if (line.startsWith("$")) {
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
                                    AvnLog.dfs("%s: GSV sentence (%d/%d) numSat=%d" ,
                                            getTypeName() ,gsv.getSentenceIndex(),
                                            gsv.getSentenceCount(),gsv.getSatelliteCount());
                                    if (currentGsvStore.getValid()) {
                                        numGsv = 0;
                                        synchronized (stat){
                                            stat.numSat=currentGsvStore.getSatCount();
                                        }
                                        currentGsvStore = new GSVStore();
                                        AvnLog.dfs("%s: GSV sentence last, numSat=%d",getTypeName(),stat.numSat);
                                    }
                                    if (numGsv > GSVStore.MAXGSV) {
                                        AvnLog.e(getTypeName() + ": to many gsv sentences without a final one " + numGsv);
                                        synchronized (stat) {
                                            stat.numSat = 0;
                                            stat.numUsed=0;
                                        }
                                        currentGsvStore=null;
                                    }

                                    continue;
                                }
                                if (s instanceof GSASentence) {
                                    stat.numUsed = ((GSASentence) s).getSatelliteIds().length;
                                    AvnLog.dfs("%s: GSA sentence, used=%d",
                                            getTypeName(),stat.numUsed);
                                    continue;
                                }
                                if (s instanceof MWVSentence) {
                                    MWVSentence m = (MWVSentence) s;
                                    AvnLog.d("%s: MWV sentence",getTypeName() );
                                    AuxiliaryEntry e = new AuxiliaryEntry();
                                    e.data.put("windAngle", m.getAngle());
                                    e.data.put("windReference", m.isTrue() ? "T" : "R");
                                    double speed = m.getSpeed();
                                    if (m.getSpeedUnit().equals(Units.KMH)) {
                                        speed = speed / 3.6;
                                    }
                                    if (m.getSpeedUnit().equals(Units.KNOT)) {
                                        speed = knToMs(speed);
                                    }
                                    e.data.put("windSpeed", speed);
                                    if (!m.isTrue()) e.priority=1; //prefer apparent if it is there
                                    addAuxiliaryData(s.getSentenceId(), e,posAge);
                                    continue;
                                }
                                if (s instanceof VWRSentence){
                                    VWRSentence w=(VWRSentence)s;
                                    AvnLog.d("%s: VWR sentence",getTypeName() );
                                    AuxiliaryEntry e = new AuxiliaryEntry();
                                    double wangle=w.getWindAngle();
                                    Direction wdir=w.getDirectionLeftRight();
                                    if (wdir == Direction.LEFT) wangle=360-wangle;
                                    e.data.put("windAngle",wangle);
                                    e.data.put("windReference","R");
                                    try{
                                        double speed=w.getSpeedKnots();
                                        e.data.put("windSpeed",knToMs(speed));
                                    }catch (Throwable t){
                                        try{
                                            double speed=w.getSpeedKmh();
                                            e.data.put("windSpeed",speed/3.6);
                                        }catch (Throwable x){}
                                    }
                                    addAuxiliaryData(s.getSentenceId(), e,posAge);
                                    continue;
                                }
                                if (s instanceof DPTSentence) {
                                    DPTSentence d = (DPTSentence) s;
                                    AvnLog.d("%s: DPT sentence",getTypeName() );
                                    AuxiliaryEntry e = new AuxiliaryEntry();
                                    double depth = d.getDepth();
                                    e.data.put("depthBelowTransducer", depth);
                                    double offset = d.getOffset();
                                    if (offset >= 0) {
                                        e.data.put("depthBelowWaterline", depth + offset);
                                    } else {
                                        e.data.put("depthBelowKeel", depth + offset);
                                    }
                                    addAuxiliaryData(s.getSentenceId(), e,posAge);
                                    continue;
                                }
                                if (s instanceof DBTSentence) {
                                    DBTSentence d = (DBTSentence) s;
                                    AvnLog.d("%s: DBT sentence",getTypeName() );
                                    AuxiliaryEntry e = new AuxiliaryEntry();
                                    double depth = d.getDepth();
                                    e.data.put("depthBelowTransducer", depth);
                                    addAuxiliaryData(s.getSentenceId(), e,posAge);
                                    continue;
                                }
                                if (s instanceof MTWSentence) {
                                    MTWSentence d = (MTWSentence) s;
                                    AvnLog.d("%s: MTW sentence",getTypeName() );
                                    AuxiliaryEntry e = new AuxiliaryEntry();
                                    double waterTemp = d.getTemperature() + 273.15;
                                    e.data.put("waterTemp", waterTemp);
                                    addAuxiliaryData(s.getSentenceId(), e,posAge);
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
                                            addAuxiliaryData(s.getSentenceId() + "." + tname, e,auxAge);
                                        }
                                    }

                                }
                                if (s instanceof HDMSentence ){
                                    HDMSentence sh=(HDMSentence)s;
                                    AvnLog.dfs("%s: HDM sentence",getTypeName() );
                                    AuxiliaryEntry e = new AuxiliaryEntry();
                                    e.data.put("headingMag",sh.getHeading());
                                    addAuxiliaryData(s.getSentenceId(),e,posAge);
                                    continue;
                                }
                                if (s instanceof HDTSentence ){
                                    HDTSentence sh=(HDTSentence)s;
                                    AvnLog.dfs("%s: %s sentence",getTypeName(),s.getSentenceId() );
                                    AuxiliaryEntry e = new AuxiliaryEntry();
                                    e.data.put("headingTrue",sh.getHeading());
                                    addAuxiliaryData(s.getSentenceId(),e,posAge);
                                    continue;
                                }
                                if (s instanceof VHWSentence){
                                    VHWSentence sv=(VHWSentence)s;
                                    AvnLog.dfs("%s: %s sentence",getTypeName(), s.getSentenceId());
                                    AuxiliaryEntry e = new AuxiliaryEntry();
                                    boolean hasData=false;
                                    try {
                                        e.data.put("headingMag", sv.getMagneticHeading());
                                        hasData=true;
                                    }catch (Exception sv1){}
                                    try {
                                        e.data.put("headingTrue", sv.getHeading());
                                        hasData=true;
                                    }catch(Exception sv2){}
                                    try {
                                        e.data.put("waterSpeed", knToMs(sv.getSpeedKnots()));
                                        hasData=true;
                                    }catch(Exception sv3){}
                                    if (hasData) {
                                        addAuxiliaryData(s.getSentenceId(), e, posAge);
                                    }
                                    else{
                                        AvnLog.dfs("no data in %s",s.getSentenceId());
                                    }
                                    continue;
                                }
                                if (s instanceof HDGSentence){
                                    HDGSentence sh=(HDGSentence)s;
                                    AvnLog.dfs("%s: %s sentence",getTypeName(),s.getSentenceId() );
                                    AuxiliaryEntry e = new AuxiliaryEntry();
                                    double heading=sh.getHeading();
                                    try{
                                        heading+=sh.getDeviation();
                                    }catch (Exception he){}
                                    e.data.put("headingMag", heading);
                                    try{
                                        heading+=sh.getVariation();
                                        e.data.put("headingTrue",heading);
                                    }catch(Exception h2e){}
                                    addAuxiliaryData(s.getSentenceId(),e,posAge);
                                    continue;
                                }
                                Position p = null;
                                if (s instanceof PositionSentence) {
                                    //we need to verify the position quality
                                    //it could be either RMC or GLL - they have DataStatus or GGA - GpsFixQuality
                                    boolean isValid = false;
                                    if (s instanceof RMCSentence) {
                                        isValid = ((RMCSentence) s).getStatus() == DataStatus.ACTIVE;
                                        AvnLog.dfs("%s: RMC sentence, valid=%s",getTypeName() ,isValid);
                                    }
                                    if (s instanceof GLLSentence) {
                                        isValid = ((GLLSentence) s).getStatus() == DataStatus.ACTIVE;
                                        AvnLog.dfs("%s: GLL sentence, valid=%s",
                                                getTypeName() , isValid);
                                    }
                                    if (s instanceof GGASentence) {
                                        int qual = ((GGASentence) s).getFixQuality().toInt();
                                        isValid = qual > 0;
                                        AvnLog.dfs("%s: GGA sentence, quality=%d, valid=%s",getTypeName() ,qual,isValid);
                                    }
                                    if (isValid) {
                                        p = ((PositionSentence) s).getPosition();
                                        AvnLog.dfs( "%s: external position %s",getTypeName() ,p);
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
                                                AvnLog.dfs("%s: Exception querying speed: %s",getTypeName() ,i.getLocalizedMessage());
                                            }
                                            try {
                                                location.setBearing((float) (((RMCSentence) s).getCourse()));
                                            } catch (Exception i) {
                                                AvnLog.dfs("%s: Exception querying bearing: %s",getTypeName() , i.getLocalizedMessage());
                                            }
                                        }
                                        AvnLog.d(LOGPRFX, getTypeName() + ": location: " + location);
                                    }
                                } else {
                                    AvnLog.d(LOGPRFX, getTypeName() + ": ignoring sentence " + line + " - no position or time");
                                }
                            } catch (Exception i) {
                                AvnLog.e(getTypeName() + ": exception in NMEA parser "+line ,i);
                            }
                        } else {
                            AvnLog.d(LOGPRFX, getTypeName() + ": ignore invalid nmea");
                        }
                    }
                    if (line.startsWith("!")) {
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

    Decoder(String name, GpsService ctx, NmeaQueue queue){
        super(name,ctx);
        this.queue=queue;
        addParameters();
        status.canEdit=true;
        dateFormat.setTimeZone(TimeZone.getTimeZone("UTC"));
    }

    @Override
    public synchronized void setParameters(JSONObject newParam, boolean replace, boolean check) throws JSONException, IOException {
        if (replace){
            try{
                super.setParameters(newParam,true,check);
            }catch (JSONException | IOException e){
                AvnLog.e(getTypeName()+": config error",e);
                //we fall back to save settings
                super.setParameters(new JSONObject(),true,check);
            }
            return;
        }
        super.setParameters(newParam, replace,check);
    }

    SatStatus getSatStatus() {
        synchronized (stat) {
            return new SatStatus(stat);
        }
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
        JSONObject rt=new JSONObject();
        rt.put(G_MODE,1);
        if (curLoc != null) {
            rt.put(G_LAT, curLoc.getLatitude());
            rt.put(G_LON, curLoc.getLongitude());
            rt.put(G_COURSE, curLoc.getBearing());
            rt.put(G_SPEED, curLoc.getSpeed());
            rt.put(G_TIME, dateFormat.format(new Date(curLoc.getTime())));
        }
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
            this.gpsEnabled=false;
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
