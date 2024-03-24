package de.wellenvogel.avnav.worker;

import org.json.JSONException;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.PrintStream;
import java.util.ArrayList;
import java.util.Date;

import de.wellenvogel.avnav.main.IMediaUpdater;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.util.NmeaQueue;

/**
 * Created by andreas on 12.12.14.
 */
public class NmeaLogger extends Worker {
    private File trackdir;
    private NmeaQueue queue;
    private IMediaUpdater updater;


    NmeaLogger(File trackdir,GpsService ctx,NmeaQueue queue,IMediaUpdater updater){
        super("Logger",ctx);
        this.trackdir=trackdir;
        this.queue=queue;
        this.updater=updater;
        parameterDescriptions.addParams(Worker.ENABLED_PARAMETER,Worker.FILTER_PARAM,QUEUE_AGE_PARAMETER);
        status.canEdit=true;
    }


    public File getLogFile(Date dt){
        String name = TrackWriter.getCurrentTrackname(dt);
        File ofile = new File(trackdir, name + ".nmea");
        return ofile;
    }

    @Override
    protected void run(int startSequence) throws JSONException, IOException {
        File currentFile = null;
        PrintStream stream = null;
        long lastTry = 0;
        long lastCheck = 0;
        boolean newFile = false;
        int sequence = -1;
        String[] nmeaFilter = AvnUtil.splitNmeaFilter(FILTER_PARAM.fromJson(parameters));
        int numRecords=0;
        setStatus(WorkerStatus.Status.NMEA,"running");
        long queueAge=QUEUE_AGE_PARAMETER.fromJson(parameters);
        while (!shouldStop(startSequence)) {
            NmeaQueue.Entry entry = null;
            try {
                entry = queue.fetch(sequence, 200,queueAge);
            } catch (InterruptedException e) {
                continue;
            }
            if (entry == null) continue;
            sequence = entry.sequence;
            if (!AvnUtil.matchesNmeaFilter(entry.data, nmeaFilter)) {
                continue;
            }
            Date now = new Date();
            File nextFile = getLogFile(now);
            if (currentFile != null && now.getTime() > (lastCheck + 10000)) {
                if (!currentFile.exists()) {
                    AvnLog.i("reopen current logfile " + currentFile.getAbsolutePath());
                    //someone has deleted the file externally
                    if (stream != null) stream.close();
                    currentFile = null;
                    stream = null;
                }
                lastCheck = now.getTime();
            }
            if (currentFile == null || !currentFile.equals(nextFile)) {
                if (currentFile != null) {
                    if (stream != null) stream.close();
                    currentFile = null;
                    stream = null;
                }
                currentFile = nextFile;
                AvnLog.i("open current logfile " + currentFile.getAbsolutePath());
                status.setChildStatus("log", WorkerStatus.Status.NMEA,currentFile.getAbsolutePath());
                newFile = true;
                try {
                    stream = new PrintStream(new FileOutputStream(currentFile, true));
                } catch (FileNotFoundException e) {
                    if (lastTry == 0 || (now.getTime() - lastTry) > 10000) {
                        AvnLog.e("unable to open stream " + currentFile, e);
                        lastTry = now.getTime();
                    }
                    currentFile = null;
                }
            }
            if (stream != null) {
                stream.println(entry.data);
                numRecords++;
                setStatus(WorkerStatus.Status.NMEA,"running "+numRecords+" records");
                stream.flush();
                if (newFile) {
                    //try updating until we have an updater available
                    if (updater != null) {
                        updater.triggerUpdateMtp(currentFile);
                        newFile = false;
                    }
                }
            }
        }

        if (stream != null) stream.close();
    }


    public void setMediaUpdater(IMediaUpdater updater){
        this.updater=updater;
    }
}
