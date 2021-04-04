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
public class ConnectionReaderWriter{
    public static class ConnectionProperties {
        public String sourceName;
        public boolean readData;
        public boolean writeData;
        public String[] readFilter;
        public String[] writeFilter;
        public int readTimeout = 0;
        public int noDataTime=10000;
    }

    private static final String LOGPRFX = "ConnectionHandler";
    private boolean stopped = false;
    private NmeaQueue queue;
    private AbstractConnection connection;
    private ConnectionProperties properties;
    private boolean dataAvailable = true;
    private String name;
    WriterRunnable writer;
    Thread writerThread;
    long lastReceived=0;

    public ConnectionReaderWriter(AbstractConnection connection, ConnectionProperties properties, String name, NmeaQueue queue) {
        this.connection = connection;
        this.properties = properties;
        this.name = name;
        this.queue = queue;
    }

    class WriterRunnable implements Runnable {
        @Override
        public void run() {
            try {
                OutputStream os = connection.getOutputStream();
                int sequence = -1;
                while (!stopped) {
                    NmeaQueue.Entry e = queue.fetch(sequence, 1000);
                    if (e != null) {
                        sequence = e.sequence;
                        if (!AvnUtil.matchesNmeaFilter(e.data, properties.writeFilter)) {
                            AvnLog.d("ignore " + e.data + " due to filter");
                            continue;
                        }
                        connection.startWrite();
                        os.write(e.data.getBytes());
                        connection.finishWrite();
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

    boolean hasNmea() {
        return dataAvailable && (System.currentTimeMillis() < (lastReceived+properties.noDataTime));
    }


    public void run() {
        try {
            startWriter();
        } catch (JSONException e) {
            AvnLog.e("error starting writer for " + name + ":_ ", e);
            stopped = true;
            return;
        }
        while (!stopped) {
            try {
                BufferedReader in = new BufferedReader(new InputStreamReader(connection.getInputStream()), 8);
                while (!stopped) {
                    //TODO:timeout exception
                    String line = in.readLine();
                    AvnLog.d(LOGPRFX, name + ": received: " + line);
                    if (line == null) {
                        break;
                    }
                    if (properties.readData) {
                        line = AvnUtil.removeNonNmeaChars(line);
                        if (!AvnUtil.matchesNmeaFilter(line, properties.readFilter)) {
                            AvnLog.d("ignore " + line + " due to filter");
                            continue;
                        }
                        lastReceived=System.currentTimeMillis();
                        queue.add(line, name);
                    }
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
