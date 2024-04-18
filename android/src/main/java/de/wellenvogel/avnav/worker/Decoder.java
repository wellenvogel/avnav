package de.wellenvogel.avnav.worker;

import android.location.Location;
import android.os.SystemClock;
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
import net.sf.marineapi.nmea.sentence.MWDSentence;
import net.sf.marineapi.nmea.sentence.MWVSentence;
import net.sf.marineapi.nmea.sentence.PositionSentence;
import net.sf.marineapi.nmea.sentence.RMCSentence;
import net.sf.marineapi.nmea.sentence.Sentence;
import net.sf.marineapi.nmea.sentence.SentenceValidator;
import net.sf.marineapi.nmea.sentence.TalkerId;
import net.sf.marineapi.nmea.sentence.TimeSentence;
import net.sf.marineapi.nmea.sentence.VDRSentence;
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
import de.wellenvogel.avnav.util.MovingSum;
import de.wellenvogel.avnav.util.NmeaQueue;

/**
 * Created by andreas on 25.12.14.
 */
public class Decoder extends Worker {
    private static final String K_SET = "currentSet";
    private static final String K_DFT = "currentDrift";
    private static final String K_HDGT = "headingTrue";
    private static final String K_HDGM = "headingMag";
    private static final String K_MDEV = "magDeviation";
    private static final String K_MAGVAR = "magVariation";
    private static final String K_HDGC = "headingCompass";
    private static final String K_DEPTHT = "depthBelowTransducer";
    private static final String K_DEPTHW = "depthBelowWaterline";
    private static final String K_DEPTHK = "depthBelowKeel";
    private static final String K_VHWS = "waterSpeed";
    private static final String K_VWTT = "waterTemp";
    public SimpleDateFormat dateFormat=new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSSZ");
    private long lastAisCleanup=0;
    private AisStore store=null;
    private GSVStore currentGsvStore=null;
    private Location location=null;
    private int locationPriority=0;
    private long lastPositionReceived=0;
    public static final String LOGPRFX="AvNav:Decoder";
    private NmeaQueue queue;
    private static final long AIS_CLEANUP_INTERVAL=60000;
    private String lastPositionSource="";
    private String lastAisSource="";

    public static final EditableParameter.IntegerParameter POSITION_AGE= new
            EditableParameter.IntegerParameter("posAge",R.string.labelSettingsPosAge,10);
    public static final EditableParameter.IntegerParameter NMEA_AGE = new
            EditableParameter.IntegerParameter("nmeaAge",R.string.labelSettingsAuxAge,600);
    public static final EditableParameter.IntegerParameter AIS_AGE= new
            EditableParameter.IntegerParameter("aisAge", R.string.labelSettingsAisLifetime,1200);
    public static final EditableParameter.StringParameter OWN_MMSI= new
            EditableParameter.StringParameter("ownMMSI",R.string.labelSettingsOwnMMSI,"");
    private SatStatus satStatus=null;
    private NmeaQueue.Fetcher fetcher;

    private void addParameters(){
        parameterDescriptions.addParams(OWN_MMSI,POSITION_AGE, NMEA_AGE,AIS_AGE, QUEUE_AGE_PARAMETER);
    }
    static class AuxiliaryEntry{
        public long timeout;
        public JSONObject data=new JSONObject();
        public int priority=0;
        public AuxiliaryEntry(int priority){
            this.priority=priority;
        }
    }


    private final HashMap<String,AuxiliaryEntry> auxiliaryData=new HashMap<String,AuxiliaryEntry>();

    private synchronized void addAuxiliaryData(String key, AuxiliaryEntry entry,long maxAge){
        long now=SystemClock.uptimeMillis();
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
    private synchronized void mergeAuxiliaryData(JSONObject json) throws JSONException {
        long now=SystemClock.uptimeMillis();
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
        private int numGsv=0;
        private int lastReceived=0;
        private boolean isValid=false;
        private long validDate=0;
        private long lastReceivedTime=SystemClock.uptimeMillis();
        private int sourcePriority=0;
        private int numUsed=0;
        private HashMap<Integer,GSVSentence> sentences=new HashMap<Integer,GSVSentence>();

        public GSVStore(int priority){
            sourcePriority=priority;
        }
        public boolean setSourcePriority(int priority){
            //we let the position set our priority
            lastReceivedTime=SystemClock.uptimeMillis();
            if (priority != sourcePriority){
                numUsed=0;
                lastReceived=0;
                sentences.clear();
                numGsv=0;
                isValid=false;
                sourcePriority=priority;
                return true;
            }
            return false;
        }
        public void addSentence(GSVSentence gsv, int priority){
            if (priority < sourcePriority){
                if (! isOutDated()) return;
            }
            lastReceivedTime=SystemClock.uptimeMillis();
            if (priority != sourcePriority){
                sentences.clear();
                isValid=false;
                validDate=0;
                numGsv=0;
                sourcePriority=priority;
                if (! gsv.isFirst()) return;
            }
            if (gsv.isFirst()){
                numGsv=gsv.getSentenceCount();
                sentences.clear();
                isValid=false;
                validDate=0;
            }
            if (sentences.size() >= (numGsv-1) && ! gsv.isLast()){
                AvnLog.e("too many gsv sentences without last");
                return;
            }
            lastReceived=gsv.getSentenceIndex();
            sentences.put(gsv.getSentenceIndex(),gsv);
            if (gsv.isLast()){
                if (sentences.size() != numGsv){
                    AvnLog.e("missing GSV sentence expected count="+numGsv+", has="+sentences.size());
                }
                isValid=true;
                validDate=SystemClock.uptimeMillis();
            }
        }
        public void setNumUsed(int num, int priority){
            if (priority == sourcePriority){
                numUsed=num;
            }
        }
        public boolean getValid(){
            if (! isValid) return false;
            if (validDate == 0) return false;
            long now=SystemClock.uptimeMillis();
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
        public int getNumUsed(){
            if (! isValid) return 0;
            return numUsed;
        }
        public boolean isOutDated(){
            long now=SystemClock.uptimeMillis();
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
        private static class WindKeys{
            public String angle;
            public String speed;
            public static final int TRUEA=1;
            public static final int TRUED=2;
            public static final int APP=3;
            public WindKeys(int kind){
                if (kind == APP){
                    angle="windAngle";
                    speed="windSpeed";
                }
                if (kind == TRUEA){
                    angle="trueWindAngle";
                    speed="trueWindSpeed";
                }
                if (kind == TRUED){
                    angle="trueWindDirection";
                    speed="trueWindSpeed";
                }
            }
        }


        @Override
        public void run(int startSequence) throws JSONException {
            store=new AisStore(OWN_MMSI.fromJson(parameters));
            SentenceFactory factory = SentenceFactory.getInstance();
            HashMap<String,AisPacketParser> aisparsers=new HashMap<>();
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
            long queueAge = QUEUE_AGE_PARAMETER.fromJson(parameters);
            fetcher.reset();
            while (!shouldStop(startSequence)) {
                NmeaQueue.Entry entry;
                try {
                    entry = fetcher.fetch(200,queueAge);
                } catch (InterruptedException e) {
                    if (shouldStop(startSequence)) return;
                    sleep(2000);
                    continue;
                }
                if (shouldStop(startSequence)) return;
                if (entry == null) {
                    continue;
                }
                String line = entry.data;
                try {
                    if (line.startsWith("$")) {
                        //NMEA
                        if (entry.validated) {
                            try {
                                line = correctTalker(line);
                                Sentence s = factory.createParser(line);
                                if (s instanceof DateSentence) {
                                    lastDate = ((DateSentence) s).getDate();
                                }
                                if (s instanceof GSVSentence) {
                                    if (currentGsvStore == null) currentGsvStore = new GSVStore(locationPriority);
                                    GSVSentence gsv = (GSVSentence) s;
                                    currentGsvStore.addSentence(gsv,entry.priority);
                                    AvnLog.dfs("%s: GSV sentence (%d/%d) numSat=%d" ,
                                            getTypeName() ,gsv.getSentenceIndex(),
                                            gsv.getSentenceCount(),gsv.getSatelliteCount());
                                    if (currentGsvStore.getValid()) {
                                        satStatus=new SatStatus(currentGsvStore.getSatCount(),currentGsvStore.getNumUsed(),fetcher.hasData());
                                        currentGsvStore = new GSVStore(locationPriority);
                                        AvnLog.dfs("%s: GSV sentence last, numSat=%d",getTypeName(),satStatus.numSat);
                                    }
                                    continue;
                                }
                                if (s instanceof GSASentence) {
                                    if (currentGsvStore != null) {
                                        currentGsvStore.setNumUsed(((GSASentence) s).getSatelliteIds().length, entry.priority);
                                        AvnLog.dfs("%s: GSA sentence, used=%d",
                                                getTypeName(), currentGsvStore.getNumUsed());
                                    }
                                    continue;
                                }
                                if (s instanceof MWVSentence) {
                                    MWVSentence m = (MWVSentence) s;
                                    AvnLog.d("%s: MWV sentence",getTypeName() );
                                    AuxiliaryEntry e = new AuxiliaryEntry(entry.priority);
                                    WindKeys keys=new WindKeys(m.isTrue()?WindKeys.TRUEA:WindKeys.APP);
                                    e.data.put(keys.angle, m.getAngle());
                                    double speed = m.getSpeed();
                                    if (m.getSpeedUnit().equals(Units.KMH)) {
                                        speed = speed / 3.6;
                                    }
                                    if (m.getSpeedUnit().equals(Units.KNOT)) {
                                        speed = knToMs(speed);
                                    }
                                    e.data.put(keys.speed, speed);
                                    addAuxiliaryData(s.getSentenceId()+(m.isTrue()?"T":"A"), e,posAge);
                                    continue;
                                }
                                if (s instanceof MWDSentence){
                                    MWDSentence m = (MWDSentence) s;
                                    AvnLog.d("%s: MWD sentence",getTypeName() );
                                    AuxiliaryEntry e = new AuxiliaryEntry(entry.priority);
                                    WindKeys keys=new WindKeys(WindKeys.TRUED);
                                    boolean hasData=false;
                                    double direction=m.getTrueWindDirection();
                                    if (Double.isNaN(direction)){
                                        direction=m.getMagneticWindDirection();
                                    }
                                    if (! Double.isNaN(direction)){
                                        hasData=true;
                                        e.data.put(keys.angle,direction);
                                    }
                                    double speed=m.getWindSpeed();
                                    if (Double.isNaN(speed)){
                                        speed=m.getWindSpeedKnots();
                                        if (! Double.isNaN(speed)){
                                            speed=knToMs(speed);
                                        }
                                    }
                                    if (! Double.isNaN(speed)){
                                        hasData=true;
                                        e.data.put(keys.speed,speed);
                                    }
                                    if (hasData){
                                        addAuxiliaryData(s.getSentenceId(), e,posAge);
                                    }
                                    continue;
                                }
                                if (s instanceof VWRSentence){
                                    VWRSentence w=(VWRSentence)s;
                                    AvnLog.d("%s: VWR sentence",getTypeName() );
                                    AuxiliaryEntry e = new AuxiliaryEntry(entry.priority);
                                    double wangle=w.getWindAngle();
                                    Direction wdir=w.getDirectionLeftRight();
                                    if (wdir == Direction.LEFT) wangle=360-wangle;
                                    WindKeys keys=new WindKeys(WindKeys.APP);
                                    e.data.put(keys.angle,wangle);
                                    try{
                                        double speed=w.getSpeedKnots();
                                        e.data.put(keys.speed,knToMs(speed));
                                    }catch (Throwable t){
                                        try{
                                            double speed=w.getSpeedKmh();
                                            e.data.put(keys.speed,speed/3.6);
                                        }catch (Throwable x){}
                                    }
                                    addAuxiliaryData(s.getSentenceId(), e,posAge);
                                    continue;
                                }
                                if (s instanceof DPTSentence) {
                                    DPTSentence d = (DPTSentence) s;
                                    AvnLog.d("%s: DPT sentence",getTypeName() );
                                    AuxiliaryEntry e = new AuxiliaryEntry(entry.priority);
                                    double depth = d.getDepth();
                                    e.data.put(K_DEPTHT, depth);
                                    double offset = d.getOffset();
                                    if (offset >= 0) {
                                        e.data.put(K_DEPTHW, depth + offset);
                                    } else {
                                        e.data.put(K_DEPTHK, depth + offset);
                                    }
                                    addAuxiliaryData(s.getSentenceId(), e,posAge);
                                    continue;
                                }
                                if (s instanceof DBTSentence) {
                                    DBTSentence d = (DBTSentence) s;
                                    AvnLog.d("%s: DBT sentence",getTypeName() );
                                    AuxiliaryEntry e = new AuxiliaryEntry(entry.priority);
                                    double depth = d.getDepth();
                                    e.data.put(K_DEPTHT, depth);
                                    addAuxiliaryData(s.getSentenceId(), e,posAge);
                                    continue;
                                }
                                if (s instanceof MTWSentence) {
                                    MTWSentence d = (MTWSentence) s;
                                    AvnLog.d("%s: MTW sentence",getTypeName() );
                                    AuxiliaryEntry e = new AuxiliaryEntry(entry.priority);
                                    double waterTemp = d.getTemperature() + 273.15;
                                    e.data.put(this.K_VWTT, waterTemp);
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
                                        if (tname != null ) {
                                            AuxiliaryEntry e = new AuxiliaryEntry(entry.priority);
                                            e.data.put("transducers." + tname, convertTransducerValue(ttype, tunit, tval));
                                            addAuxiliaryData(s.getSentenceId() + "." + tname, e,auxAge);
                                        }
                                    }

                                }
                                if (s instanceof HDMSentence ){
                                    HDMSentence sh=(HDMSentence)s;
                                    AvnLog.dfs("%s: HDM sentence",getTypeName() );
                                    AuxiliaryEntry e = new AuxiliaryEntry(entry.priority);
                                    e.data.put(K_HDGM,sh.getHeading());
                                    addAuxiliaryData(s.getSentenceId(),e,posAge);
                                    continue;
                                }
                                if (s instanceof HDTSentence ){
                                    HDTSentence sh=(HDTSentence)s;
                                    AvnLog.dfs("%s: %s sentence",getTypeName(),s.getSentenceId() );
                                    AuxiliaryEntry e = new AuxiliaryEntry(entry.priority);
                                    e.data.put(K_HDGT,sh.getHeading());
                                    addAuxiliaryData(s.getSentenceId(),e,posAge);
                                    continue;
                                }
                                if (s instanceof VDRSentence){
                                    VDRSentence vdr=(VDRSentence) s;
                                    AvnLog.dfs("%s: %s sentence",getTypeName(),s.getSentenceId() );
                                    AuxiliaryEntry e = new AuxiliaryEntry(entry.priority);
                                    try{
                                        double strue=vdr.getTrueDirection();
                                        e.data.put(K_SET,strue);
                                    }catch (Exception v1){}
                                    try{
                                        double drift=vdr.getSpeed();
                                        e.data.put(K_DFT,drift);
                                    }catch (Exception v2){}
                                    if (e.data.length()>0){
                                        addAuxiliaryData(s.getSentenceId(),e,posAge);
                                    }
                                }
                                if (s instanceof VHWSentence){
                                    VHWSentence sv=(VHWSentence)s;
                                    AvnLog.dfs("%s: %s sentence",getTypeName(), s.getSentenceId());
                                    AuxiliaryEntry e = new AuxiliaryEntry(entry.priority);
                                    boolean hasData=false;
                                    try {
                                        e.data.put(K_HDGM, sv.getMagneticHeading());
                                        hasData=true;
                                    }catch (Exception sv1){}
                                    try {
                                        e.data.put(K_HDGT, sv.getHeading());
                                        hasData=true;
                                    }catch(Exception sv2){}
                                    try {
                                        e.data.put(K_VHWS, knToMs(sv.getSpeedKnots()));
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
                                    AuxiliaryEntry e = new AuxiliaryEntry(entry.priority);
                                    double heading=sh.getHeading();
                                    e.data.put(K_HDGC,heading);
                                    try{
                                        double mDev=sh.getDeviation();
                                        e.data.put(K_MDEV,mDev);
                                        heading+=mDev;
                                        e.data.put(K_HDGM, heading);
                                    }catch (Exception he){}
                                    try{
                                        double mVar=sh.getVariation();
                                        e.data.put(K_MAGVAR,mVar);
                                        heading+=mVar;
                                        e.data.put(K_HDGT,heading);
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
                                        RMCSentence rmc=(RMCSentence) s;
                                        isValid = rmc.getStatus() == DataStatus.ACTIVE;
                                        AvnLog.dfs("%s: RMC sentence, valid=%s",getTypeName() ,isValid);
                                        if (isValid) {
                                            try {
                                                double mvar = rmc.getVariation();
                                                AuxiliaryEntry e = new AuxiliaryEntry(entry.priority);
                                                e.data.put(K_MAGVAR,mvar);
                                                addAuxiliaryData(s.getSentenceId(),e,posAge);
                                            }catch(Exception re){}
                                        }
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
                                        boolean setValues=false;
                                        Location lastLocation=null;
                                        if (entry.priority == locationPriority){
                                            setValues=true;
                                            lastLocation=location;
                                        }
                                        if (entry.priority > locationPriority){
                                            locationPriority=entry.priority;
                                            setValues=true;
                                        }
                                        if (entry.priority < locationPriority){
                                            if (! locationValid()){
                                                setValues=true;
                                                locationPriority=entry.priority;
                                            }
                                        }
                                        if (setValues) {
                                            if (currentGsvStore != null) {
                                                if (currentGsvStore.setSourcePriority(locationPriority)){
                                                    satStatus=null;
                                                };
                                            }
                                            lastPositionSource=entry.source;
                                            Location newLocation = null;
                                            if (lastLocation != null) {
                                                newLocation = new Location(lastLocation);
                                            } else {
                                                newLocation = new Location((String) null);
                                            }
                                            lastPositionReceived = SystemClock.uptimeMillis();
                                            newLocation.setLatitude(p.getLatitude());
                                            newLocation.setLongitude(p.getLongitude());
                                            newLocation.setTime(AvnUtil.toTimeStamp(lastDate, time));
                                            location = newLocation;
                                            if (s.getSentenceId().equals("RMC")) {
                                                try {
                                                    location.setSpeed((float) (((RMCSentence) s).getSpeed() / AvnUtil.msToKn));
                                                } catch (Exception i) {
                                                    AvnLog.dfs("%s: Exception querying speed: %s", getTypeName(), i.getLocalizedMessage());
                                                }
                                                try {
                                                    location.setBearing((float) (((RMCSentence) s).getCourse()));
                                                } catch (Exception i) {
                                                    AvnLog.dfs("%s: Exception querying bearing: %s", getTypeName(), i.getLocalizedMessage());
                                                }
                                            }
                                            AvnLog.d(LOGPRFX, getTypeName() + ": location: " + location);
                                        }
                                        else{
                                            AvnLog.d(LOGPRFX,getTypeName()+": location ignored newPrio="+entry.priority+", existingPrio="+locationPriority);
                                        }
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
                        AisPacketParser aisparser= aisparsers.get(entry.source);
                        if (aisparser == null){
                            aisparser=new AisPacketParser();
                            aisparsers.put(entry.source,aisparser);
                        }
                        if (Abk.isAbk(line)) {
                            aisparser.newVdm();
                            AvnLog.i(LOGPRFX, getTypeName() + ": ignore abk line " + line);
                        }
                        try {
                            AisPacket p = aisparser.readLine(line);
                            if (p != null) {
                                AisMessage m = p.getAisMessage();
                                AvnLog.i(LOGPRFX, getTypeName() + ": AisPacket received: " + m.toString());
                                if (store.addAisMessage(m,entry.priority)){
                                    lastAisSource=entry.source;
                                };
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
            long now=SystemClock.uptimeMillis();
            if (now > (lastAisCleanup+AIS_CLEANUP_INTERVAL)) {
                lastAisCleanup=now;
                store.cleanup(lifetime);
            }
        }//satellite view
    }

    Decoder(String name, GpsService ctx, NmeaQueue queue){
        super(name,ctx);
        this.queue=queue;
        this.fetcher=new NmeaQueue.Fetcher(queue, new NmeaQueue.Fetcher.StatusUpdate() {
            @Override
            public void update(MovingSum received, MovingSum errors) {
                setStatus(fetcher.hasData()? WorkerStatus.Status.NMEA: WorkerStatus.Status.INACTIVE,
                        fetcher.getStatusString());
            }
        },200);
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
        SatStatus st=satStatus;
        if (st == null) st=new SatStatus(0,0, fetcher.hasData());
        return st;
    }


    @Override
    public synchronized void stop() {
        super.stop();
        queue.clear();
    }

    private boolean locationValid() throws JSONException {
        long current=SystemClock.uptimeMillis();
        if (current > (lastPositionReceived+POSITION_AGE.fromJson(parameters)*1000)){
            return false;
        }
        return true;
    }

    public Location getLocation() throws JSONException {
        if (! locationValid()) return null;
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
     * @param centers
     *
     * @param distance in nm
     * @return
     */
    public JSONArray  getAisData(List<Location> centers,double distance){
        if (store != null) return store.getAisData(centers,distance);
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
        private int numSat=0;
        private int numUsed=0;
        private boolean gpsEnabled; //for external connections this shows if it is connected
        private long createdTime;

        public SatStatus(int numSat,int numUsed, boolean gpsEnabled){
            this.numSat=numSat;
            this.numUsed=numUsed;
            this.gpsEnabled=gpsEnabled;
            this.createdTime= SystemClock.uptimeMillis();
        }

        public int getNumSat() {
            if (! isValid()) return 0;
            return numSat;
        }

        public int getNumUsed() {
            if (! isValid()) return 0;
            return numUsed;
        }

        public boolean isGpsEnabled() {
            return gpsEnabled;
        }

        public boolean isValid(){
            return (SystemClock.uptimeMillis()-createdTime) < GSVStore.GSVAGE;
        }
        public String toString(){
            return "Sat num="+numSat+", used="+numUsed;
        }
    }

    public synchronized void cleanup(){
        store.cleanup(-1); //cleanup all
        locationPriority=0;
        location=null;
        lastPositionReceived=0;
        auxiliaryData.clear();
        satStatus=null;
    }

    public String getLastPositionSource() {
        return lastPositionSource;
    }

    public String getLastAisSource() {
        return lastAisSource;
    }
}
