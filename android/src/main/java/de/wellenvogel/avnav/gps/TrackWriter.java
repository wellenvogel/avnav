package de.wellenvogel.avnav.gps;

import android.location.Location;
import android.util.Log;
import de.wellenvogel.avnav.main.AvNav;
import de.wellenvogel.avnav.main.ISO8601DateParser;
import org.xmlpull.v1.XmlPullParser;
import org.xmlpull.v1.XmlPullParserException;
import org.xmlpull.v1.XmlPullParserFactory;

import java.io.*;
import java.text.SimpleDateFormat;
import java.util.*;

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
    private SimpleDateFormat cmpFormat=new SimpleDateFormat("yyyyMMdd"); //we only need to compare the day

    private boolean writerRunning=false;


    TrackWriter(File trackdir){
        this.trackdir=trackdir;
    }
    private String getCurrentTrackname(Date dt){
        String rt= nameFormat.format(dt);
        return rt;
    }

    public File getTrackFile(Date dt){
        String name = getCurrentTrackname(dt);
        File ofile = new File(trackdir, name + ".gpx");
        return ofile;
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
                File ofile = getTrackFile(dt);
                Log.d(AvNav.LOGPRFX, "writing trackfile " + ofile.getAbsolutePath());
                PrintStream out = new PrintStream(new FileOutputStream(ofile));
                out.format(header, name);
                int numpoints=0;
                for (Location l : track) {
                    if (l.getTime() == 0) continue;
                    if (isCurrentDay(l, dt)) {
                        numpoints++;
                        out.format(Locale.ENGLISH, trkpnt, l.getLatitude(), l.getLongitude(), ISO8601DateParser.toString(new Date(l.getTime())), l.getBearing(), l.getSpeed());
                    }
                }
                out.append(footer);
                out.close();
                Log.d(AvNav.LOGPRFX,"track written with "+numpoints+" points");
            } catch (Exception io) {
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

    public ArrayList<Location> parseTrackFile(Date dt, long mintime,float minDistance) {

        ArrayList<Location> rt = new ArrayList<Location>();
        File infile = new File(trackdir, getCurrentTrackname(dt)+".gpx");
        if (!infile.isFile()) {
            Log.d(AvNav.LOGPRFX, "unable to read trackfile " + infile.getName());
            return rt;
        }
        InputStream in_s = null;
        try {
            in_s = new FileInputStream(infile);

            rt=new TrackParser().parseTrackFile(in_s,mintime, minDistance);
            in_s.close();
        } catch (Exception e) {
            Log.e(AvNav.LOGPRFX,"unexpected error while opening trackfile "+e);
            return rt;
        }
        Log.d(AvNav.LOGPRFX,"read trackfile "+infile+" with "+rt.size()+" trackpoints");
        return rt;
    }

    private class TrackParser {
        private ArrayList<Location> track=new ArrayList<Location>();
        private long mintime=0;
        private float minDistance=0;
        private ArrayList<Location> parseTrackFile(InputStream in, long mintime,float minDistance ){
            this.mintime=mintime;
            this.minDistance=minDistance;
            XmlPullParserFactory pullParserFactory;
            try {
                pullParserFactory = XmlPullParserFactory.newInstance();
                XmlPullParser parser = pullParserFactory.newPullParser();
                parser.setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, false);
                parser.setInput(in, null);
                parseXML(parser);
            } catch (XmlPullParserException e) {
                e.printStackTrace();
            } catch (IOException e) {
                e.printStackTrace();
            }
            Collections.sort(track, new Comparator<Location>() {
                @Override
                public int compare(Location lhs, Location rhs) {
                    if (lhs.getTime() == rhs.getTime()) return 0;
                    return (lhs.getTime() - rhs.getTime()) > 0 ? 1 : -1;
                }
            });
            //now clean up and remove duplicates
            ArrayList<Location> rt=new ArrayList<Location>();
            Location last=null;
            for (Location l: track){
                if (last == null){
                    rt.add(l);
                    last=l;
                }
                else {
                    if (last.distanceTo(l) >= minDistance ){
                        rt.add(l);
                        last=l;
                    }
                }
            }
            return rt;

        }

        private void parseXML(XmlPullParser parser) throws XmlPullParserException,IOException {
            int eventType = parser.getEventType();
            Location currentLocation = null;
            long current=System.currentTimeMillis();

            while (eventType != XmlPullParser.END_DOCUMENT) {
                String name = null;
                switch (eventType) {
                    case XmlPullParser.START_TAG:
                        name = parser.getName();
                        if (name.equalsIgnoreCase("trkpt")) {
                            currentLocation=new Location((String)null);
                            String lon=parser.getAttributeValue(null,"lon");
                            String lat=parser.getAttributeValue(null,"lat");
                            try{
                                currentLocation.setLatitude(Double.parseDouble(lat));
                                currentLocation.setLongitude(Double.parseDouble(lon));
                            }catch (Exception e){}
                        } else if (currentLocation != null) {
                            String v=null;
                            if (name.equalsIgnoreCase("time")) {
                                try {
                                    v = parser.nextText();
                                    currentLocation.setTime(ISO8601DateParser.parse(v).getTime());
                                }catch (Exception e){
                                    Log.d(AvNav.LOGPRFX,"exception parsing track date "+v+": "+e.getLocalizedMessage());
                                }
                            } else if (name.equalsIgnoreCase("course")) {
                                try {
                                    v = parser.nextText();
                                    currentLocation.setBearing(Float.parseFloat(v));
                                }catch (Exception e){
                                    Log.d(AvNav.LOGPRFX,"exception parsing bearing "+v+": "+e.getLocalizedMessage());
                                }
                            } else if (name.equalsIgnoreCase("speed")) {
                                try {
                                    v = parser.nextText();
                                    currentLocation.setSpeed(Float.parseFloat(v));
                                }catch (Exception e){
                                    Log.d(AvNav.LOGPRFX,"exception parsing speed "+v+": "+e.getLocalizedMessage());
                                }
                            }
                        }
                        break;
                    case XmlPullParser.END_TAG:
                        name = parser.getName();
                        if (name.equalsIgnoreCase("trkpt") && currentLocation != null) {
                            if (currentLocation.getTime()>0 && currentLocation.getTime() < current && currentLocation.getTime() >= mintime) {
                                track.add(currentLocation);
                            }
                            currentLocation=null;
                        }
                }
                eventType = parser.next();
            }


        }


    }

}
