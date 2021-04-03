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
public abstract class ConnectionHandler extends Worker {
    private boolean stopped=false;
    private NmeaQueue queue;
    class WriterRunnable implements Runnable{
        AbstractConnection socket;
        String [] nmeaFilter;
        long lastWrite=0;
        boolean doStop=false;
        WriterRunnable(AbstractConnection socket) throws JSONException {
            this.socket=socket;
            nmeaFilter=AvnUtil.splitNmeaFilter(SEND_FILTER_PARAM.fromJson(parameters));
        }
        @Override
        public void run() {
            try {
                OutputStream os=socket.getOutputStream();
                int sequence=-1;
                while (!doStop){
                    NmeaQueue.Entry e=queue.fetch(sequence,1000);
                    if (e != null){
                        sequence=e.sequence;
                        if (!AvnUtil.matchesNmeaFilter(e.data, nmeaFilter)) {
                            AvnLog.d("ignore " + e.data + " due to filter");
                            continue;
                        }
                        lastWrite=System.currentTimeMillis();
                        os.write(e.data.getBytes());
                        lastWrite=0;
                    }
                }
            } catch (IOException | InterruptedException e) {
                AvnLog.e("writer "+name+": ",e);
                try {
                    socket.close();
                } catch (IOException ioException) {

                }
            }
        }

        public void stop(){
            doStop=true;
        }
    }

    class ReceiverRunnable implements Runnable{
        AbstractConnection socket;
        private boolean isRunning=true;
        private boolean isConnected=false;
        private boolean doStop;
        private Object waiter=new Object();
        private String nmeaFilter[]=null;
        ReceiverRunnable(AbstractConnection socket) throws JSONException {
            this.socket=socket;
            nmeaFilter=AvnUtil.splitNmeaFilter(FILTER_PARAM.fromJson(parameters));
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
                    setStatus(WorkerStatus.Status.ERROR,"connect error " + e);
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
                setStatus(WorkerStatus.Status.NMEA,"connected to "+socket.getId());
                try {
                    startWriter(socket);
                } catch (JSONException e) {
                    AvnLog.e("error starting writer for "+name+":_ ",e);
                }
                try {
                    BufferedReader in = new BufferedReader(new InputStreamReader(socket.getInputStream()),8);
                    isConnected = true;
                    while (!doStop) {
                        String line = in.readLine();
                        AvnLog.d(LOGPRFX, name + ": received: " + line);
                        if (line == null) {
                            setStatus(WorkerStatus.Status.ERROR,"disconnected, EOF");
                            try {
                                socket.close();
                                stopWriter();
                            } catch (Exception i) {
                            }
                            isConnected = false;
                            break;
                        }
                        line=AvnUtil.removeNonNmeaChars(line);
                        if (!AvnUtil.matchesNmeaFilter(line, nmeaFilter)) {
                            AvnLog.d("ignore " + line + " due to filter");
                            continue;
                        }
                        queue.add(line, name);
                    }
                } catch (IOException e) {
                    Log.e(LOGPRFX, name + ": Exception during read " + e.getLocalizedMessage());
                    setStatus(WorkerStatus.Status.ERROR,"read exception " + e);
                    try {
                        socket.close();
                        stopWriter();
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

    private void stopWriter(){
        if (writer != null){
            writer.stop();
            writer=null;
            if (writerThread != null) writerThread.interrupt();
        }
    }
    private void startWriter(AbstractConnection socket) throws JSONException {
        stopWriter();
        if (SEND_DATA_PARAMETER.fromJson(parameters)){
            AvnLog.i(LOGPRFX,name+":starting sender for "+socket.getId());
            this.writer=new WriterRunnable(socket);
            this.writerThread=new Thread(writer);
            this.writerThread.setDaemon(true);
            this.writerThread.start();
        }
    }

    public static final String LOGPRFX="AvNav:ConnectionHandler";
    Context context;
    AbstractConnection connection;
    String name;
    Thread receiverThread;
    ReceiverRunnable runnable;
    WriterRunnable writer;
    Thread writerThread;
    ConnectionHandler(String name, Context ctx, NmeaQueue queue) throws JSONException {
        super(name);
        parameterDescriptions=new EditableParameter.ParameterList(
                ENABLED_PARAMETER,
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
        stopWriter();
        this.runnable=new ReceiverRunnable(connection);
        this.receiverThread=new Thread(this.runnable);
        AvnLog.i(LOGPRFX,name+":starting receiver for "+ connection.getId());
        this.receiverThread.setDaemon(true);
        this.receiverThread.start();
    }

    @Override
    public synchronized void stop() {
        this.stopped=true;
        stopWriter();
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
        if (this.runnable == null || ! this.runnable.getRunning()){
            this.runnable=new ReceiverRunnable(this.connection);
            this.receiverThread=new Thread(this.runnable);
            AvnLog.d(LOGPRFX,name+": restarting receiver thread for "+this.connection.getId());
            this.receiverThread.start();
        }
        if(connection.check()){
            AvnLog.e(name+": closing socket due to write timeout");
            stopWriter();
        }
    }

}
