package de.wellenvogel.avnav.gps;

import android.content.Context;
import android.location.Location;
import android.util.Log;

import net.sf.marineapi.nmea.parser.SentenceFactory;
import net.sf.marineapi.nmea.sentence.DateSentence;
import net.sf.marineapi.nmea.sentence.GGASentence;
import net.sf.marineapi.nmea.sentence.GLLSentence;
import net.sf.marineapi.nmea.sentence.GSASentence;
import net.sf.marineapi.nmea.sentence.GSVSentence;
import net.sf.marineapi.nmea.sentence.PositionSentence;
import net.sf.marineapi.nmea.sentence.RMCSentence;
import net.sf.marineapi.nmea.sentence.Sentence;
import net.sf.marineapi.nmea.sentence.SentenceValidator;
import net.sf.marineapi.nmea.sentence.TimeSentence;
import net.sf.marineapi.nmea.util.DataStatus;
import net.sf.marineapi.nmea.util.Position;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.Calendar;

import de.wellenvogel.avnav.aislib.messages.message.AisMessage;
import de.wellenvogel.avnav.aislib.messages.sentence.Abk;
import de.wellenvogel.avnav.aislib.packet.AisPacket;
import de.wellenvogel.avnav.aislib.packet.AisPacketParser;
import de.wellenvogel.avnav.util.AvnLog;

/**
 * Created by andreas on 25.12.14.
 */
public abstract class SocketPositionHandler extends GpsDataProvider {
    private long lastAisCleanup=0;


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
        ReceiverRunnable(AbstractSocket socket,Properties prop){
            properties=prop;
            this.socket=socket;
            if (properties.readAis) {
                aisparser=new AisPacketParser();
                store=new AisStore();
            }
        }
        @Override
        public void run() {
            while (! doStop) {
                isConnected=false;
                stat.gpsEnabled=false;
                try {
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
                    BufferedReader in = new BufferedReader(new InputStreamReader(socket.getInputStream()));
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
                        if (line.startsWith("$") && properties.readNmea) {
                            //NMEA
                            if (SentenceValidator.isValid(line)) {
                                try {
                                    Sentence s = factory.createParser(line);
                                    if (s instanceof DateSentence) {
                                        lastDate = ((DateSentence) s).getDate();
                                    }
                                    if (s instanceof  GSVSentence){
                                        stat.numSat=((GSVSentence)s).getSatelliteCount();
                                        AvnLog.d(name+": GSV sentence, numSat="+stat.numSat);
                                        continue;
                                    }
                                    if (s instanceof GSASentence){
                                        stat.numUsed=((GSASentence)s).getSatelliteIds().length;
                                        AvnLog.d(name+": GSA sentence, used="+stat.numUsed);
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
            }
            isRunning=false;
        }
        private long toTimeStamp(net.sf.marineapi.nmea.util.Date date,net.sf.marineapi.nmea.util.Time time){
            if (date == null) return 0;
            Calendar cal=Calendar.getInstance();
            cal.setTime(date.toDate());
            cal.add(Calendar.MILLISECOND,(int)(time.getMilliseconds()));
            return cal.getTime().getTime();
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
        public boolean hasAisData(){
            if (store == null ) return false;
            return store.numAisEntries()>0;
        }
    }
    public static final String LOGPRFX="AvNav:SocketPh";
    Context context;
    AbstractSocket socket;
    String name;
    Thread receiverThread;
    ReceiverRunnable runnable;
    Properties properties;

    SocketPositionHandler(String name,Context ctx, AbstractSocket socket, Properties prop){
        context=ctx;
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
            if (runnable != null && runnable.stat != null) {
                rt = new SatStatus(runnable.stat.numSat, runnable.stat.numUsed);
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
        this.runnable.stop();
    }

    @Override
    public Location getLocation() {
        return this.runnable.getLocation();
    }

    @Override
    public JSONObject getGpsData() throws JSONException {
        return getGpsData(getLocation());
    }

    @Override
    public synchronized void check() {
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
    }

    @Override
    JSONObject getGpsData(Location curLoc) throws JSONException {
        return super.getGpsData(curLoc);
    }

    /**btSocket=device.createRfcommSocketToServiceRecord(UUID.fromString(RFCOMM_UUID));
     * get AIS data (limited to distance)
     * @param lat
     * @param lon
     * @param distance in nm
     * @return
     */
    JSONArray  getAisData(double lat,double lon,double distance){
        if (runnable == null) return new JSONArray();
        return runnable.getAisData(lat,lon,distance);
    }

    public boolean hasAisData(){
        if (runnable == null) return false;
        return runnable.hasAisData();
    }

    @Override
    public String getConnectionId() {
        return socket.getId();
    }
}
