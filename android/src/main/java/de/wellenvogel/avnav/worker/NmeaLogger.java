package de.wellenvogel.avnav.worker;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.PrintStream;
import java.util.ArrayList;
import java.util.Date;

import de.wellenvogel.avnav.main.IMediaUpdater;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;

/**
 * Created by andreas on 12.12.14.
 */
public class NmeaLogger {

    private File trackdir;
    private static final int MAXENTRIES=100;
    private ArrayList<String> queue=new ArrayList<String>(MAXENTRIES);
    private LogWriter writer;
    private Thread writerThread;
    private boolean doStop=false;
    private int queueFullCounter=0;
    private boolean logAis=false;
    private boolean logNmea=false;
    private IMediaUpdater updater;
    private String[] nmeaFilter;

    public void addRecord(String record) {
        if (! logAis && record.startsWith("!")) return;
        if (! logNmea && record.startsWith("$")) return;
        if (! AvnUtil.matchesNmeaFilter(record,nmeaFilter)) return;
        synchronized (queue) {
            if (queue.size() < MAXENTRIES) {
                queue.add(record);
                queue.notifyAll();
            } else {
                queueFullCounter++;
            }
        }
    }

    public String pop(){
        synchronized (queue){
            while( queue.size() == 0){
                if (doStop) return null;
                try {
                    queue.wait(1000);
                } catch (InterruptedException e) {
                    return null;
                }
            }
            return queue.remove(0);
        }
    }

    NmeaLogger(File trackdir,IMediaUpdater updater,INmeaLogger.Properties properties){
        this.trackdir=trackdir;
        writer=new LogWriter();
        writerThread=new Thread(writer);
        writerThread.setDaemon(false);
        writerThread.start();
        this.logAis=properties.logAis;
        this.logNmea=properties.logNmea;
        this.updater=updater;
        nmeaFilter= AvnUtil.splitNmeaFilter(properties.nmeaFilter);
    }

    public void stop(){
        doStop=true;
        synchronized (queue){
            queue.notifyAll();
        }
        writerThread.interrupt();
        try {
            writerThread.join(100);
        } catch (InterruptedException e) {
            AvnLog.e("unable to finish writer thread within 100ms",e);
        }
    }


    public File getLogFile(Date dt){
        String name = TrackWriter.getCurrentTrackname(dt);
        File ofile = new File(trackdir, name + ".nmea");
        return ofile;
    }

    private class LogWriter implements Runnable{

        @Override
        public void run() {
            File currentFile=null;
            PrintStream stream=null;
            long lastTry=0;
            long lastCheck=0;
            boolean newFile=false;
            while (! doStop){
                String line=pop();
                if (line == null){
                    if (doStop) {
                        if (stream != null) stream.close();
                        return;
                    }
                }
                else{
                    Date now=new Date();
                    File nextFile=getLogFile(now);
                    if (currentFile != null && now.getTime() > (lastCheck+10000)){
                        if (! currentFile.exists()){
                            AvnLog.i("reopen current logfile "+currentFile.getAbsolutePath());
                            //someone has deleted the file externally
                            if (stream != null) stream.close();
                            currentFile=null;
                            stream=null;
                        }
                        lastCheck=now.getTime();
                    }
                    if (currentFile == null || ! currentFile.equals(nextFile)){
                        if (currentFile != null){
                            if (stream != null) stream.close();
                            currentFile=null;
                            stream=null;
                        }
                        currentFile=nextFile;
                        AvnLog.i("open current logfile "+currentFile.getAbsolutePath());
                        newFile=true;
                        try {
                            stream=new PrintStream(new FileOutputStream(currentFile,true));
                        } catch (FileNotFoundException e) {
                            if (lastTry == 0 || (now.getTime() - lastTry) > 10000) {
                                AvnLog.e("unable to open stream " + currentFile, e);
                                lastTry=now.getTime();
                            }
                            currentFile=null;
                        }
                    }
                    if (stream != null){
                        stream.println(line);
                        stream.flush();
                        if (newFile){
                            //try updating until we have an updater available
                            if (updater != null) {
                                updater.triggerUpdateMtp(currentFile);
                                newFile=false;
                            }
                        }
                    }
                }
            }
            if (stream != null) stream.close();

        }

    }

    public int getQueueFullCounter(){
        return queueFullCounter;
    }
    public void setMediaUpdater(IMediaUpdater updater){
        this.updater=updater;
    }
}
