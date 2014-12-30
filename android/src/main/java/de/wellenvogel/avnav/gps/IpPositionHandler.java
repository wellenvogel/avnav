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
public class IpPositionHandler extends GpsDataProvider {
    private long lastAisCleanup=0;


    class ReceiverRunnable implements Runnable{
        String status="disconnected";
        InetSocketAddress address;
        Socket socket=new Socket();
        private Location location=null;
        private long lastPositionReceived=0;
        private net.sf.marineapi.nmea.util.Date lastDate=null;
        private Properties properties;
        private boolean isRunning=true;
        private boolean isConnected=false;
        private AisPacketParser aisparser;
        private AisStore store;
        ReceiverRunnable(InetSocketAddress address,Properties prop){
            properties=prop;
            this.address=address;
            if (properties.readAis) {
                aisparser=new AisPacketParser();
                store=new AisStore();
            }
        }
        @Override
        public void run() {
            try{
                socket.connect(address,properties.connectTimeout);
            } catch (Exception e){
                Log.e(LOGPRFX, "Exception during connect " + e.getLocalizedMessage());
                status="connect error "+e;
                isRunning=false;
                return;
            }
            try {
                BufferedReader in =new BufferedReader( new InputStreamReader(socket.getInputStream()));
                status="receiving";
                isConnected=true;
                SentenceFactory factory = SentenceFactory.getInstance();
                while (true){
                    String line=in.readLine();
                    Log.d(LOGPRFX,"received: "+line);
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
                                    Log.d(LOGPRFX, "external position " + p);
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
                                        Log.d(LOGPRFX,"location: "+location);
                                    }
                                }
                                else{
                                    Log.d(LOGPRFX,"ignoring sentence "+line+" - no position or time");
                                }
                            }catch (Exception i){
                                Log.e(LOGPRFX,"exception in NMEA parser "+i.getLocalizedMessage());
                                i.printStackTrace();
                            }
                        }
                        else{
                            Log.d(LOGPRFX,"ignore invalid nmea");
                        }
                    }
                    if (line.startsWith("!") && properties.readAis){
                        if (Abk.isAbk(line)){
                            aisparser.newVdm();
                            Log.i(LOGPRFX,"ignore abk line "+line);
                        }
                        try {
                            AisPacket p=aisparser.readLine(line);
                            if (p != null){
                                AisMessage m=p.getAisMessage();
                                Log.i(LOGPRFX,"AisPacket received: "+m.toString());
                                store.addAisMessage(m);
                            }
                        } catch (Exception e) {
                            Log.e(LOGPRFX,"AIS exception while parsing "+line);
                            e.printStackTrace();
                        }
                    }

                }
            } catch (IOException e) {
                Log.e(LOGPRFX,"Exception during read "+e.getLocalizedMessage());
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
                    Log.d(LOGPRFX,"closing socket");
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
    }
    public static final String LOGPRFX="AvNav:IpPositionHandler";
    Context context;
    InetSocketAddress address;
    Thread receiverThread;
    ReceiverRunnable runnable;
    Properties properties;

    IpPositionHandler(Context ctx,InetSocketAddress address,Properties prop){
        context=ctx;
        this.address=address;
        properties=prop;
        this.runnable=new ReceiverRunnable(address,properties);
        this.receiverThread=new Thread(this.runnable);
        Log.d(LOGPRFX,"starting receiver for "+this.address.toString());
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
            this.runnable=new ReceiverRunnable(this.address,properties);
            this.receiverThread=new Thread(this.runnable);
            Log.d(LOGPRFX,"restarting receiver thread for "+this.address.toString());
            this.receiverThread.start();
        }
        if (properties.readAis){
            Thread cleanupThread=new Thread(new Runnable() {
                @Override
                public void run() {
                    Log.d(LOGPRFX,"cleanup AIS data");
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
}
