package de.wellenvogel.avnav.worker;

import android.util.Log;

import org.json.JSONException;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.util.MovingSum;
import de.wellenvogel.avnav.util.NmeaQueue;

/**
 * Created by andreas on 25.12.14.
 */
public class ConnectionReaderWriter{
    private static Pattern NMEA_START=Pattern.compile("[!$]");
    public static class ConnectionProperties {
        public String sourceName;
        public boolean readData=true;
        public boolean writeData=false;
        public String[] readFilter;
        public String[] writeFilter;
        public boolean closeOnReadTimeout=false;
        public int noDataTime=0;
        public int connectTimeout =0;
        public int writeTimeout=0;
        public String[] blacklist;
        public boolean stripLeading=false;
    }

    private static final String LOGPRFX = "ConnectionReaderWriter";
    private boolean stopped = false;
    private NmeaQueue queue;
    private AbstractConnection connection;
    private ConnectionProperties properties;
    private String name;
    private int priority=0;
    WriterRunnable writer;
    Thread writerThread;
    Thread updateThread;
    long queueAge=3000;
    public static interface StatusUpdater{
        void update(WorkerStatus.Status status,String info);
    }
    StatusUpdater updater;
    MovingSum receiveCounter=new MovingSum(10);
    MovingSum sendCount=new MovingSum(10);
    int queueSkips=0;
    public ConnectionReaderWriter(AbstractConnection connection, String name, int priority, NmeaQueue queue,long queueAge,StatusUpdater updater) {
        this.connection = connection;
        this.properties = connection.properties;
        this.name = name;
        this.queue = queue;
        this.priority=priority;
        this.queueAge=queueAge;
        this.updater=updater;
    }

    class WriterRunnable implements Runnable {
        @Override
        public void run() {
            try {
                OutputStream os = connection.getOutputStream();
                NmeaQueue.Fetcher fetcher=new NmeaQueue.Fetcher(queue, new NmeaQueue.Fetcher.StatusUpdate() {
                    @Override
                    public void update(MovingSum received, MovingSum errors) {
                        sendCount.add(0);
                        queueSkips= errors.val();
                    }
                },200);
                while (!stopped) {
                    NmeaQueue.Entry e = fetcher.fetch(200,queueAge);
                    if (e != null) {
                        if (! e.valid) continue;
                        if (!AvnUtil.matchesNmeaFilter(e.data, properties.writeFilter)) {
                            AvnLog.dfs("ignore %s due to filter",e.data);
                            continue;
                        }
                        if (properties.blacklist != null){
                            boolean blackListed=false;
                            for (String bl:properties.blacklist){
                                if (bl.equals(e.source)){
                                    AvnLog.dfs("ignore %s due to blacklist entry %s",e.data,bl);
                                    blackListed=true;
                                    break;
                                }
                            }
                            if (blackListed) continue;
                        }
                        sendCount.add(1);
                        os.write((e.data+"\r\n").getBytes());
                    }
                }
            } catch (IOException | InterruptedException e) {
                AvnLog.e("writer " + name + ": ", e);
                try {
                    connection.close();
                    stopped = true;
                } catch (IOException ioException) {

                }
            }
        }
    }

    boolean isConnected() {
        return ! stopped && ! connection.isClosed() ;
    }


    public void run() throws IOException {
        try {
            startWriter();
        } catch (JSONException e) {
            AvnLog.e("error starting writer for " + name + ":_ ", e);
            stopped = true;
            return;
        }
        try{
            if (updateThread != null){
                updateThread.interrupt();
            }
        }catch (Throwable t){}
        queueSkips=0;
        sendCount.clear();
        receiveCounter.clear();
        updateThread=new Thread(new Runnable() {
            @Override
            public void run() {
                if (updater == null) return;
                while(true) {
                    sendCount.add(0);
                    receiveCounter.add(0);
                    boolean hasData = sendCount.val() > 0 || receiveCounter.val() > 0;
                    StringBuilder info = new StringBuilder();
                    if (properties.readData) {
                        info.append(String.format("rcv=%.2f/s ", receiveCounter.avg()));
                    }
                    if (properties.writeData) {
                        info.append(String.format("snd=%.2f/s, err=%d/10s", sendCount.avg(), queueSkips));
                    }
                    if (!properties.readData && !properties.writeData) {
                        info.append("inactive");
                        hasData = false;
                    }
                    if (stopped) return;
                    updater.update(hasData ? WorkerStatus.Status.NMEA : WorkerStatus.Status.INACTIVE,
                            info.toString());
                    try {
                        Thread.sleep(200);
                    } catch (InterruptedException e) {
                        return;
                    }
                }
            }
        });
        updateThread.setDaemon(true);
        updateThread.start();
        BufferedReader in = new BufferedReader(new InputStreamReader(connection.getInputStream()), 8);
        while (!stopped) {
            try {
                //TODO:timeout exception
                String line = in.readLine();
                AvnLog.d(LOGPRFX, name + ": received: " + line);
                if (line == null) {
                    break;
                }
                if (line.isEmpty()) continue;
                if (properties.readData) {
                    line = AvnUtil.removeNonNmeaChars(line);
                    if (line.length() < 1){
                        continue;
                    }
                    if (properties.stripLeading){
                        if (line.charAt(0) != '!' && line.charAt(0) != '$') {
                            Matcher m = NMEA_START.matcher(line);
                            if (m.find()) {
                                line = line.substring(m.start());
                            }
                        }
                    }
                    if (! line.startsWith("!") && ! line.startsWith("$") ){
                        AvnLog.dfs("broken line \"%s\"",line);
                    }
                    if (!AvnUtil.matchesNmeaFilter(line, properties.readFilter)) {
                        AvnLog.dfs("ignore %s due to filter",line);
                        continue;
                    }
                    receiveCounter.add(1);
                    queue.add(line, name,priority);
                }

            } catch (IOException e) {
                Log.e(LOGPRFX, name + ": Exception during read " + e.getLocalizedMessage());
                break;
            }
        }
        stop();
        AvnLog.i("connection handler " + properties.sourceName + " stopped");
    }


    public void stop() {
        stopped = true;
        if (connection != null) {
            try {
                AvnLog.d(LOGPRFX, name + ": closing connection");
                connection.close();
            } catch (Exception i) {
            }
        }
        if (writerThread != null){
            try{
                writerThread.interrupt();
            }catch(Throwable t){}
        }
        if (updateThread != null){
            try{
                updateThread.interrupt();
            }catch (Throwable t){}
        }
    }


    private void startWriter() throws JSONException {
        if (properties.writeData) {
            AvnLog.i(LOGPRFX, name + ":starting sender for " + connection.getId());
            this.writer = new WriterRunnable();
            this.writerThread = new Thread(writer);
            this.writerThread.setDaemon(true);
            this.writerThread.start();
        }
    }
}
