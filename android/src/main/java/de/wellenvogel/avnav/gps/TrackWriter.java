package de.wellenvogel.avnav.gps;

import android.location.Location;
import android.net.Uri;
import android.util.Log;

import de.wellenvogel.avnav.main.IMediaUpdater;
import de.wellenvogel.avnav.main.INavRequestHandler;
import de.wellenvogel.avnav.main.ISO8601DateParser;
import de.wellenvogel.avnav.main.RequestHandler;
import de.wellenvogel.avnav.util.AvnLog;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.xmlpull.v1.XmlPullParser;
import org.xmlpull.v1.XmlPullParserException;
import org.xmlpull.v1.XmlPullParserFactory;

import java.io.*;
import java.text.SimpleDateFormat;
import java.util.*;

import static de.wellenvogel.avnav.main.Constants.LOGPRFX;

/**
 * Created by andreas on 12.12.14.
 */
public class TrackWriter implements INavRequestHandler {

    @Override
    public RequestHandler.ExtendedWebResourceResponse handleDownload(String name, Uri uri) throws Exception {
        File trackfile = new File(trackdir, name);
        if (!trackfile.isFile()) throw new IOException("trackfile "+name+" not found");
        return new RequestHandler.ExtendedWebResourceResponse((int) trackfile.length(), "application/gpx+xml", "", new FileInputStream(trackfile));
    }

    @Override
    public boolean handleUpload(String postData, String name, boolean ignoreExisting) throws Exception {
        throw new Exception("unable to upload tracks");
    }

    @Override
    public Collection<? extends IJsonObect> handleList() throws Exception {
        return listTracks();
    }

    @Override
    public boolean handleDelete(String name, Uri uri) throws Exception {
        File trackfile = new File(trackdir, name);
        if (! trackfile.isFile()){
            return false;
        }
        boolean rt=trackfile.delete();
        if (name.replace(".gpx","").equals(getCurrentTrackname(new Date()))) {
            AvnLog.i("deleting current trackfile");
            trackpoints.clear();
        }
        return rt;
    }

    @Override
    public JSONObject handleApiRequest(Uri uri) throws Exception {
        return null;
    }

    public static class TrackInfo implements INavRequestHandler.IJsonObect{
        public String name;
        public long mtime;
        public JSONObject toJson() throws JSONException {
            JSONObject o=new JSONObject();
            o.put("name",name);
            o.put("time",mtime/1000);
            o.put("canDelete",true);
            return o;
        }
    }

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
    private static SimpleDateFormat nameFormat =new SimpleDateFormat("yyyy-MM-dd");
    private SimpleDateFormat cmpFormat=new SimpleDateFormat("yyyyMMdd"); //we only need to compare the day

    private boolean writerRunning=false;
    private long trackTime=0; //length of track
    private long trackDistance; //min distance in m
    private long trackInterval; //interval for writing out the xml file
    private long trackMintime; //min interval between 2 points
    private long lastTrackWrite=0;
    private boolean trackLoading=true;
    private long lastTrackCount=0;

    private ArrayList<Location> trackpoints=new ArrayList<Location>();

    /**
     * a class for asynchronously loading the tracks
     * this honors the load sequence to avoid overwriting data from
     * a new load that has been started by a restarted service
     */
    private class LoadRunner implements Runnable{

        LoadRunner(){
        }

        @Override
        public void run() {
            try {
                ArrayList<Location> filetp = new ArrayList<Location>();
                //read the track data from today and yesterday
                //we rely on the cleanup to handle outdated entries
                long mintime = System.currentTimeMillis() - trackTime;
                Date dt = new Date();
                ArrayList<Location> rt = parseTrackFile(new Date(dt.getTime() - 24 * 60 * 60 * 1000), mintime, trackDistance);
                filetp.addAll(rt);
                rt = parseTrackFile(dt, mintime, trackDistance);
                filetp.addAll(rt);
                synchronized (TrackWriter.this) {
                        lastTrackWrite = dt.getTime();
                        if (rt.size() == 0) {
                            //empty track file - trigger write very soon
                            lastTrackWrite = 0;
                        }
                        ArrayList<Location> newTp = trackpoints;
                        trackpoints = filetp;
                        trackpoints.addAll(newTp);
                    }

            }catch (Exception e){
                AvnLog.e("error loading tracks",e);
            }
            AvnLog.d(LOGPRFX, "read " + trackpoints.size() + " trackpoints from files");
            trackLoading=false;
        }
    }

    TrackWriter(File trackdir,long trackTime,long trackDistance,long trackMintime,long trackInterval){
        this.trackdir=trackdir;
        this.trackTime=trackTime;
        this.trackDistance=trackDistance;
        this.trackMintime=trackMintime;
        this.trackInterval=trackInterval;
        Thread loader=new Thread(new LoadRunner());
        loader.start();

    }

    /**
     * called by the gps service with a new location
     * @param currentLocation
     * @param mediaUpdater
     */
    public synchronized void checkWrite(Location currentLocation, IMediaUpdater mediaUpdater) {
        if (trackLoading) return;
        boolean writeOut = false;
        long current = System.currentTimeMillis();
        synchronized (this) {
            if (currentLocation != null) {
                boolean add = false;
                //check if distance is reached
                float distance = 0;
                if (trackpoints.size() > 0) {
                    Location last = trackpoints.get(trackpoints.size() - 1);
                    distance = last.distanceTo(currentLocation);
                    if (distance >= trackDistance) {
                        add = true;

                    }
                } else {
                    add = true;
                }
                if (add) {
                    AvnLog.d(LOGPRFX, "add location to track logNmea " + currentLocation.getLatitude() + "," + currentLocation.getLongitude() + ", distance=" + distance);
                    Location nloc = new Location(currentLocation);
                    nloc.setTime(current);
                    trackpoints.add(nloc);
                }
            }
            //now check if we should write out
            if (current > (lastTrackWrite + trackInterval) && trackpoints.size() != lastTrackCount) {
                AvnLog.d(LOGPRFX, "start writing track");
                //cleanup
                int deleted = 0;
                long deleteTime = current - trackTime;
                cleanup(trackpoints, deleteTime);
                writeOut = true;
            }
        }
        if (writeOut) {
            List<Location> w = getTrackPoints(true);
            lastTrackCount = w.size();
            lastTrackWrite = current;
            try {
                //we have to be careful to get a copy when having a lock
                writeTrackFile(w, new Date(current), true, mediaUpdater);
            } catch (IOException io) {

            }

        }
    }

    public void writeSync(IMediaUpdater mediaUpdater) throws FileNotFoundException{
        if (trackpoints.size() < 1) return;
        writeTrackFile(getTrackPoints(true),new Date(),false,mediaUpdater);
    }

    public JSONObject getTrackStatus() throws JSONException {
        JSONArray rt = new JSONArray();
        JSONObject item=new JSONObject();
        item.put("name","Writer");
        if (lastTrackWrite != 0){
            item.put("info",trackpoints.size()+" points, writing to "+getTrackFile(new Date(lastTrackWrite)).getAbsolutePath());
            item.put("status",GpsDataProvider.STATUS_NMEA);
        }
        else {
            item.put("info","waiting");
            item.put("status",GpsDataProvider.STATUS_INACTIVE);
        }
        rt.put(item);
        JSONObject out = new JSONObject();
        out.put("name", "TrackWriter");
        out.put("items", rt);
        return out;
    }

    public synchronized List<Location> getTrackPoints(boolean doCopy){
        if (trackLoading) return new ArrayList<Location>();
        if (! doCopy) return trackpoints;
        else return new ArrayList<Location>(trackpoints);
    }

    public synchronized  void clearTrack(){
        trackpoints.clear();
    }
    public static String getCurrentTrackname(Date dt){
        String rt= nameFormat.format(dt);
        return rt;
    }

    public File getTrackFile(Date dt){
        String name = getCurrentTrackname(dt);
        File ofile = new File(trackdir, name + ".gpx");
        return ofile;
    }

    private class WriteRunner implements  Runnable{
        private List<Location> track;
        private Date dt;
        private TrackWriter writer;
        private IMediaUpdater updater;
        WriteRunner(List<Location> track, Date dt, TrackWriter writer, IMediaUpdater updater){
            this.track=track;
            this.dt=dt;
            this.writer=writer;
            this.updater=updater;
        }
        @Override
        public void run() {

            try {
                String name = getCurrentTrackname(dt);
                File ofile = getTrackFile(dt);
                AvnLog.i(LOGPRFX, "writing trackfile " + ofile.getAbsolutePath());
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
                if (updater != null){
                    updater.triggerUpdateMtp(ofile);
                }
                AvnLog.i(LOGPRFX,"writing track finished with "+numpoints+" points");
            } catch (Exception io) {
                Log.e(LOGPRFX, "error writing trackfile: " + io.getLocalizedMessage());
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
    public void writeTrackFile(List<Location> track, Date dt,boolean background, IMediaUpdater updater) throws FileNotFoundException {
        if (background) {
            if (writerRunning) return; //we will come back anyway...
            writerRunning=true;
            Thread t = new Thread(new WriteRunner(track, dt, this,updater));
            t.start();
            return;
        }
        try {
            while (writerRunning) {
                Log.w(LOGPRFX, "writer still running when trying sync write");
                Thread.sleep(100);
            }
            writerRunning=true;
            new WriteRunner(track,dt,this,updater).run();
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
            AvnLog.d(LOGPRFX, "unable to read trackfile " + infile.getName());
            return rt;
        }
        InputStream in_s = null;
        try {
            in_s = new FileInputStream(infile);

            rt=new TrackParser().parseTrackFile(in_s,mintime, minDistance);
            in_s.close();
        } catch (Exception e) {
            Log.e(LOGPRFX,"unexpected error while opening trackfile "+e);
            return rt;
        }
        AvnLog.d(LOGPRFX,"read trackfile "+infile+" with "+rt.size()+" trackpoints");
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
                                    AvnLog.d(LOGPRFX,"exception parsing track date "+v+": "+e.getLocalizedMessage());
                                }
                            } else if (name.equalsIgnoreCase("course")) {
                                try {
                                    v = parser.nextText();
                                    currentLocation.setBearing(Float.parseFloat(v));
                                }catch (Exception e){
                                    AvnLog.d(LOGPRFX,"exception parsing bearing "+v+": "+e.getLocalizedMessage());
                                }
                            } else if (name.equalsIgnoreCase("speed")) {
                                try {
                                    v = parser.nextText();
                                    currentLocation.setSpeed(Float.parseFloat(v));
                                }catch (Exception e){
                                    AvnLog.d(LOGPRFX,"exception parsing speed "+v+": "+e.getLocalizedMessage());
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
    public int cleanup(ArrayList<Location> trackpoints,long deleteTime){
        int deleted=0;
        AvnLog.d(LOGPRFX, "deleting trackpoints older " + new Date(deleteTime).toString());
        while (trackpoints.size() > 0) {
            Location first = trackpoints.get(0);
            if (first.getTime() < deleteTime) {
                trackpoints.remove(0);
                deleted++;
            } else break;
        }
        AvnLog.d(LOGPRFX, "deleted " + deleted + " trackpoints");
        return deleted;
    }

    public ArrayList<TrackInfo> listTracks(){
        ArrayList<TrackInfo> rt=new ArrayList<TrackInfo>();
        for (File f: trackdir.listFiles()){
            if (! f.isFile()) continue;
            if(! f.getName().endsWith(".gpx") && ! f.getName().endsWith(".nmea")) continue;
            TrackInfo e=new TrackInfo();
            e.name=f.getName();
            e.mtime=f.lastModified();
            rt.add(e);
        }
        return rt;
    }


}
