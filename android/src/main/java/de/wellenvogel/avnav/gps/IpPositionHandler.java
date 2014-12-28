package de.wellenvogel.avnav.gps;

import android.content.Context;
import android.location.Location;
import android.util.Log;
import de.wellenvogel.avnav.aislib.messages.sentence.Abk;
import de.wellenvogel.avnav.aislib.messages.sentence.SentenceException;
import de.wellenvogel.avnav.aislib.packet.AisPacket;
import de.wellenvogel.avnav.aislib.packet.AisPacketParser;
import net.sf.marineapi.nmea.io.SentenceReader;
import net.sf.marineapi.nmea.parser.SentenceFactory;
import net.sf.marineapi.nmea.sentence.*;
import net.sf.marineapi.nmea.util.Position;
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
    private static int connectTimeout=5000;
    private static long POSITION_AGE=10000; //max allowed age of position
    class ReceiverRunnable implements Runnable{
        String status="disconnected";
        InetSocketAddress address;
        Socket socket=new Socket();
        private Location location=null;
        private long lastPositionReceived=0;
        private net.sf.marineapi.nmea.util.Date lastDate=null;
        ReceiverRunnable(InetSocketAddress address){
            this.address=address;
        }
        private boolean isRunning=true;
        private boolean isConnected=false;
        private AisPacketParser aisparser= new AisPacketParser();
        @Override
        public void run() {
            try{
                socket.connect(address,connectTimeout);
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
                    if (line.startsWith("$")){
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
                    if (line.startsWith("!")){
                        if (Abk.isAbk(line)){
                            aisparser.newVdm();
                            Log.i(LOGPRFX,"ignore abk line "+line);
                        }
                        try {
                            AisPacket p=aisparser.readLine(line);
                            if (p != null){
                                Log.i(LOGPRFX,"AisPacket received: "+p.getAisMessage().toString());
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
            if (current > (lastPositionReceived+POSITION_AGE)){
                return null;
            }
            return location;
        }
    }
    public static final String LOGPRFX="AvNav:IpPositionHandler";
    Context context;
    InetSocketAddress address;
    Thread receiverThread;
    ReceiverRunnable runnable;

    IpPositionHandler(Context ctx,InetSocketAddress address){
        context=ctx;
        this.address=address;
        this.runnable=new ReceiverRunnable(address);
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
            this.runnable=new ReceiverRunnable(this.address);
            this.receiverThread=new Thread(this.runnable);
            Log.d(LOGPRFX,"restarting receiver thread for "+this.address.toString());
            this.receiverThread.start();
        }
    }

    @Override
    JSONObject getGpsData(Location curLoc) throws JSONException {
        return super.getGpsData(curLoc);
    }
}
