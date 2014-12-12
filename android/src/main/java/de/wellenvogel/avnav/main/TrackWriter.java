package de.wellenvogel.avnav.main;

import android.location.Location;
import android.util.Log;

import java.io.*;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;

/**
 * Created by andreas on 12.12.14.
 */
public class TrackWriter {

    private static final String header="<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\" ?>\n"+
        "<gpx xmlns=\"http://www.topografix.com/GPX/1/1\" version=\"1.1\" creator=\"avnav\"\n"+
        "xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"\n"+
        "xsi:schemaLocation=\"http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd\">\n"+
        "<trk>\n"+
        "<name>avnav-track-%s</name>\n"+
        "<trkseg>";
    private static final String footer="</trkseg>\n"+
        "</trk>\n"+
        "</gpx>\n";
    private static final String trkpnt="<trkpt lat=\"%2.9f\" lon=\"%2.9f\" ><time>%s</time><course>%3.1f</course><speed>%3.2f</speed></trkpt>\n";
    private File trackdir;
    private SimpleDateFormat nameFormat =new SimpleDateFormat("yyyy-MM-dd");
    private SimpleDateFormat dateFormat=new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSSZ");
    private SimpleDateFormat cmpFormat=new SimpleDateFormat("yyyyMMdd"); //we only need to compare the day

    private boolean writerRunning=false;


    TrackWriter(File trackdir){
        this.trackdir=trackdir;
    }
    private String getCurrentTrackname(Date dt){
        String rt= nameFormat.format(dt);
        return rt;
    }

    private class WriteRunner implements  Runnable{
        private ArrayList<Location> track;
        private Date dt;
        private TrackWriter writer;
        WriteRunner(ArrayList<Location> track, Date dt, TrackWriter writer){
            this.track=track;
            this.dt=dt;
            this.writer=writer;
        }
        @Override
        public void run() {

            try {
                String name = getCurrentTrackname(dt);
                File ofile = new File(trackdir, name + ".gpx");
                Log.d(AvNav.LOGPRFX, "writing trackfile " + ofile.getAbsolutePath());
                PrintStream out = new PrintStream(new FileOutputStream(ofile));
                out.format(header, name);
                int numpoints=0;
                for (Location l : track) {
                    if (l.getTime() == 0) continue;
                    if (isCurrentDay(l, dt))
                        numpoints++;
                        out.format(trkpnt, l.getLatitude(), l.getLongitude(), dateFormat.format(new Date(l.getTime())), l.getBearing(), l.getSpeed());
                }
                out.append(footer);
                out.close();
                Log.d(AvNav.LOGPRFX,"track written with "+numpoints+" points");
            } catch (IOException io) {
                Log.e(AvNav.LOGPRFX, "error writing trackfile: " + io.getLocalizedMessage());
            }
            writer.writerRunning=false;
        }
    }

    /**
     * write out a track file
     * will start a separate Thread to do this if called with the appropiate flag
     * @param track
     * @param dt
     * @throws FileNotFoundException
     */
    public void writeTrackFile(ArrayList<Location> track, Date dt,boolean background) throws FileNotFoundException {
        if (background) {
            if (writerRunning) return; //we will come back anyway...
            writerRunning=true;
            Thread t = new Thread(new WriteRunner(track, dt, this));
            t.start();
            return;
        }
        try {
            while (writerRunning) {
                Log.w(AvNav.LOGPRFX, "writer still running when trying sync write");
                Thread.sleep(100);
            }
            writerRunning=true;
            new WriteRunner(track,dt,this).run();
        }catch (InterruptedException e){
            return;
        }
    }
    public boolean isCurrentDay(Location l,Date dt){
        String ld=cmpFormat.format(new Date(l.getTime()));
        String dd=cmpFormat.format(dt);
        return ld.equals(dd);
    }

}
