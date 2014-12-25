package de.wellenvogel.avnav.gps;

import android.content.Context;
import android.location.Location;
import android.util.Log;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.InetSocketAddress;
import java.net.Socket;

/**
 * Created by andreas on 25.12.14.
 */
public class IpPositionHandler extends GpsDataProvider {
    private static int connectTimeout=5000;
    class ReceiverRunnable implements Runnable{
        String status="disconnected";
        InetSocketAddress address;
        Socket socket=new Socket();
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
        return super.getLocation();
    }

    @Override
    public JSONObject getGpsData() throws JSONException {
        return super.getGpsData();
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
