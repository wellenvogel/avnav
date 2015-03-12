package de.wellenvogel.avnav.gps;

import android.content.Context;
import android.content.SharedPreferences;
import android.location.Location;
import android.util.Log;
import de.wellenvogel.avnav.aislib.messages.message.AisMessage;
import de.wellenvogel.avnav.aislib.messages.sentence.Abk;
import de.wellenvogel.avnav.aislib.messages.sentence.SentenceException;
import de.wellenvogel.avnav.aislib.packet.AisPacket;
import de.wellenvogel.avnav.aislib.packet.AisPacketParser;
import de.wellenvogel.avnav.main.AvNav;
import de.wellenvogel.avnav.util.AvnLog;
import net.sf.marineapi.nmea.io.SentenceReader;
import net.sf.marineapi.nmea.parser.SentenceFactory;
import net.sf.marineapi.nmea.sentence.*;
import net.sf.marineapi.nmea.util.Position;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.Calendar;
import java.util.Date;

/**
 * Created by andreas on 25.12.14.
 */
public class SocketPositionHandler extends GpsDataProvider {
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
            try{
                socket.connect();
            } catch (Exception e){
                Log.e(LOGPRFX, name+": Exception during connect " + e.getLocalizedMessage());
                status="connect error "+e;
                isRunning=false;
                return;
            }
            AvnLog.d(LOGPRFX,name+": connected to "+socket.getId());
            try {
                BufferedReader in =new BufferedReader( new InputStreamReader(socket.getInputStream()));
                status="receiving";
                isConnected=true;
                SentenceFactory factory = SentenceFactory.getInstance();
                while (true){
                    String line=in.readLine();
                    AvnLog.d(LOGPRFX, name+": received: " + line);
                    if (line == null){
                        status="disconnected, EOF";
                        try{
                            socket.close();
                        }catch (Exception i){}
                        isConnected=false;
                        isRunning=false;
                        return;
                    }
                    if (line.startsWith("$") && properties.readNmea){
                        //NMEA
                        if (SentenceValidator.isValid(line)){
                            try {
                                Sentence s = factory.createParser(line);
                                if (s instanceof DateSentence){
                                    lastDate=((DateSentence) s).getDate();
                                }
                                Position p=null;
                                if (s instanceof PositionSentence) {
                                    p = ((PositionSentence) s).getPosition();
                                    AvnLog.d(LOGPRFX, name+": external position " + p);
                                }
                                net.sf.marineapi.nmea.util.Time time=null;
                                if (s instanceof TimeSentence) {
                                    time=((TimeSentence) s).getTime();
                                }
                                if (time != null && lastDate != null && p != null){
                                    synchronized (this){
                                        Location lastLocation=location;
                                        if (lastLocation != null) {
                                            location = new Location(lastLocation);
                                        }
                                        else {
                                            location= new Location((String)null);
                                        }
                                        lastPositionReceived=System.currentTimeMillis();
                                        location.setLatitude(p.getLatitude());
                                        location.setLongitude(p.getLongitude());
                                        location.setTime(toTimeStamp(lastDate,time));
                                        if (s.getSentenceId().equals("RMC")){
                                            location.setSpeed((float)(((RMCSentence)s).getSpeed()/msToKn));
                                            location.setBearing((float)(((RMCSentence)s).getCourse()));
                                        }
                                        AvnLog.d(LOGPRFX,name+": location: "+location);
                                    }
                                }
                                else{
                                    AvnLog.d(LOGPRFX,name+": ignoring sentence "+line+" - no position or time");
                                }
                            }catch (Exception i){
                                Log.e(LOGPRFX,name+": exception in NMEA parser "+i.getLocalizedMessage());
                                i.printStackTrace();
                            }
                        }
                        else{
                            AvnLog.d(LOGPRFX,name+": ignore invalid nmea");
                        }
                    }
                    if (line.startsWith("!") && properties.readAis){
                        if (Abk.isAbk(line)){
                            aisparser.newVdm();
                            AvnLog.i(LOGPRFX,name+": ignore abk line "+line);
                        }
                        try {
                            AisPacket p=aisparser.readLine(line);
                            if (p != null){
                                AisMessage m=p.getAisMessage();
                                AvnLog.i(LOGPRFX,name+": AisPacket received: "+m.toString());
                                store.addAisMessage(m);
                            }
                        } catch (Exception e) {
                            Log.e(LOGPRFX,name+": AIS exception while parsing "+line);
                            e.printStackTrace();
                        }
                    }

                }
            } catch (IOException e) {
                Log.e(LOGPRFX,name+": Exception during read "+e.getLocalizedMessage());
                status="read exception "+e;
                try {
                    socket.close();
                }catch (Exception i){}
                isRunning=false;
                isConnected=false;
                return;
            }

        }
        private long toTimeStamp(net.sf.marineapi.nmea.util.Date date,net.sf.marineapi.nmea.util.Time time){
            if (date == null) return 0;
            Calendar cal=Calendar.getInstance();
            cal.setTime(date.toDate());
            cal.add(Calendar.MILLISECOND,(int)(time.getMilliseconds()));
            return cal.getTime().getTime();
        }

        public void stop(){
            if (socket != null) {
                try{
                    AvnLog.d(LOGPRFX,name+": closing socket");
                    socket.close();
                    isConnected=false;
                }catch (Exception i){}
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
            }
        }
        public boolean hasAisData(){
            if (store == null ) return false;
            return store.numAisEntries()>0;
        }
    }
    public static final String LOGPRFX="AvNav:SocketPositionHandler";
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
            rt.gpsEnabled = runnable.getConnected();
        }
        return rt;
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

    /**
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
}
