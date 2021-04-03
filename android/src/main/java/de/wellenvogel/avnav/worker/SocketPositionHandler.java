package de.wellenvogel.avnav.worker;

import android.content.Context;
import android.location.Location;
import android.util.Log;

import net.sf.marineapi.nmea.sentence.RMCSentence;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;

import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.util.NmeaQueue;

/**
 * Created by andreas on 25.12.14.
 */
public abstract class SocketPositionHandler extends GpsDataProvider {
    private boolean stopped=false;
    private NmeaQueue queue;

    class ReceiverRunnable implements Runnable{
        String status="disconnected";
        AbstractSocket socket;
        private Location location=null;
        private Properties properties;
        private boolean isRunning=true;
        private boolean isConnected=false;
        private boolean doStop;
        private Object waiter=new Object();
        private String nmeaFilter[]=null;
        ReceiverRunnable(AbstractSocket socket,Properties prop){
            properties=prop;
            this.socket=socket;
            nmeaFilter=AvnUtil.splitNmeaFilter(prop.nmeaFilter);
        }
        @Override
        public void run() {
            long lastConnect=0;
            while (! doStop) {
                isConnected=false;
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
                            break;
                        }
                        line=AvnUtil.removeNonNmeaChars(line);
                        if (line.startsWith("$") && properties.readNmea) {
                            if (!AvnUtil.matchesNmeaFilter(line, nmeaFilter)) {
                                AvnLog.d("ignore " + line + " due to filter");
                                continue;
                            }
                            queue.add(line, name);
                        }
                        if (line.startsWith("!") && properties.readAis) {
                            queue.add(line,name);
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

    }

    public static final String LOGPRFX="AvNav:SocketPh";
    Context context;
    AbstractSocket socket;
    String name;
    Thread receiverThread;
    ReceiverRunnable runnable;
    Properties properties;
    SocketPositionHandler(String name,Context ctx, AbstractSocket socket, Properties prop,NmeaQueue queue){
        context=ctx;
        this.queue=queue;
        this.name=name;
        this.socket=socket;
        properties=prop;
        this.runnable=new ReceiverRunnable(socket,properties);
        this.receiverThread=new Thread(this.runnable);
        AvnLog.d(LOGPRFX,name+":starting receiver for "+socket.getId());
        this.receiverThread.start();
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
    public synchronized void check() {
        if (this.isStopped()) return;
        if (this.runnable == null || ! this.runnable.getRunning()){
            this.runnable=new ReceiverRunnable(this.socket,properties);
            this.receiverThread=new Thread(this.runnable);
            AvnLog.d(LOGPRFX,name+": restarting receiver thread for "+this.socket.getId());
            this.receiverThread.start();
        }
        if(socket.check()){
            AvnLog.e(name+": closing socket due to write timeout");
        }
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
        if (runnable != null && runnable.getConnected()) {
            String info = "(" + addr + ") connected";
            item.put("info", info);
            item.put("status", GpsDataProvider.STATUS_NMEA);
        } else {
            item.put("info", "(" + addr + ") disconnected");
            item.put("status", GpsDataProvider.STATUS_ERROR);
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
