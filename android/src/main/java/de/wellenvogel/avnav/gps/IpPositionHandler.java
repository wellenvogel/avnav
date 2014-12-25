package de.wellenvogel.avnav.gps;

import android.content.Context;
import android.location.Location;
import android.util.Log;
import net.sf.marineapi.nmea.io.SentenceReader;
import net.sf.marineapi.nmea.parser.SentenceFactory;
import net.sf.marineapi.nmea.sentence.PositionSentence;
import net.sf.marineapi.nmea.sentence.RMCSentence;
import net.sf.marineapi.nmea.sentence.Sentence;
import net.sf.marineapi.nmea.sentence.SentenceValidator;
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
    class ReceiverRunnable implements Runnable{
        String status="disconnected";
        InetSocketAddress address;
        Socket socket=new Socket();
        private Location location=null;
        ReceiverRunnable(InetSocketAddress address){
            this.address=address;
        }
        private boolean isRunning=true;
        private boolean isConnected=false;
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
                                if (s instanceof PositionSentence){
                                    Position p=((PositionSentence) s).getPosition();
                                    Log.d(LOGPRFX,"external position "+p);
                                    synchronized (this){
                                        location=new Location((String)null);
                                        location.setLatitude(p.getLatitude());
                                        location.setLongitude(p.getLongitude());
                                        if (s.getSentenceId().equals("RMC")){
                                            Calendar cal=Calendar.getInstance();
                                            RMCSentence r=(RMCSentence)s;
                                            cal.setTime(r.getDate().toDate());
                                            cal.add(Calendar.MILLISECOND,(int)(r.getTime().getMilliseconds()));
                                            location.setTime(cal.getTime().getTime());
                                            location.setSpeed((float)(r.getSpeed()));
                                            location.setBearing((float)(r.getCourse()));
                                        }
                                        Log.d(LOGPRFX,"location: "+location);
                                    }
                                }
                            }catch (Exception i){
                                Log.e(LOGPRFX,"exception in NMEA parser "+i.getLocalizedMessage());
                            }
                        }
                        else{
                            Log.d(LOGPRFX,"ignore invalid nmea");
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
