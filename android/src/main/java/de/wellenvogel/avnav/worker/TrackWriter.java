package de.wellenvogel.avnav.worker;

import android.location.Location;
import android.net.Uri;
import android.os.SystemClock;
import android.util.Log;

import de.wellenvogel.avnav.appapi.DirectoryRequestHandler;
import de.wellenvogel.avnav.appapi.PostVars;
import de.wellenvogel.avnav.appapi.RequestHandler;
import de.wellenvogel.avnav.main.IMediaUpdater;
import de.wellenvogel.avnav.main.ISO8601DateParser;
import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;

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
public class TrackWriter extends DirectoryRequestHandler {
    private static final SimpleDateFormat dateFormat=new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSSZ");

    private final IMediaUpdater updater;
    private long changeSequence= SystemClock.uptimeMillis();

    @Override
    public JSONArray handleList(Uri uri, RequestHandler.ServerInfo serverInfo) throws Exception {

        JSONArray rt = new JSONArray();
        for (File f : trackdir.listFiles()) {
            if (!f.isFile()) continue;
            if (!f.getName().endsWith(".gpx") && !f.getName().endsWith(".nmea")) continue;
            TrackInfo e = new TrackInfo();
            e.name = f.getName();
            e.mtime = f.lastModified();
            e.url=getUrlFromName(e.name);
            rt.put(e.toJson());
        }
        return rt;

    }

    @Override
    public boolean handleDelete(String name, Uri uri) throws Exception {
        boolean rt=super.handleDelete(name,uri);
        if (name.replace(".gpx","").equals(getCurrentTrackname(new Date()))) {
            AvnLog.i("deleting current trackfile");
            trackpoints.clear();
        }
        return rt;
    }


    public static class TrackInfo implements AvnUtil.IJsonObect {
        public String name;
        public long mtime;
        public String url;
        public JSONObject toJson() throws JSONException {
            JSONObject o=new JSONObject();
            o.put("name",name);
            o.put("time",mtime/1000);
            o.put("canDelete",true);
            o.put("url",url);
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
    private long lastTrackWrite=0;
    private boolean trackLoading=true;
    private long lastTrackCount=0;
    static class WriteInfo{
        int numWrites=0;
        int numPoints=0;
        String lastError=null;
        void update(int points,String error){
            if (error == null) numWrites++;
            numPoints=points;
            lastError=error;
        }
        WriteInfo(WriteInfo other){
            numWrites=other.numWrites;
            numPoints=other.numPoints;
            lastError=other.lastError;
        }
        boolean equals(WriteInfo other){
            if (! Objects.equals(other.lastError,lastError)) return false;
            if (other.numPoints != numPoints) return false;
            if (other.numWrites != numWrites) return false;
            return true;
        }
        WriteInfo(){}
    }
    private WriteInfo writeInfo=new WriteInfo();

    private ArrayList<Location> trackpoints=new ArrayList<Location>();
    private static final EditableParameter.IntegerParameter PARAM_INTERVAL=
            new EditableParameter.IntegerParameter("interval", R.string.labelSettingsTrackInterval,300);
    private static final EditableParameter.IntegerParameter PARAM_LENGTH=
            new EditableParameter.IntegerParameter("length", R.string.labelSettingsTrackLength,25);
    private static final EditableParameter.IntegerParameter PARAM_MINTIME=
            new EditableParameter.IntegerParameter("minTime", R.string.labelSettingsTrackMinTime,10);
    private static final EditableParameter.IntegerParameter PARAM_DISTANCE=
            new EditableParameter.IntegerParameter("distance", R.string.labelSettingsTrackMinDist,25);

    private synchronized void updateWriteInfo(int numPoints, String error){
        writeInfo.update(numPoints,error);
    }
    private synchronized WriteInfo getWriteInfo(){
        return new WriteInfo(writeInfo);
    }
    static final String C_WRITES="writes";
    private void setWriteStatus(WriteInfo info){
        if (info.lastError != null){
            status.setChildStatus(C_WRITES, WorkerStatus.Status.ERROR,
                    info.numWrites+" error="+info.lastError);
        }
        else {
            status.setChildStatus(C_WRITES, (info.numWrites > 0) ?
                    WorkerStatus.Status.NMEA :
                    WorkerStatus.Status.STARTED, info.numWrites + " (" + info.numPoints + " points)");
        }

    }

    /**
     *
     * @return
     */
    private ArrayList<Date> getNecessaryDates() throws JSONException {
        ArrayList<Date> rt=new ArrayList<>();
        long mintime = System.currentTimeMillis() - 60*60*1000*(long)PARAM_LENGTH.fromJson(parameters);
        Date dt = new Date();
        while (dt.getTime() >= mintime){
            rt.add(0,dt);
            dt=new Date(dt.getTime()-24*60*60*1000);
        }
        return rt;
    }


    @Override
    public void run(int startSequence) {
        changeSequence = SystemClock.uptimeMillis();
        WriteInfo currentInfo = getWriteInfo();
        WriteInfo lastWriteInfo = new WriteInfo(currentInfo);
        status.setChildStatus("directory", WorkerStatus.Status.NMEA, trackdir.getAbsolutePath());
        setWriteStatus(currentInfo);
        setStatus(WorkerStatus.Status.STARTED, "loading tracks");
        trackLoading=true;
        try {
            ArrayList<Location> filetp = new ArrayList<Location>();
            //read the track data from all necessary dates
            //we rely on the cleanup to handle outdated entries
            long mintime = System.currentTimeMillis() - 60 * 60 * 1000 * (long) PARAM_LENGTH.fromJson(parameters);
            List<Date> necessary = getNecessaryDates();
            for (Date filedate : necessary) {
                status.setChildStatus("loading", WorkerStatus.Status.STARTED, "track file: "+getCurrentTrackname(filedate));
                ArrayList<Location> rt = parseTrackFile(filedate, mintime, PARAM_DISTANCE.fromJson(parameters));
                filetp.addAll(rt);
            }
            synchronized (this) {
                lastTrackWrite = (new Date()).getTime();
                if (filetp.size() == 0) {
                    //empty track file - trigger write very soon
                    lastTrackWrite = 0;
                }
                trackpoints = filetp;
            }
            status.setChildStatus("loading", WorkerStatus.Status.NMEA, "finished with " + trackpoints.size() + " points");

        } catch (Exception e) {
            status.setChildStatus("loading", WorkerStatus.Status.ERROR, "error: " + e.getMessage());
            AvnLog.e("error loading tracks", e);
        }
        AvnLog.d(LOGPRFX, "read " + trackpoints.size() + " trackpoints from files");
        trackLoading = false;
        setStatus(WorkerStatus.Status.STARTED, "waiting for trackpoints");
        while (!shouldStop(startSequence)) {
            sleep(1000);
            WriteInfo info = getWriteInfo();
            if (!lastWriteInfo.equals(info)) {
                status.setChildStatus(C_WRITES, (info.numWrites > 0) ?
                                WorkerStatus.Status.NMEA :
                                WorkerStatus.Status.STARTED,
                        info.numWrites + " (" + info.numPoints + " points)");
                lastWriteInfo = info;
            }
        }
    }

    @Override
    public void stop() {
        super.stop();
        try {
            writeSync(updater);
        } catch (FileNotFoundException e) {
            AvnLog.e("error writing track",e);
        }
    }

    TrackWriter(File trackdir,GpsService ctx) throws IOException {
        super(RequestHandler.TYPE_TRACK,ctx,trackdir,"track",null);
        this.trackdir=trackdir;
        this.updater=ctx.getMediaUpdater();
        parameterDescriptions.addParams(ENABLED_PARAMETER,PARAM_INTERVAL,PARAM_DISTANCE,PARAM_MINTIME,PARAM_LENGTH);
        status.canEdit=true;
    }

    /**
     * called by the gps service with a new location
     * @param currentLocation
     * @param mediaUpdater
     */
    public synchronized void checkWrite(Location currentLocation, IMediaUpdater mediaUpdater) throws JSONException {
        if (trackLoading) return;
        if (isStopped()) return;
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
                    if (distance >= PARAM_DISTANCE.fromJson(parameters)) {
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
            if (current > (lastTrackWrite + (long)PARAM_INTERVAL.fromJson(parameters)*1000) && trackpoints.size() != lastTrackCount) {
                AvnLog.d(LOGPRFX, "start writing track");
                //cleanup
                long deleteTime = current - 1000*60*60*(long)PARAM_LENGTH.fromJson(parameters);
                cleanup(trackpoints, deleteTime);
                writeOut = true;
            }
        }
        setStatus(WorkerStatus.Status.NMEA, trackpoints.size() + " points");
        if (writeOut) {
            List<Location> w = getTrackPoints(true,true);
            lastTrackCount = w.size();
            lastTrackWrite = current;
            try {
                //we have to be careful to get a copy when having a lock
                writeTrackFile(w, new Date(current), true, mediaUpdater);
            } catch (IOException io) {

            }

        }
    }

    private void writeSync(IMediaUpdater mediaUpdater) throws FileNotFoundException{
        if (trackpoints.size() < 1) return;
        writeTrackFile(getTrackPoints(true,true),new Date(),false,mediaUpdater);
    }


    public synchronized List<Location> getTrackPoints(boolean doCopy, boolean force){
        if (! force){
            if (trackLoading || isStopped()) return new ArrayList<Location>();
        }
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

    private File getTrackFile(Date dt){
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
        private class MyOs extends ByteArrayOutputStream{
            public byte[] getBuffer(){return buf;}
        }
        @Override
        public void run() {
            long startSequence=writer.changeSequence;
            String name = getCurrentTrackname(dt);
            File ofile = getTrackFile(dt);
            try {
                AvnLog.i(LOGPRFX, "writing trackfile " + ofile.getAbsolutePath());
                MyOs os=new MyOs();
                PrintStream out = new PrintStream(os);
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
                ByteArrayInputStream is=new ByteArrayInputStream(os.getBuffer(),0,os.size());
                writeAtomic(ofile,is,true);
                if (updater != null){
                    updater.triggerUpdateMtp(ofile);
                }
                AvnLog.i(LOGPRFX,"writing track finished with "+numpoints+" points");
                writer.updateWriteInfo(numpoints,null);
            } catch (Exception io) {
                Log.e(LOGPRFX, "error writing trackfile: " + io.getLocalizedMessage());
                writer.updateWriteInfo(0,io.getMessage());
            }
            if (startSequence != writer.changeSequence){
                //the writer potentially changed or renamed files in between
                //so just delete the file we created and rely on us coming back soon...
                AvnLog.i("trackwriter - must delete after write"+ofile);
                try{
                    if (ofile.exists()){
                        ofile.delete();
                    }
                }catch (Throwable t){}
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
            AvnLog.e("track writer - writer interrupted",e);
            writerRunning=false;
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

    private boolean renameFile(Date dt){
        String baseName=getCurrentTrackname(dt);
        File ofile = new File(trackdir, baseName + ".gpx");
        if (! ofile.exists()) return true;
        try {
            for (int i = 1; i < 1000; i++) {
                File candidate = new File(trackdir, baseName + "-"+ i + ".gpx");
                if (!candidate.exists() || i >= 999) {
                    return ofile.renameTo(candidate);
                }
            }
        }catch (Throwable t){
            AvnLog.e("unable to rename "+ofile,t);
        }
        return false;
    }

    @Override
    protected JSONObject handleSpecialApiRequest(String command, Uri uri, PostVars postData, RequestHandler.ServerInfo serverInfo) throws Exception {
        if (command.equals("getTrackV2")){
            String intervals = uri.getQueryParameter("interval");
            String maxnums = uri.getQueryParameter("maxnum");
            boolean full=uri.getBooleanQueryParameter("full",false);
            long interval = 60000;
            if (intervals != null) {
                try {
                    interval = 1000*Long.parseLong(intervals);
                } catch (NumberFormatException i) {
                }
            }
            int maxnum = 60;
            if (maxnums != null) {
                try {
                    maxnum = Integer.parseInt(maxnums);
                } catch (NumberFormatException i) {
                }
            }

            JSONArray arr=getTrack(maxnum,interval);
            //we need to invert the order...
            JSONArray res=new JSONArray();
            for (int i=arr.length()-1;i>=0;i--){
                res.put(arr.get(i));
            }
            return RequestHandler.getReturn(
                    new AvnUtil.KeyValue<JSONArray>("data",res),
                    new AvnUtil.KeyValue<Long>("sequence",changeSequence),
                    new AvnUtil.KeyValue<Boolean>("full",full),
                    new AvnUtil.KeyValue<Long>("now",System.currentTimeMillis()/1000L)
            );
        }
        else if (command.equals("cleanCurrent")){
            writeSync(updater);
            synchronized (this) {
                this.trackpoints = new ArrayList<>();
                this.changeSequence++;
            }
            for (Date fdate: getNecessaryDates()) {
                this.renameFile(fdate);
            }
            return RequestHandler.getReturn();
        }
        return RequestHandler.getErrorReturn("unknown api request "+command);
    }

    private static void addTrackPoint(JSONArray arr,Location l) throws JSONException {
        JSONObject e=new JSONObject();
        e.put("ts",l.getTime()/1000.0);
        e.put("time",dateFormat.format(new Date(l.getTime())));
        e.put("lon",l.getLongitude());
        e.put("lat",l.getLatitude());
        e.put("course",l.getBearing());
        e.put("speed",l.getSpeed());
        arr.put(e);
    }
    /**
     * get the current track
     * @param maxnum - max number of points (including the newest one)
     * @param interval - min time distance between 2 points
     * @return the track points in inverse order, i.e. the newest is at index 0
     */
    private synchronized  JSONArray getTrack(int maxnum, long interval){
        JSONArray rt=new JSONArray();
        List<Location> trackpoints=getTrackPoints(true,false);
        long currts=-1;
        long num=0;
        try {
            for (int i = trackpoints.size() - 1; i >= 0; i--) {
                Location l = trackpoints.get(i);
                if (currts == -1) {
                    currts = l.getTime();
                    addTrackPoint(rt,l);
                    num++;
                } else {
                    long nts = l.getTime();
                    if ((currts - nts) >= interval || interval == 0) {
                        currts = nts;
                        addTrackPoint(rt,l);
                        num++;
                    }
                }

                if (num >= maxnum) break;
            }
        }catch (Exception e){
            //we are tolerant - if we hit cleanup an do not get the track once, this should be no issue
        }
        AvnLog.d(LOGPRFX,"getTrack returns "+num+" points");
        return rt;
    }
}
