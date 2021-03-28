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

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;

import de.wellenvogel.avnav.aislib.messages.message.AisMessage;
import de.wellenvogel.avnav.aislib.messages.sentence.Abk;
import de.wellenvogel.avnav.aislib.packet.AisPacket;
import de.wellenvogel.avnav.aislib.packet.AisPacketParser;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.util.NmeaQueue;

/**
 * Created by andreas on 25.12.14.
 */
public class Decoder extends GpsDataProvider {
    private long lastAisCleanup=0;
    private boolean stopped=false;
    private AisStore store=null;
    private GSVStore currentGsvStore=null;
    private GSVStore validGsvStore=null;
    private SatStatus stat=new SatStatus(0,0);
    private Location location=null;
    private long lastPositionReceived=0;
    public static final String LOGPRFX="AvNav:Decoder";
    private Context context;
    private String name;
    private Thread receiverThread;
    private ReceiverRunnable runnable;
    private Properties properties;
    private INmeaLogger nmeaLogger;
    private NmeaQueue queue;
    private final Object waiter=new Object();
    class AuxiliaryEntry{
        public long timestamp;
        public JSONObject data=new JSONObject();
    }
    private HashMap<String,AuxiliaryEntry> auxiliaryData=new HashMap<String,AuxiliaryEntry>();

    private void addAuxiliaryData(String key, AuxiliaryEntry entry){
        entry.timestamp=System.currentTimeMillis();
        auxiliaryData.put(key,entry);
    }
    private void mergeAuxiliaryData(JSONObject json) throws JSONException {
        long minTimestamp=System.currentTimeMillis()-properties.auxiliaryAge*1000;
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

    class GSVStore{
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
            int rt=0;
            for (GSVSentence s: sentences.values()){
                rt+=s.getSatelliteCount();
            }
            return rt;
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

    class ReceiverRunnable implements Runnable{
        String status="disconnected";
        private net.sf.marineapi.nmea.util.Date lastDate=null;
        private boolean isRunning=true;
        ReceiverRunnable(){
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
        public void run() {
            int numGsv = 0; //number of gsv sentences without being the last
            long lastConnect = 0;
            int sequence = -1;
            SentenceFactory factory = SentenceFactory.getInstance();
            AisPacketParser aisparser = new AisPacketParser();
            while (!stopped) {
                NmeaQueue.Entry entry;
                try {
                    entry = queue.fetch(sequence, properties.readWait);
                } catch (InterruptedException e) {
                    if (stopped) return;
                    synchronized (waiter) {
                        try {
                            waiter.wait(properties.readWait);
                        } catch (InterruptedException interruptedException) {
                        }
                    }
                    continue;
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
                                    AvnLog.d(name + ": GSV sentence (" + gsv.getSentenceIndex() + "/" + gsv.getSentenceCount() +
                                            "), numSat=" + gsv.getSatelliteCount());
                                    if (currentGsvStore.getValid()) {
                                        numGsv = 0;
                                        validGsvStore = currentGsvStore;
                                        currentGsvStore = new GSVStore();
                                        stat.numSat = validGsvStore.getSatCount();
                                        //TODO: aging of validGSVStore
                                        AvnLog.d(name + ": GSV sentence last, numSat=" + stat.numSat);
                                    }
                                    if (numGsv > GSVStore.MAXGSV) {
                                        AvnLog.e(name + ": to many gsv sentences without a final one " + numGsv);
                                        stat.numSat = 0;
                                        validGsvStore = null;
                                    }

                                    continue;
                                }
                                if (s instanceof GSASentence) {
                                    stat.numUsed = ((GSASentence) s).getSatelliteIds().length;
                                    AvnLog.d(name + ": GSA sentence, used=" + stat.numUsed);
                                    continue;
                                }
                                if (s instanceof MWVSentence) {
                                    MWVSentence m = (MWVSentence) s;
                                    AvnLog.d(name + ": MWV sentence");
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
                                    AvnLog.d(name + ": DPT sentence");
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
                                    AvnLog.d(name + ": DBT sentence");
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
                                        AvnLog.d(name + ": RMC sentence, valid=" + isValid);
                                    }
                                    if (s instanceof GLLSentence) {
                                        isValid = ((GLLSentence) s).getStatus() == DataStatus.ACTIVE;
                                        AvnLog.d(name + ": GLL sentence, valid=" + isValid);
                                    }
                                    if (s instanceof GGASentence) {
                                        int qual = ((GGASentence) s).getFixQuality().toInt();
                                        isValid = qual > 0;
                                        AvnLog.d(name + ": GGA sentence, quality=" + qual + ", valid=" + isValid);
                                    }
                                    if (isValid) {
                                        p = ((PositionSentence) s).getPosition();
                                        AvnLog.d(LOGPRFX, name + ": external position " + p);
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
                                        newLocation.setTime(toTimeStamp(lastDate, time));
                                        location = newLocation;
                                        if (s.getSentenceId().equals("RMC")) {
                                            try {
                                                location.setSpeed((float) (((RMCSentence) s).getSpeed() / msToKn));
                                            } catch (Exception i) {
                                                AvnLog.d(name + ": Exception querying speed: " + i.getLocalizedMessage());
                                            }
                                            try {
                                                location.setBearing((float) (((RMCSentence) s).getCourse()));
                                            } catch (Exception i) {
                                                AvnLog.d(name + ": Exception querying bearing: " + i.getLocalizedMessage());
                                            }
                                        }
                                        AvnLog.d(LOGPRFX, name + ": location: " + location);
                                    }
                                } else {
                                    AvnLog.d(LOGPRFX, name + ": ignoring sentence " + line + " - no position or time");
                                }
                            } catch (Exception i) {
                                Log.e(LOGPRFX, name + ": exception in NMEA parser " + i.getLocalizedMessage());
                                i.printStackTrace();
                            }
                        } else {
                            AvnLog.d(LOGPRFX, name + ": ignore invalid nmea");
                        }
                    }
                    if (line.startsWith("!")) {
                        if (nmeaLogger != null) nmeaLogger.logNmea(line);
                        if (Abk.isAbk(line)) {
                            aisparser.newVdm();
                            AvnLog.i(LOGPRFX, name + ": ignore abk line " + line);
                        }
                        try {
                            AisPacket p = aisparser.readLine(line);
                            if (p != null) {
                                AisMessage m = p.getAisMessage();
                                AvnLog.i(LOGPRFX, name + ": AisPacket received: " + m.toString());
                                store.addAisMessage(m);
                            }
                        } catch (Exception e) {
                            Log.e(LOGPRFX, name + ": AIS exception while parsing " + line);
                            e.printStackTrace();
                        }
                    }

                } catch (Throwable e) {
                    Log.e(LOGPRFX, name + ": Exception during decode " + e.getLocalizedMessage());
                    status = "read exception " + e;
                }
            }
            isRunning = false;
        }


        public boolean getRunning() {
            return isRunning;
        }
    }

    public void cleanupAis(long lifetime){
        if (store != null) {
            long now=System.currentTimeMillis();
            if (now > (lastAisCleanup+properties.aisCleanupInterval)) {
                lastAisCleanup=now;
                store.cleanup(lifetime);
            }
        }//satellite view
    }

    Decoder(String name, Context ctx, NmeaQueue queue,Properties prop){
        context=ctx;
        if (ctx instanceof INmeaLogger) nmeaLogger=(INmeaLogger)ctx;
        this.name=name;
        this.queue=queue;
        properties=prop;
        this.runnable=new ReceiverRunnable();
        this.receiverThread=new Thread(this.runnable);
        store=new AisStore(prop.ownMmsi);
        Thread cleanupThread=new Thread(new Runnable() {
            @Override
            public void run() {
                while (! stopped) {
                    AvnLog.d(LOGPRFX, name + ": cleanup AIS data");
                    try {
                        cleanupAis(properties.aisLifetime);
                    } catch (Throwable t) {
                        AvnLog.e("exception in AIS cleanup", t);
                    }
                    synchronized (waiter) {
                        try {
                            waiter.wait(properties.readWait);
                        } catch (InterruptedException e) {
                        }
                    }
                    if (stopped) break;
                }
                AvnLog.i(LOGPRFX,"Ais cleanup finished");
            }
        });
        cleanupThread.start();
        AvnLog.d(LOGPRFX,name+":starting decoder");
        this.receiverThread.start();
    }

    @Override
    SatStatus getSatStatus() {
        return new SatStatus(stat);
    }

    @Override
    public boolean handlesNmea() {
        return true;
    }

    @Override
    public boolean handlesAis() {
        return true;
    }

    @Override
    public String getName() {
        return name;
    }

    @Override
    public synchronized void stop() {
        this.stopped=true;
        queue.clear();
        synchronized (waiter) {
            waiter.notifyAll();
        }
    }

    @Override
    public boolean isStopped() {
        return stopped;
    }

    @Override
    public Location getLocation() {
        long current=System.currentTimeMillis();
        if (current > (lastPositionReceived+properties.postionAge)){
            return null;
        }
        Location rt=location;
        if (rt == null) return rt;
        rt=new Location(rt);
        rt.setTime(rt.getTime()+properties.timeOffset);
        return rt;
    }

    @Override
    public JSONObject getGpsData() throws JSONException {
        JSONObject rt=getGpsData(getLocation());
        mergeAuxiliaryData(rt);
        return rt;
    }


    @Override
    JSONObject getGpsData(Location curLoc) throws JSONException {
        JSONObject rt= super.getGpsData(curLoc);
        if (rt == null) rt=new JSONObject();
        mergeAuxiliaryData(rt);
        return rt;
    }

    /**
     * get AIS data (limited to distance)
     * @param lat
     * @param lon
     * @param distance in nm
     * @return
     */
    @Override
    public JSONArray  getAisData(double lat,double lon,double distance){
        if (store != null) return store.getAisData(lat,lon,distance);
        return new JSONArray();

    }

    public int numAisData(){
        return store.numAisEntries();
    }


    @Override
    JSONObject getHandlerStatus() throws JSONException {
        Decoder handler=this;
        JSONObject item = new JSONObject();
        item.put("name", handler.getName());
        String addr = name;
        SatStatus st = handler.getSatStatus();
        Location loc = handler.getLocation();
        int numAis = handler.numAisData();
        if (loc != null ) {
            String info = "(" + addr + ") valid position, sats: " + st.numSat + " / " + st.numUsed;
            if (numAis > 0) info += ", valid AIS data, " + numAis + " targets";
            item.put("info", info);
            item.put("status", GpsDataProvider.STATUS_NMEA);
        } else {
            if ( numAis > 0) {
                item.put("info", "(" + addr + ") valid AIS data, " + numAis + " targets");
                item.put("status", GpsDataProvider.STATUS_NMEA);

            } else {
                if (st.gpsEnabled) {
                    String info="(" + addr + ") connected";
                    if (handler.handlesNmea()) info+=", sats: " + st.numSat + " available / " + st.numUsed + " used";
                    item.put("info", info);
                    item.put("status", GpsDataProvider.STATUS_STARTED);
                } else {
                    item.put("info", "(" + addr + ") disconnected");
                    item.put("status", GpsDataProvider.STATUS_ERROR);
                }
            }
        }
        return item;
    }

}
