package de.wellenvogel.avnav.worker;

import android.location.Location;
import android.os.SystemClock;
import android.util.Log;
import android.util.Pair;

import net.sf.marineapi.nmea.parser.DataNotAvailableException;
import net.sf.marineapi.nmea.parser.SentenceFactory;
import net.sf.marineapi.nmea.parser.SentenceParser;
import net.sf.marineapi.nmea.sentence.DBTSentence;
import net.sf.marineapi.nmea.sentence.DPTSentence;
import net.sf.marineapi.nmea.sentence.DateSentence;
import net.sf.marineapi.nmea.sentence.DepthSentence;
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
import net.sf.marineapi.nmea.sentence.TalkerId;
import net.sf.marineapi.nmea.sentence.TimeSentence;
import net.sf.marineapi.nmea.sentence.VDRSentence;
import net.sf.marineapi.nmea.sentence.VHWSentence;
import net.sf.marineapi.nmea.sentence.VTGSentence;
import net.sf.marineapi.nmea.sentence.VWRSentence;
import net.sf.marineapi.nmea.sentence.XDRSentence;
import net.sf.marineapi.nmea.util.DataStatus;
import net.sf.marineapi.nmea.util.Direction;
import net.sf.marineapi.nmea.util.Measurement;
import net.sf.marineapi.nmea.util.Position;
import net.sf.marineapi.nmea.util.SatelliteInfo;
import net.sf.marineapi.nmea.util.Units;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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

    public static final String K_LON ="lon";
    public static final String K_LAT ="lat";
    public static final String K_COURSE ="course";
    public static final String K_SPEED="speed";
    public static final String K_TIME ="time";

    public static final String IK_TIME="_time";
    public static final String IK_DATE="_date";
    public SimpleDateFormat dateFormat=new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSSZ");
    private long lastAisCleanup=0;
    private AisStore store=null;
    private GSVStores gsvStores=new GSVStores();
    public static final String LOGPRFX="AvNav:Decoder";
    private NmeaQueue queue;
    private static final long AIS_CLEANUP_INTERVAL=60000;
    private String lastAisSource="";

    public static final EditableParameter.IntegerParameter POSITION_AGE= new
            EditableParameter.IntegerParameter("posAge",R.string.labelSettingsPosAge,10);
    public static final EditableParameter.IntegerParameter NMEA_AGE = new
            EditableParameter.IntegerParameter("nmeaAge",R.string.labelSettingsAuxAge,600);
    public static final EditableParameter.IntegerParameter AIS_AGE= new
            EditableParameter.IntegerParameter("aisAge", R.string.labelSettingsAisLifetime,1200);
    public static final EditableParameter.StringParameter OWN_MMSI= new
            EditableParameter.StringParameter("ownMMSI",R.string.labelSettingsOwnMMSI,"");
    private NmeaQueue.Fetcher fetcher;

    private void addParameters(){
        parameterDescriptions.addParams(OWN_MMSI,POSITION_AGE, NMEA_AGE,AIS_AGE, QUEUE_AGE_PARAMETER);
    }

    private static class NmeaEntry {
      public Object value;
      public String key;
      int priority;
      long timeout;
      String source;
      public NmeaEntry(String k, Object v, NmeaQueue.Entry qe, long t){
          priority=qe.priority;
          source=qe.source;
          key=k;
          value=v;
          timeout=t;
      }
      public NmeaEntry(String k){
          key=k;
          timeout=0;
      }
      void toJson(JSONObject o) throws JSONException {
          o.put(key,value);
      }
      public boolean valid(long now){
          return now <= timeout;
      }
      public boolean valid(){
            return timeout >= SystemClock.uptimeMillis();
        }
    };
    private static class NoJsonNmeaEntry extends NmeaEntry{
        public NoJsonNmeaEntry(String k, Object v, NmeaQueue.Entry qe, long t){
            super(k,v,qe,t);
        }

        @Override
        void toJson(JSONObject o) throws JSONException {
        }
    }

    private static class EmptyNmeaEntry extends NmeaEntry{
        public EmptyNmeaEntry(String k){
            super(k);
        }

        @Override
        void toJson(JSONObject o) throws JSONException {
        }

        @Override
        public boolean valid(long now) {
            return false;
        }

        @Override
        public boolean valid() {
            return false;
        }
    }
    private final HashMap<String, NmeaEntry> nmeaData =new HashMap<String, NmeaEntry>();

    private synchronized List<NmeaEntry> getEntries(String...keys){
        ArrayList<NmeaEntry> rt=new ArrayList<>();
        for (String k:keys){
            NmeaEntry next=nmeaData.get(k);
            if (next == null) next=new EmptyNmeaEntry(k);
            rt.add(next);
        }
        return rt;
    }

    private synchronized boolean addNmeaData(List<NmeaEntry>entries){
        //only add the data if none of the items has an entry with higher prio
        //this allows to ensure that e.g. a position always is provided by one
        //source - even if it has multiple keys
        long now=SystemClock.uptimeMillis();
        for (NmeaEntry de : entries) {
            if (de != null) {
                NmeaEntry current = nmeaData.get(de.key);
                if (current != null) {
                    //if not expired and higher prio - keep current
                    if (current.valid(now) && current.priority > de.priority) {
                        return false;
                    }
                }
            }
        }
        for (NmeaEntry de : entries) {
            if (de != null) {
                nmeaData.put(de.key, de);
            }
        }
        return true;
    }
    private synchronized boolean addNmeaData(NmeaEntry de) {
        if (de != null) {
            NmeaEntry current = nmeaData.get(de.key);
            if (current != null) {
                //if not expired and higher prio - keep current
                if (current.valid() && current.priority > de.priority) {
                    return false;
                }
            }
            nmeaData.put(de.key,de);
            return true;
        }
        return false;
    }
    private synchronized boolean addNmeaData(String key, Object value, NmeaQueue.Entry qe, long maxAge){
        NmeaEntry de=new NmeaEntry(key,value,qe,SystemClock.uptimeMillis()+maxAge);
        return addNmeaData(de);
    }
    private synchronized void mergeNmeaData(JSONObject json) throws JSONException {
        long now=SystemClock.uptimeMillis();
        for (NmeaEntry e: nmeaData.values()){
            if (!e.valid(now)) continue;
            e.toJson(json);
        }
    }

    static class GSVStore {
        static class Sat {
            public int number;
            public String talker = "";
            long lastSeen;

            public Sat(int number, String talker) {
                this.number = number;
                this.talker = talker;
                this.lastSeen = SystemClock.uptimeMillis();
            }

            boolean valid(long validTime) {
                return this.lastSeen >= validTime;
            }

            void update(String talker) {
                if (talker != null) {
                    this.talker = talker;
                }
                this.lastSeen = SystemClock.uptimeMillis();
            }

        }

        long expiryTime;
        int priority;
        String source;
        private final HashMap<Integer, Sat> satellites = new HashMap<Integer, Sat>();
        private final HashMap<Integer, Sat> used = new HashMap<Integer, Sat>();

        public GSVStore(String source,long expiryTime,int priority) {
            this.expiryTime = expiryTime;
            this.priority=priority;
            this.source=source;
        }
        synchronized void cleanup() {
            cleanupUsed();
            cleanupSats();
        }

        synchronized void cleanupSats() {
            long validTime = SystemClock.uptimeMillis() - expiryTime;
            satellites.entrySet().removeIf(integerSatEntry -> !integerSatEntry.getValue().valid(validTime));
        }

        synchronized void cleanupUsed() {
            long validTime = SystemClock.uptimeMillis() - expiryTime;
            used.entrySet().removeIf(integerSatEntry -> !integerSatEntry.getValue().valid(validTime));
        }

        synchronized int getSatCount() {
            return satellites.size();
        }

        synchronized int getNumUsed() {
            return used.size();
        }

        public synchronized void addSentence(GSVSentence gsv) {
            for (SatelliteInfo info : gsv.getSatelliteInfo()) {
                int id = Integer.parseInt(info.getId());
                Sat existing = satellites.get(id);
                if (existing == null) {
                    existing = new Sat(id, gsv.getTalkerId().toString());
                    satellites.put(id, existing);
                }
                existing.update(gsv.getTalkerId().toString());
            }
            cleanupSats();
        }

        public synchronized void addSentence(GSASentence gsa) {
            for (String sid : gsa.getSatelliteIds()) {
                int id = Integer.parseInt(sid);
                Sat existing = used.get(id);
                if (existing == null) {
                    existing = new Sat(id, gsa.getTalkerId().toString());
                    used.put(id, existing);
                }
                existing.update(gsa.getTalkerId().toString());
            }
            cleanupUsed();
        }

    }

    static class GSVStores {
        private final HashMap<String,GSVStore> stores=new HashMap<>();
        public synchronized GSVStore getStore(String k,long expiry,int priority) {
            GSVStore rt=stores.get(k);
            if (rt == null) {
                rt=new GSVStore(k,expiry,priority);
                stores.put(k,rt);
            }
            rt.expiryTime=expiry;
            rt.priority=priority;
            return rt;
        }
        public synchronized GSVStore getStore(String k) {
            return stores.get(k);
        }
        public synchronized GSVStore getHPStore() {
            GSVStore found=null;
            for (GSVStore s:stores.values()){
                if (found == null || found.priority < s.priority){
                    found=s;
                }
            }
            return found;
        }

        public synchronized void cleanup(boolean force) {
            if (force) {
                stores.clear();
                return;
            }
            for (GSVStore store : stores.values()){
                store.cleanup();
            }
        }
    }
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

        public static double to360(double angle){
            angle=angle % 360;
            while (angle < 0) angle+=360;
            return angle;
        }

        public static final class EVTGParser extends net.sf.marineapi.nmea.parser.SentenceParser{
            public EVTGParser(String nmea) {
                super(nmea);
            }

            public EVTGParser(TalkerId talker) {
                super(talker,"VTG",9);
            }

            double getCOG() {
                return getDoubleValue(0);
            }
            double getSOG(){
                if ("T".equals(getStringValue(1))){
                    //new style
                    return getDoubleValue(4);
                }
                return getDoubleValue(2);
            }
        }

        public static class EDepthParser extends SentenceParser implements DepthSentence{

            public EDepthParser(String nmea) {
                super(nmea);
            }
            public EDepthParser(TalkerId id){
                super(id,"DBx",1);
            }

            @Override
            public double getDepth() {
                return getDoubleValue(2);
            }

            @Override
            public void setDepth(double depth) {

            }
        }

        @Override
        public void run(int startSequence) throws JSONException {
            store=new AisStore(OWN_MMSI.fromJson(parameters));
            SentenceFactory factory = SentenceFactory.getInstance();
            factory.registerParser("VTG", EVTGParser.class);
            factory.registerParser("DBK",EDepthParser.class);
            factory.registerParser("DBS", EDepthParser.class);
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
                        try{
                            cleanupNmea();
                        }catch(Throwable t){
                            AvnLog.e("exception in NMEA cleanup",t);
                        }
                        try{
                            gsvStores.cleanup(false);
                        }catch(Throwable t){
                            AvnLog.e("exception in cleanup gsv",t);
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
                long now=SystemClock.uptimeMillis();

                try {
                    if (line.startsWith("$")) {
                        //NMEA
                        if (entry.validated) {
                            try {
                                line = correctTalker(line);
                                Sentence s = factory.createParser(line);
                                if (s instanceof GSVSentence) {
                                    GSVStore store=gsvStores.getStore(entry.source,posAge,entry.priority);
                                    GSVSentence gsv = (GSVSentence) s;
                                    store.addSentence(gsv);
                                    AvnLog.dfs("%s: GSV sentence (%d/%d) numSat=%d" ,
                                            getTypeName() ,gsv.getSentenceIndex(),
                                            gsv.getSentenceCount(),gsv.getSatelliteCount());
                                    continue;
                                }
                                if (s instanceof GSASentence) {
                                    GSVStore store=gsvStores.getStore(entry.source,posAge,entry.priority);
                                    store.addSentence((GSASentence) s);
                                    continue;
                                }
                                if (s instanceof MWVSentence) {
                                    MWVSentence m = (MWVSentence) s;
                                    AvnLog.dfs("%s: MWV sentence",getTypeName() );
                                    WindKeys keys=new WindKeys(m.isTrue()?WindKeys.TRUEA:WindKeys.APP);
                                    try {
                                        addNmeaData(keys.angle, m.getAngle(),entry,posAge);
                                    }catch (DataNotAvailableException ignored){}
                                    try {
                                        double speed = m.getSpeed();
                                        if (m.getSpeedUnit().equals(Units.KMH)) {
                                            speed = speed / 3.6;
                                        }
                                        if (m.getSpeedUnit().equals(Units.KNOT)) {
                                            speed = knToMs(speed);
                                        }
                                        addNmeaData(keys.speed, speed,entry,posAge);
                                    }catch (DataNotAvailableException ignored){}
                                    continue;
                                }
                                if (s instanceof MWDSentence){
                                    MWDSentence m = (MWDSentence) s;
                                    AvnLog.dfs("%s: MWD sentence",getTypeName() );
                                    WindKeys keys=new WindKeys(WindKeys.TRUED);
                                    double direction=m.getTrueWindDirection();
                                    if (Double.isNaN(direction)){
                                        direction=m.getMagneticWindDirection();
                                    }
                                    if (! Double.isNaN(direction)){
                                        addNmeaData(keys.angle,direction,entry,posAge);
                                    }
                                    double speed=m.getWindSpeed();
                                    if (Double.isNaN(speed)){
                                        speed=m.getWindSpeedKnots();
                                        if (! Double.isNaN(speed)){
                                            speed=knToMs(speed);
                                        }
                                    }
                                    if (! Double.isNaN(speed)){
                                        addNmeaData(keys.speed,speed,entry,posAge);
                                    }
                                    continue;
                                }
                                if (s instanceof VWRSentence){
                                    VWRSentence w=(VWRSentence)s;
                                    AvnLog.dfs("%s: VWR sentence",getTypeName() );
                                    WindKeys keys=new WindKeys(WindKeys.APP);
                                    try {
                                        double wangle = w.getWindAngle();
                                        Direction wdir = w.getDirectionLeftRight();
                                        if (wdir == Direction.LEFT) wangle = 360 - wangle;
                                        addNmeaData(keys.angle, wangle, entry, posAge);
                                    }catch (DataNotAvailableException ignored){}
                                    try{
                                        double speed=w.getSpeedKnots();
                                        addNmeaData(keys.speed,knToMs(speed),entry,posAge);
                                    }catch (Throwable t){
                                        try{
                                            double speed=w.getSpeedKmh();
                                            addNmeaData(keys.speed,speed/3.6,entry,posAge);
                                        }catch (Throwable x){}
                                    }
                                    continue;
                                }
                                if (s instanceof DPTSentence) {
                                    DPTSentence d = (DPTSentence) s;
                                    AvnLog.dfs("%s: DPT sentence",getTypeName() );
                                    try {
                                        double depth=d.getDepth();
                                        addNmeaData(K_DEPTHT, depth, entry, posAge);
                                        double offset = d.getOffset();
                                        if (offset >= 0) {
                                            addNmeaData(K_DEPTHW, depth + offset,entry,posAge);
                                        } else {
                                            addNmeaData(K_DEPTHK, depth + offset,entry,posAge);
                                        }
                                    } catch (DataNotAvailableException ignored){}
                                    continue;
                                }
                                if (s instanceof DepthSentence) {
                                    DepthSentence d = (DepthSentence) s;
                                    AvnLog.dfs("%s: depth(%s) sentence",getTypeName(), s.getSentenceId() );
                                    double depth = d.getDepth();
                                    String k=K_DEPTHT;
                                    if ("DBK".equals(s.getSentenceId())) k=K_DEPTHK;
                                    if ("DBS".equals(s.getSentenceId())) k=K_DEPTHW;
                                    addNmeaData(k, depth,entry,posAge);
                                    continue;
                                }
                                if (s instanceof MTWSentence) {
                                    MTWSentence d = (MTWSentence) s;
                                    AvnLog.dfs("%s: MTW sentence",getTypeName() );
                                    try {
                                        double waterTemp = d.getTemperature() + 273.15;
                                        addNmeaData(K_VWTT, waterTemp, entry, posAge);
                                    }catch (DataNotAvailableException ignored){}
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
                                            addNmeaData("transducers." + tname, convertTransducerValue(ttype, tunit, tval),entry,auxAge);
                                        }
                                    }

                                }
                                if (s instanceof HDMSentence ){
                                    HDMSentence sh=(HDMSentence)s;
                                    AvnLog.dfs("%s: HDM sentence",getTypeName() );
                                    addNmeaData(K_HDGM,sh.getHeading(),entry,posAge);
                                    continue;
                                }
                                if (s instanceof HDTSentence ){
                                    HDTSentence sh=(HDTSentence)s;
                                    AvnLog.dfs("%s: %s sentence",getTypeName(),s.getSentenceId() );
                                    addNmeaData(K_HDGT,sh.getHeading(),entry,posAge);
                                    continue;
                                }
                                if (s instanceof VDRSentence){
                                    VDRSentence vdr=(VDRSentence) s;
                                    AvnLog.dfs("%s: %s sentence",getTypeName(),s.getSentenceId() );
                                    try{
                                        double strue=vdr.getTrueDirection();
                                        addNmeaData(K_SET,strue,entry,posAge);
                                    }catch (DataNotAvailableException v1){}
                                    try{
                                        double drift=vdr.getSpeed();
                                        addNmeaData(K_DFT,drift,entry,posAge);
                                    }catch (DataNotAvailableException v2){}
                                    continue;
                                }
                                if (s instanceof VHWSentence){
                                    VHWSentence sv=(VHWSentence)s;
                                    AvnLog.dfs("%s: %s sentence",getTypeName(), s.getSentenceId());
                                    try {
                                        addNmeaData(K_HDGM, sv.getMagneticHeading(),entry,posAge);
                                    }catch (DataNotAvailableException sv1){}
                                    try {
                                        addNmeaData(K_HDGT, sv.getHeading(),entry,posAge);
                                    }catch(DataNotAvailableException sv2){}
                                    try {
                                        addNmeaData(K_VHWS, knToMs(sv.getSpeedKnots()),entry,posAge);
                                    }catch(DataNotAvailableException sv3){}
                                    continue;
                                }
                                if (s instanceof HDGSentence){
                                    HDGSentence sh=(HDGSentence)s;
                                    AvnLog.dfs("%s: %s sentence",getTypeName(),s.getSentenceId() );
                                    double heading=sh.getHeading();
                                    addNmeaData(K_HDGC,heading,entry,posAge);
                                    try{
                                        double mDev=sh.getDeviation();
                                        addNmeaData(K_MDEV,mDev,entry,posAge);
                                        heading+=mDev;
                                        addNmeaData(K_HDGM, to360(heading),entry,posAge);
                                    }catch (DataNotAvailableException he){}
                                    try{
                                        double mVar=sh.getVariation();
                                        addNmeaData(K_MAGVAR,mVar,entry,posAge);
                                        heading+=mVar;
                                        addNmeaData(K_HDGT,to360(heading),entry,posAge);
                                    }catch(Exception h2e){}
                                    continue;
                                }
                                if (s instanceof EVTGParser){
                                    EVTGParser vtg=(EVTGParser) s;
                                    try{
                                        addNmeaData(K_COURSE,vtg.getCOG(),entry,now+posAge);
                                    }catch (DataNotAvailableException i){}
                                    try{
                                        addNmeaData(K_SPEED,vtg.getSOG()/ AvnUtil.msToKn,entry,posAge);
                                    }catch (DataNotAvailableException i){}
                                }
                                Position p = null;
                                if (s instanceof PositionSentence) {
                                    //we need to verify the position quality
                                    //it could be either RMC or GLL - they have DataStatus or GGA - GpsFixQuality
                                    boolean isValid = false;
                                    try {
                                        if (s instanceof RMCSentence) {
                                            RMCSentence rmc = (RMCSentence) s;
                                            isValid = rmc.getStatus() == DataStatus.ACTIVE;
                                            AvnLog.dfs("%s: RMC sentence, valid=%s", getTypeName(), isValid);
                                            if (isValid) {
                                                try {
                                                    double mvar = rmc.getVariation();
                                                    //the RMC parser inverts the variation if the direction is E
                                                    //this seems to be wrong (and different to the python code)
                                                    addNmeaData(K_MAGVAR, -mvar, entry, posAge);
                                                } catch (DataNotAvailableException re) {
                                                }
                                            }
                                        }
                                        if (s instanceof GLLSentence) {
                                            isValid = ((GLLSentence) s).getStatus() == DataStatus.ACTIVE;
                                            AvnLog.dfs("%s: GLL sentence, valid=%s",
                                                    getTypeName(), isValid);
                                        }
                                        if (s instanceof GGASentence) {
                                            GGASentence gga=(GGASentence) s;
                                            try {
                                                int qual = gga.getFixQuality().toInt();
                                                isValid = qual > 0;
                                                AvnLog.dfs("%s: GGA sentence, quality=%d, valid=%s", getTypeName(), qual, isValid);
                                            }catch (DataNotAvailableException i){}
                                        }
                                    } catch (DataNotAvailableException ignored) {
                                    }
                                    if (isValid) {
                                        p = ((PositionSentence) s).getPosition();
                                        AvnLog.dfs( "%s: external position %s",getTypeName() ,p);
                                    }
                                }
                                net.sf.marineapi.nmea.util.Time time = null;
                                net.sf.marineapi.nmea.util.Date date=null;
                                if (s instanceof DateSentence) {
                                    try {
                                        date = ((DateSentence) s).getDate();
                                        addNmeaData(new NoJsonNmeaEntry(IK_DATE,date,entry,now+posAge));
                                    } catch (DataNotAvailableException ignored){}
                                }
                                if (s instanceof TimeSentence) {
                                    try {
                                        time = ((TimeSentence) s).getTime();
                                        if (addNmeaData(new NoJsonNmeaEntry(IK_TIME,time,entry,now+posAge))) {
                                            if (date == null) {
                                                //check if we have a date received
                                                synchronized (this){
                                                    NmeaEntry e=nmeaData.get(IK_DATE);
                                                    if (e!= null && e.valid()){
                                                        date=(net.sf.marineapi.nmea.util.Date)e.value;
                                                    }
                                                }
                                            }
                                            if (date != null){
                                                addNmeaData(K_TIME,dateFormat.format(AvnUtil.toTimeStamp(date,time)),entry,posAge);
                                            }
                                        }
                                    } catch (DataNotAvailableException e) {
                                        AvnLog.d(LOGPRFX, "empty time in " + line);
                                    }
                                }
                                ArrayList<NmeaEntry> posEntries=new ArrayList<>();
                                if (p != null){
                                    long timeout=now+posAge;
                                    posEntries.add(new NmeaEntry(K_LAT,p.getLatitude(),entry,timeout));
                                    posEntries.add(new NmeaEntry(K_LON,p.getLongitude(),entry,timeout));
                                    if (s instanceof RMCSentence) {
                                        try {
                                            double speed = ((RMCSentence) s).getSpeed() / AvnUtil.msToKn;
                                            posEntries.add(new NmeaEntry(K_SPEED, speed, entry, timeout));
                                        }catch (DataNotAvailableException i){}
                                        try {
                                            posEntries.add(new NmeaEntry(K_COURSE, ((RMCSentence) s).getCourse(), entry, timeout));
                                        }catch(DataNotAvailableException i2){}
                                    }
                                    addNmeaData(posEntries);
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
    public synchronized void cleanupNmea(){
        long now=SystemClock.uptimeMillis();
        nmeaData.entrySet().removeIf(e->!e.getValue().valid(now));
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
        List<NmeaEntry> pos=getEntries(K_LAT,K_LON);
        String pSource=null;
        boolean posValid=true;
        for (NmeaEntry e:pos){
            if (e.valid()) pSource=e.source;
            else posValid=false;
        }
        GSVStore gsv=null;
        if (pSource != null){
            gsv=gsvStores.getStore(pSource);
        }
        else{
            gsv=gsvStores.getHPStore();
        }
        SatStatus rt=null;
        if (gsv != null){
            gsv.cleanup();
            rt=new SatStatus(gsv.getSatCount(),gsv.getNumUsed(),fetcher.hasData(),gsv.source,posValid);
        }
        else {
            rt = new SatStatus(0, 0, fetcher.hasData(),pSource,posValid);
        }
        return rt;
    }


    @Override
    public synchronized void stop() {
        super.stop();
        queue.clear();
    }
    private interface LocationSetter{
        void op(Location l,NmeaEntry e);
    }
    private static class LocationEntry{
        public boolean mandatory;
        public LocationSetter setter;
        public LocationEntry(boolean mandatory, LocationSetter setter) {
            this.mandatory = mandatory;
            this.setter = setter;
        }
        public boolean mandatoryOk(NmeaEntry e,long now){
            return ! mandatory || e.valid(now);
        }
        public void set(NmeaEntry e,long now, Location l){
            if (! e.valid(now)) return;
            setter.op(l,e);
        }
    }

    private static final Map<String,LocationEntry> locationEntries= new HashMap<String,LocationEntry>(){
            {
            put(K_LON,new LocationEntry(true,(l, e) -> l.setLongitude((double)e.value)));
            put(K_LAT,new LocationEntry(true,(l, e) -> l.setLatitude((double)e.value)));
            put(K_SPEED,new LocationEntry(false,(l, e) -> l.setSpeed((float)((double)e.value))));
            put(K_COURSE,new LocationEntry(false,(l, e) -> l.setBearing((float)((double)e.value))));
    }};
    private static final String [] locationKeys=locationEntries.keySet().toArray(new String[0]);
    public Location getLocation() throws JSONException {
        List<NmeaEntry> pos=getEntries(locationKeys);
        long current=SystemClock.uptimeMillis();
        Location rt=new Location((String)null);
        for (NmeaEntry e:pos){
            LocationEntry le=locationEntries.get(e.key);
            if (le == null) return null; //internal error
            if (!le.mandatoryOk(e,current)) return null;
            le.set(e,current,rt);
        }
        return rt;
    }

    /**
     * service function to convert an android location
     * @return
     * @throws JSONException
     */
    JSONObject getGpsData() throws JSONException{
        JSONObject rt=new JSONObject();
        mergeNmeaData(rt);
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
        int numAis = numAisData();
        if (st.hasValidPosition()) {
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
        private boolean validPosition;
        private String source;

        public SatStatus(int numSat,int numUsed, boolean gpsEnabled,String source,boolean valid){
            this.numSat=numSat;
            this.numUsed=numUsed;
            this.gpsEnabled=gpsEnabled;
            this.createdTime= SystemClock.uptimeMillis();
            this.source=source;
            this.validPosition=valid;
        }

        public int getNumSat() {
            return numSat;
        }

        public int getNumUsed() {
            return numUsed;
        }

        public boolean isGpsEnabled() {
            return gpsEnabled;
        }

        public boolean hasValidPosition(){
            return validPosition;
        }
        public String toString(){
            return "Sat num="+numSat+", used="+numUsed;
        }

        public String getSource() {
            return source;
        }
    }

    public synchronized void cleanup(){
        store.cleanup(-1); //cleanup all
        gsvStores.cleanup(true);
        nmeaData.clear();
    }


    public String getLastAisSource() {
        return lastAisSource;
    }
}
