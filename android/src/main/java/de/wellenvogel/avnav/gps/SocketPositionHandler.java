package de.wellenvogel.avnav.gps;

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
import net.sf.marineapi.nmea.sentence.TimeSentence;
import net.sf.marineapi.nmea.util.DataStatus;
import net.sf.marineapi.nmea.util.Position;
import net.sf.marineapi.nmea.util.Units;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.Iterator;
import java.util.TimeZone;

import de.wellenvogel.avnav.aislib.messages.message.AisMessage;
import de.wellenvogel.avnav.aislib.messages.sentence.Abk;
import de.wellenvogel.avnav.aislib.packet.AisPacket;
import de.wellenvogel.avnav.aislib.packet.AisPacketParser;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;

/**
 * Created by andreas on 25.12.14.
 */
public abstract class SocketPositionHandler extends GpsDataProvider {
    private long lastAisCleanup=0;
    private boolean stopped=false;
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
        long minTimestamp=System.currentTimeMillis()-properties.postionAge*1000;
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


    class ReceiverRunnable implements Runnable{
        String status="disconnected";
        AbstractSocket socket;
        private Location location=null;
        private long lastPositionReceived=0;
        private net.sf.marineapi.nmea.util.Date lastDate=null;
        private Properties properties;
        private boolean isRunning=true;
        private boolean isConnected=false;
        private AisPacketParser aisparser;
        private AisStore store;
        private boolean doStop;
        private Object waiter=new Object();
        private SatStatus stat=new SatStatus(0,0);
        private GSVStore currentGsvStore=null;
        private GSVStore validGsvStore=null;
        private String nmeaFilter[]=null;
        ReceiverRunnable(AbstractSocket socket,Properties prop){
            properties=prop;
            this.socket=socket;
            if (properties.readAis) {
                aisparser=new AisPacketParser();
                store=new AisStore(properties.ownMmsi);
            }
            nmeaFilter=AvnUtil.splitNmeaFilter(prop.nmeaFilter);
        }
        @Override
        public void run() {
            int numGsv=0; //number of gsv sentences without being the last
            long lastConnect=0;
            while (! doStop) {
                isConnected=false;
                stat.gpsEnabled=false;
                if (store != null){
                    store.clear();
                }
                try {
                    lastConnect=System.currentTimeMillis();
                    socket.connect();
                } catch (Exception e) {
                    Log.e(LOGPRFX, name + ": Exception during connect " + e.getLocalizedMessage());
                    status = "connect error " + e;
                    try {
                        socket.close();
                    }catch (Exception i){}
                    try {
                        synchronized (waiter) {
                            waiter.wait(5000);
                        }
                    } catch (InterruptedException e1) {

                    }
                    continue;
                }
                AvnLog.d(LOGPRFX, name + ": connected to " + socket.getId());
                try {
                    BufferedReader in = new BufferedReader(new InputStreamReader(socket.getInputStream()),8);
                    status = "receiving";
                    isConnected = true;
                    stat.gpsEnabled=true;
                    SentenceFactory factory = SentenceFactory.getInstance();
                    while (!doStop) {
                        String line = in.readLine();
                        AvnLog.d(LOGPRFX, name + ": received: " + line);
                        if (line == null) {
                            status = "disconnected, EOF";
                            try {
                                socket.close();
                            } catch (Exception i) {
                            }
                            isConnected = false;
                            stat.gpsEnabled=false;
                            break;
                        }
                        line=AvnUtil.removeNonNmeaChars(line);
                        if (line.startsWith("$") && properties.readNmea) {
                            if (!AvnUtil.matchesNmeaFilter(line,nmeaFilter)){
                                AvnLog.d("ignore "+line+" due to filter");
                                continue;
                            }
                            if (nmeaLogger != null) nmeaLogger.logNmea(line);
                            //NMEA
                            if (SentenceValidator.isValid(line)) {
                                try {
                                    Sentence s = factory.createParser(line);
                                    if (s instanceof DateSentence) {
                                        lastDate = ((DateSentence) s).getDate();
                                    }
                                    if (s instanceof  GSVSentence){
                                        numGsv++;
                                        if (currentGsvStore == null) currentGsvStore=new GSVStore();
                                        GSVSentence gsv=(GSVSentence)s;
                                        currentGsvStore.addSentence(gsv);
                                        AvnLog.d(name + ": GSV sentence ("+gsv.getSentenceIndex()+"/"+gsv.getSentenceCount()+
                                                "), numSat=" + gsv.getSatelliteCount());
                                        if (currentGsvStore.getValid()){
                                            numGsv=0;
                                            validGsvStore=currentGsvStore;
                                            currentGsvStore=new GSVStore();
                                            stat.numSat=validGsvStore.getSatCount();
                                            //TODO: aging of validGSVStore
                                            AvnLog.d(name+": GSV sentence last, numSat="+stat.numSat);
                                        }
                                        if (numGsv > GSVStore.MAXGSV){
                                            AvnLog.e(name+": to many gsv sentences without a final one "+numGsv);
                                            stat.numSat=0;
                                            validGsvStore=null;
                                        }

                                        continue;
                                    }
                                    if (s instanceof GSASentence){
                                        stat.numUsed=((GSASentence)s).getSatelliteIds().length;
                                        AvnLog.d(name+": GSA sentence, used="+stat.numUsed);
                                        continue;
                                    }
                                    if (s instanceof MWVSentence){
                                        MWVSentence m=(MWVSentence)s;
                                        AvnLog.d(name+": MWV sentence");
                                        AuxiliaryEntry e=new AuxiliaryEntry();
                                        e.data.put("windAngle",m.getAngle());
                                        e.data.put("windReference",m.isTrue()?"T":"R");
                                        double speed=m.getSpeed();
                                        if (m.getSpeedUnit().equals(Units.KMH)){
                                            speed=speed/3.6;
                                        }
                                        if (m.getSpeedUnit().equals(Units.KNOT)){
                                            speed=speed/3600.0*1852.0;
                                        }
                                        e.data.put("windSpeed",speed);
                                        addAuxiliaryData(s.getSentenceId(),e);
                                        continue;
                                    }
                                    if (s instanceof DPTSentence){
                                        DPTSentence d=(DPTSentence)s;
                                        AvnLog.d(name+": DPT sentence");
                                        AuxiliaryEntry e=new AuxiliaryEntry();
                                        double depth=d.getDepth();
                                        e.data.put("depthBelowTransducer",depth);
                                        double offset=d.getOffset();
                                        if (offset >= 0){
                                            e.data.put("depthBelowWaterline",depth+offset);
                                        }
                                        else{
                                            e.data.put("depthBelowKeel",depth+offset);
                                        }
                                        addAuxiliaryData(s.getSentenceId(),e);
                                        continue;
                                    }
                                    if (s instanceof DBTSentence){
                                        DBTSentence d=(DBTSentence)s;
                                        AvnLog.d(name+": DBT sentence");
                                        AuxiliaryEntry e=new AuxiliaryEntry();
                                        double depth=d.getDepth();
                                        e.data.put("depthBelowTransducer",depth);
                                        addAuxiliaryData(s.getSentenceId(),e);
                                        continue;
                                    }
                                    Position p = null;
                                    if (s instanceof PositionSentence) {
                                        //we need to verify the position quality
                                        //it could be either RMC or GLL - they have DataStatus or GGA - GpsFixQuality
                                        boolean isValid=false;
                                        if (s instanceof  RMCSentence){
                                            isValid=((RMCSentence)s).getStatus()== DataStatus.ACTIVE;
                                            AvnLog.d(name+": RMC sentence, valid="+isValid);
                                        }
                                        if (s instanceof GLLSentence){
                                            isValid=((GLLSentence)s).getStatus()== DataStatus.ACTIVE;
                                            AvnLog.d(name+": GLL sentence, valid="+isValid);
                                        }
                                        if (s instanceof  GGASentence){
                                            int qual=((GGASentence)s).getFixQuality().toInt();
                                            isValid=qual>0;
                                            AvnLog.d(name+": GGA sentence, quality="+qual+", valid="+isValid);
                                        }
                                        if (isValid) {
                                            p = ((PositionSentence) s).getPosition();
                                            AvnLog.d(LOGPRFX, name + ": external position " + p);
                                        }
                                    }
                                    net.sf.marineapi.nmea.util.Time time = null;
                                    if (s instanceof TimeSentence) {
                                        time = ((TimeSentence) s).getTime();
                                    }
                                    if (time != null && lastDate != null && p != null) {
                                        synchronized (this) {
                                            Location lastLocation = location;
                                            if (lastLocation != null) {
                                                location = new Location(lastLocation);
                                            } else {
                                                location = new Location((String) null);
                                            }
                                            lastPositionReceived = System.currentTimeMillis();
                                            location.setLatitude(p.getLatitude());
                                            location.setLongitude(p.getLongitude());
                                            location.setTime(toTimeStamp(lastDate, time));
                                            if (s.getSentenceId().equals("RMC")) {
                                                try {
                                                    location.setSpeed((float) (((RMCSentence) s).getSpeed() / msToKn));
                                                }catch (Exception i){
                                                    AvnLog.d(name+": Exception querying speed: "+i.getLocalizedMessage());
                                                }
                                                try {
                                                    location.setBearing((float) (((RMCSentence) s).getCourse()));
                                                }catch (Exception i){
                                                    AvnLog.d(name+": Exception querying bearing: "+i.getLocalizedMessage());
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
                        if (line.startsWith("!") && properties.readAis) {
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

                    }
                } catch (IOException e) {
                    Log.e(LOGPRFX, name + ": Exception during read " + e.getLocalizedMessage());
                    status = "read exception " + e;
                    try {
                        socket.close();
                    } catch (Exception i) {
                    }
                    isConnected = false;
                }
                long current=System.currentTimeMillis();
                if ((current-lastConnect) < 3000){
                    try {
                        synchronized (waiter) {
                            waiter.wait(3000 -(current-lastConnect));
                        }
                    } catch (InterruptedException e1) {

                    }
                }
            }
            isRunning=false;
        }


        public void stop(){
            doStop=true;
            if (socket != null) {
                try{
                    AvnLog.d(LOGPRFX,name+": closing socket");
                    socket.close();
                    isConnected=false;
                }catch (Exception i){}
            }
            synchronized (waiter){
                waiter.notifyAll();
            }
        }
        public boolean getRunning(){
            return isRunning;
        }
        public boolean getConnected(){
            return isConnected;
        }
        public synchronized Location getLocation(){
            long current=System.currentTimeMillis();
            if (current > (lastPositionReceived+properties.postionAge)){
                return null;
            }
            return location;
        }

        public JSONArray getAisData(double lat,double lon, double distance){
            if (store != null) return store.getAisData(lat,lon,distance);
            return new JSONArray();
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
        public int numAisData(){
            if (store == null ) return 0;
            return store.numAisEntries();
        }

        public boolean hasValidStatus(){
            if (validGsvStore == null) return false;
            if (! validGsvStore.getValid()) return false;
            return true;
        }
    }
    public static final String LOGPRFX="AvNav:SocketPh";
    Context context;
    AbstractSocket socket;
    String name;
    Thread receiverThread;
    ReceiverRunnable runnable;
    Properties properties;
    INmeaLogger nmeaLogger;
    SocketPositionHandler(String name,Context ctx, AbstractSocket socket, Properties prop){
        context=ctx;
        if (ctx instanceof INmeaLogger) nmeaLogger=(INmeaLogger)ctx;
        this.name=name;
        this.socket=socket;
        properties=prop;
        this.runnable=new ReceiverRunnable(socket,properties);
        this.receiverThread=new Thread(this.runnable);
        AvnLog.d(LOGPRFX,name+":starting receiver for "+socket.getId());
        this.receiverThread.start();
    }

    @Override
    SatStatus getSatStatus() {
        SatStatus rt=new SatStatus(0,0);
        synchronized (this) {
            if (runnable != null && runnable.stat != null ) {
                if (runnable.hasValidStatus()) rt = new SatStatus(runnable.stat.numSat, runnable.stat.numUsed);
                rt.gpsEnabled = runnable.stat.gpsEnabled;
            }
        }
        return rt;
    }

    @Override
    public boolean handlesNmea() {
        return properties.readNmea;
    }

    @Override
    public boolean handlesAis() {
        return properties.readAis;
    }

    @Override
    public synchronized void stop() {
        this.stopped=true;
        this.runnable.stop();
    }

    @Override
    public boolean isStopped() {
        return stopped;
    }

    @Override
    public Location getLocation() {
        Location rt=this.runnable.getLocation();
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
    public synchronized void check() {
        if (this.isStopped()) return;
        if (this.runnable == null || ! this.runnable.getRunning()){
            this.runnable=new ReceiverRunnable(this.socket,properties);
            this.receiverThread=new Thread(this.runnable);
            AvnLog.d(LOGPRFX,name+": restarting receiver thread for "+this.socket.getId());
            this.receiverThread.start();
        }
        if (properties.readAis){
            Thread cleanupThread=new Thread(new Runnable() {
                @Override
                public void run() {
                    AvnLog.d(LOGPRFX,name+": cleanup AIS data");
                    runnable.cleanupAis(properties.aisLifetime);
                }
            });
            cleanupThread.start();
        }
        if(socket.check()){
            AvnLog.e(name+": closing socket due to write timeout");
        }
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
        if (runnable == null) return new JSONArray();
        return runnable.getAisData(lat,lon,distance);
    }

    public int numAisData(){
        if (runnable == null) return 0;
        return runnable.numAisData();
    }

    @Override
    public String getConnectionId() {
        return socket.getId();
    }

    @Override
    JSONObject getHandlerStatus() throws JSONException {
        SocketPositionHandler handler=this;
        JSONObject item = new JSONObject();
        item.put("name", handler.getName());
        String addr = handler.socket.getId();
        GpsDataProvider.SatStatus st = handler.getSatStatus();
        Location loc = handler.getLocation();
        int numAis = handler.numAisData();
        if (loc != null && handler.handlesNmea()) {
            String info = "(" + addr + ") valid position, sats: " + st.numSat + " / " + st.numUsed;
            if (numAis > 0) info += ", valid AIS data, " + numAis + " targets";
            item.put("info", info);
            item.put("status", GpsDataProvider.STATUS_NMEA);
        } else {
            if (handler.handlesAis() && numAis > 0) {
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

    @Override
    public void sendPosition(Location curLoc) {
        if (! properties.sendPosition) return;
        if (curLoc == null) return;
        RMCSentence out= positionToRmc(curLoc);
        try {
            socket.sendData(out.toSentence()+"\r\n");
        } catch (IOException e) {
            Log.e(LOGPRFX,"unable to send position",e);
        }
    }
}
