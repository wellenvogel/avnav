package de.wellenvogel.avnav.worker;

import android.content.Context;
import android.util.Log;

import org.json.JSONException;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;

import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.util.NmeaQueue;

/**
 * Created by andreas on 25.12.14.
 */
public abstract class SingleConnectionHandler extends Worker {
    private boolean stopped=false;
    private NmeaQueue queue;

    private ConnectionHandler.ConnectionProperties getConnectionProperties() throws JSONException {
        ConnectionHandler.ConnectionProperties rt=new ConnectionHandler.ConnectionProperties();
        rt.readData=true;
        rt.writeData=SEND_DATA_PARAMETER.fromJson(parameters);
        rt.readFilter=AvnUtil.splitNmeaFilter(FILTER_PARAM.fromJson(parameters));
        rt.writeFilter=AvnUtil.splitNmeaFilter(SEND_FILTER_PARAM.fromJson(parameters));
        rt.sourceName=SOURCENAME_PARAMETER.fromJson(parameters);
        if (rt.sourceName == null || rt.sourceName.isEmpty()) rt.sourceName=name;
        return rt;
    }
    class ReceiverRunnable implements Runnable{
        private boolean isRunning=true;
        private boolean isConnected=false;
        private boolean doStop=false;
        private Object waiter=new Object();
        ReceiverRunnable(){
        }
        @Override
        public void run() {
            long lastConnect=0;
            while (! doStop) {
                isConnected=false;
                try {
                    lastConnect=System.currentTimeMillis();
                    connection.connect();
                } catch (Exception e) {
                    Log.e(LOGPRFX, name + ": Exception during connect " + e.getLocalizedMessage());
                    setStatus(WorkerStatus.Status.ERROR,"connect error " + e);
                    try {
                        connection.close();
                    }catch (Exception i){}
                    try {
                        synchronized (waiter) {
                            waiter.wait(5000);
                        }
                    } catch (InterruptedException e1) {

                    }
                    continue;
                }
                AvnLog.d(LOGPRFX, name + ": connected to " + connection.getId());
                setStatus(WorkerStatus.Status.NMEA,"connected to "+connection.getId());
                try{
                    ConnectionHandler handler=new ConnectionHandler(connection,getConnectionProperties(),name,queue);
                    handler.run();
                } catch (JSONException e) {
                    Log.e(LOGPRFX, name + ": Exception during read " + e.getLocalizedMessage());
                    setStatus(WorkerStatus.Status.ERROR,"read exception " + e);
                    try {
                        connection.close();
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
            if (connection != null) {
                try{
                    AvnLog.d(LOGPRFX,name+": closing socket");
                    connection.close();
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

    public static final String LOGPRFX="SingleConnectionHandler";
    Context context;
    AbstractConnection connection;
    String name;
    Thread receiverThread;
    ReceiverRunnable runnable;
    SingleConnectionHandler(String name, Context ctx, NmeaQueue queue) throws JSONException {
        super(name);
        parameterDescriptions=new EditableParameter.ParameterList(
                ENABLED_PARAMETER,
                SOURCENAME_PARAMETER,
                FILTER_PARAM,
                SEND_DATA_PARAMETER,
                SEND_FILTER_PARAM
        );
        context=ctx;
        this.queue=queue;
        this.name=name;
        this.connection = connection;
    }

    public void runInternal(AbstractConnection con) throws JSONException {
        this.connection =con;
        this.runnable=new ReceiverRunnable();
        this.receiverThread=new Thread(this.runnable);
        AvnLog.i(LOGPRFX,name+":starting receiver for "+ connection.getId());
        this.receiverThread.setDaemon(true);
        this.receiverThread.start();
    }

    @Override
    public synchronized void stop() {
        this.stopped=true;
        try {
            this.connection.close();
        } catch (IOException e) {
        }
        this.runnable.stop();
        this.runnable=null;
    }

    @Override
    public boolean isStopped() {
        return stopped;
    }


    @Override
    public synchronized void check() throws JSONException {
        if (this.isStopped()) return;
        if(connection.check()){
            AvnLog.e(name+": closing socket due to write timeout");
        }
    }

}
