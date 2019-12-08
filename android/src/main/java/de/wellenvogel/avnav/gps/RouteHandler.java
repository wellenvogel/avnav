package de.wellenvogel.avnav.gps;

import android.location.Location;
import android.net.Uri;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.xmlpull.v1.XmlPullParser;
import org.xmlpull.v1.XmlPullParserException;
import org.xmlpull.v1.XmlPullParserFactory;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Date;
import java.util.Formatter;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

import de.wellenvogel.avnav.main.IMediaUpdater;
import de.wellenvogel.avnav.main.INavRequestHandler;
import de.wellenvogel.avnav.main.RequestHandler;
import de.wellenvogel.avnav.util.AvnLog;

/**
 * Created by andreas on 12.12.14.
 */
public class RouteHandler implements INavRequestHandler {

    @Override
    public RequestHandler.ExtendedWebResourceResponse handleDownload(String name, Uri uri) throws Exception {
        String format=uri.getQueryParameter("format");
        String mimemtype="application/gpx+xml";
        //TODO: handle special case when we have a route in the "json" parameter but no route here...
        InputStream is;
        int len=-1;
        if (format != null && format.equals("json")){
            mimemtype="application/json";
            JSONObject jsonRoute=loadRouteJson(name);
            byte routeBytes[]=jsonRoute.toString().getBytes("UTF-8");
            len=routeBytes.length;
            is=new ByteArrayInputStream(routeBytes);
        }
        else{
            File routeFile=openRouteFile(name);
            len=(int)routeFile.length();
            is=new FileInputStream(routeFile);

        }
        return new RequestHandler.ExtendedWebResourceResponse(len,mimemtype,"",is);
    }

    @Override
    public boolean handleUpload(String postData, String name, boolean ignoreExisting) throws Exception {
        Route rt = Route.fromJson(new JSONObject(postData));
        try {
            saveRoute(rt, !ignoreExisting);
        }catch (Exception e){
            AvnLog.e("Exception when storing route",e);
            return false;
        }
        return true;
    }

    @Override
    public Collection<? extends IJsonObect> handleList() throws Exception {
        return getRouteInfo().values();
    }

    @Override
    public boolean handleDelete(String name, Uri uri) throws Exception {
        return deleteRoute(name);
    }

    public static interface UpdateReceiver{
        public void updated();
    }

    private static final String LEGFILE="currentLeg.json";
    private static final int MAXROUTESIZE=500000;
    private static final String header="<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\" ?>\n"+
            "<gpx xmlns=\"http://www.topografix.com/GPX/1/1\" version=\"1.1\" creator=\"avnav\"\n"+
            "xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"\n"+
            "xsi:schemaLocation=\"http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd\">\n"+
            "<rte>\n"+
            "<name>%s</name>\n";
    private static final String footer="</rte>\n"+
            "</gpx>\n";
    private static final String rtpnt="<rtept lat=\"%2.9f\" lon=\"%2.9f\" >%s</rtept>\n";
    private static final String rtpntName="<name>%s</name>";

    private IMediaUpdater mediaUpdater;
    private UpdateReceiver updateReceiver;
    private long startSequence=1;

    private Float lastDistanceToCurrent=null;
    private Float lastDistanceToNext=null;

    private static String escapeXml(String in){
        String rt=in.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;").replace("'","&apos;");
        return rt;
    }

    public static class RouteInfo implements INavRequestHandler.IJsonObect{
        public String name;
        long mtime;
        public int numpoints;
        public double length; //in NM

        public String toString(){
            StringBuilder sb=new StringBuilder();
            sb.append("Route: name=").append(name);
            sb.append(", length=").append(length);
            sb.append(", numpoints=").append(numpoints);
            sb.append(", mtime=").append(new Date(mtime).toLocaleString());
            return sb.toString();
        }
        @Override
        public JSONObject toJson() throws JSONException{
            JSONObject e=new JSONObject();
            e.put("name",name);
            e.put("time",mtime/1000);
            e.put("numpoints",numpoints);
            e.put("length",length);
            return e;
        }

    }

    public static class RoutePoint{
        public String name;
        public double lat;
        public double lon;
        JSONObject toJson() throws JSONException{
            JSONObject rt=new JSONObject();
            rt.put("lat",lat);
            rt.put("lon",lon);
            if (name!=null)rt.put("name",name);
            return rt;
        }
        public static RoutePoint fromJson(JSONObject o) throws JSONException {
            RoutePoint rt = new RoutePoint();
            rt.lat = o.getDouble("lat");
            rt.lon = o.getDouble("lon");
            if (o.opt("name") != null) rt.name = o.getString("name");
            return rt;
        }
        public String toXml(){
            String fname="";
            if (name != null) fname=(new Formatter(Locale.ENGLISH)).format(rtpntName,escapeXml(name)).toString();
            return new Formatter(Locale.ENGLISH).format(rtpnt,lat,lon,fname).toString();
        }
        public Location toLocation(){
            Location rt=new Location((String)null);
            rt.setLatitude(lat);
            rt.setLongitude(lon);
            return rt;
        }

        /**
         * get the distance in m
         * @param other other route point (when 0: distance will be 0)
         * @return the distance in m
         */
        public float distanceTo(Location other){
            if (other == null) return 0;
            Location own=this.toLocation();
            return own.distanceTo(other);
        }
    };

    public static class Route{
        public String name;
        public ArrayList<RoutePoint> points=new ArrayList<RoutePoint>();
        JSONObject toJson() throws JSONException{
            JSONObject rt=new JSONObject();
            rt.put("name",name);
            JSONArray rtpoints=new JSONArray();
            for (RoutePoint p:points){
                rtpoints.put(p.toJson());
            }
            rt.put("points",rtpoints);
            return rt;
        }
        public static Route fromJson(JSONObject o) throws  JSONException{
            Route rt=new Route();
            rt.name=o.getString("name");
            JSONArray pt=o.getJSONArray("points");
            for (int i=0;i<pt.length();i++){
                rt.points.add(RoutePoint.fromJson(pt.getJSONObject(i)));
            }
            return rt;
        }
        public String toXml(){
            String fpoints="";
            for (RoutePoint p:points){
                fpoints+=p.toXml()+"\n";
            }
            return new Formatter(Locale.ENGLISH).format(header,escapeXml(name)).toString()+fpoints+footer;
        }

        public double computeLength(){
            double rt=0;
            if (points.size() < 2) return rt;
            Location last=points.get(0).toLocation();
            for (int i=1;i<points.size();i++){
                Location next=points.get(i).toLocation();
                rt+=next.distanceTo(last)/1852.0;
                last=next;
            }
            return rt;
        }

        public int getNextTarget(int currentTarget){
            if (currentTarget < 0) return -1;
            if (currentTarget >= (points.size()-1)) return -1;
            return currentTarget+1;
        }

        public RouteInfo getInfo(){
            RouteInfo rt=new RouteInfo();
            rt.numpoints=points.size();
            rt.length=computeLength();
            rt.name=new String(name);
            rt.mtime=System.currentTimeMillis();
            return rt;
        }

    };

    public static class RoutingLeg{
        private RoutePoint from;
        private RoutePoint to;
        private Route route;
        private int currentTarget=-1;
        private boolean active=false;
        private double anchorDistance=-1;
        private double approachDistance=-1;
        JSONObject jsonData;

        public RoutePoint getFrom() {
            return from;
        }

        public RoutePoint getTo() {
            return to;
        }

        public Route getRoute() {
            return route;
        }

        public double getAnchorDistance() {
            return anchorDistance;
        }
        public boolean hasAnchorWatch(){
            return (from != null && anchorDistance>=0);
        }
        public RoutingLeg(JSONObject o) throws JSONException {
            if (o.has("from")){
                from=RoutePoint.fromJson(o.getJSONObject("from"));
            }
            else{
                from=null;
            }
            if (o.has("to")){
                to=RoutePoint.fromJson(o.getJSONObject("to"));
            }
            else{
                to=null;
            }
            if (o.has("currentRoute")){
                route=Route.fromJson(o.getJSONObject("currentRoute"));
            }
            else{
                route=null;
            }
            if (o.has("currentTarget")){
                currentTarget=o.getInt("currentTarget");
            }
            else{
                currentTarget=-1;
            }
            if (o.has("approachDistance")){
                approachDistance=o.getDouble("approachDistance");
            }
            else{
                approachDistance=-1;
            }
            if (o.has("anchorDistance")){
                anchorDistance=o.getDouble("anchorDistance");
            }
            else{
                anchorDistance=-1;
            }
            if (o.has("active")){
                active=o.getBoolean("active");
            }
            else{
                active=false;
            }
            jsonData=o;
        }
        JSONObject getJsonData() throws JSONException{
            JSONObject rt=new JSONObject();
            if (from != null) rt.put("from",from.toJson());
            if (to != null) rt.put("to",to.toJson());
            if (route != null) rt.put("currentRoute",route.toJson());
            if (currentTarget > 0) rt.put("currentTarget",currentTarget);
            if (approachDistance > 0) rt.put("approachDistance",approachDistance);
            if (anchorDistance > 0) rt.put("anchorDistance",anchorDistance);
            rt.put("active",active);
            return rt;
        }
        JSONObject toJson() throws JSONException {
            return getJsonData();
        }
    }


    private File routedir;
    private HashMap<String,RouteInfo> routeInfos=new HashMap<String, RouteInfo>();
    private boolean stopParser;
    private Object parserLock=new Object();
    private RoutingLeg currentLeg;


    public RouteHandler(File routedir,UpdateReceiver updater){
        this.routedir=routedir;
        stopParser=true;
        updateReceiver=updater;
    }

    public void stop(){
        stopParser=true;
        synchronized (parserLock){
            AvnLog.i("stopping parser");
            parserLock.notifyAll();
        }
    }

    public void triggerParser(){
        if (stopParser) return;
        AvnLog.i("retrigger parser");
        synchronized (parserLock){
            parserLock.notifyAll();
        }
    }

    public void start() {
        if (! stopParser) return;
        startSequence++;
        stopParser=false;
        try {
            getLeg(); //trigger creation if it does not exist
        } catch (Exception e) {
            AvnLog.e("Exception when initially creating currentLeg",e);
        }
        Thread t=new Thread(new DirectoryReader(startSequence));
        t.start();
    }
    public boolean isStopped(){
        return stopParser;
    }
    private class DirectoryReader implements  Runnable{
        private long sequence;
        public DirectoryReader(long startsequence){
            sequence=startsequence;
        }
        @Override
        public void run() {
            AvnLog.i("routes directory parser started");
            HashMap<String,RouteInfo> localList=new HashMap<String, RouteInfo>();
            while (! stopParser && sequence == startSequence){
                boolean mustUpdate=false;
                if (routedir.isDirectory()) {
                    for (File f : routedir.listFiles()) {
                        if (!f.isFile()) continue;
                        if (!f.getName().endsWith(".gpx")) continue;
                        boolean mustParse = false;
                        String name = f.getName().replaceAll("\\.gpx$", "");
                        if (routeInfos.containsKey(name)) {
                            RouteInfo old = routeInfos.get(name);
                            long currmtime = f.lastModified();
                            if (currmtime == old.mtime) {
                                localList.put(name, old);
                            } else {
                                mustParse = true;
                            }
                        } else {
                            mustParse = true;
                        }
                        if (mustParse) {
                            mustUpdate=true;
                            try {
                                Route rt = new RouteParser().parseRouteFile(new FileInputStream(f));
                                RouteInfo info = rt.getInfo();
                                if (!rt.name.equals(name)) {
                                    //TODO: make this more robust!
                                    throw new Exception("name in route " + rt.name + " does not match route file name");
                                }
                                info.mtime = f.lastModified();
                                localList.put(name, info);
                                AvnLog.d("parsed route: " + info.toString());
                            } catch (Exception e) {
                                Log.e(AvnLog.LOGPREFIX, "Exception parsing route " + f.getAbsolutePath() + ": " + e.getLocalizedMessage());
                            }
                        }
                    }
                }
                synchronized (parserLock){
                    routeInfos=localList;
                    if (mustUpdate){
                        update();
                    }
                    try {
                        parserLock.wait(5000);
                    } catch (InterruptedException e) {
                    }
                }
            }
        }
    }

    public Route parseRouteFile(String routeName) throws Exception{
        Route rt=new Route();
        File infile = openRouteFile(routeName);
        InputStream in_s = null;
        try {
            in_s = new FileInputStream(infile);

            rt=new RouteParser().parseRouteFile(in_s);
            in_s.close();
        } catch (Exception e) {
            Log.e(AvnLog.LOGPREFIX,"unexpected error while parsing routefile "+e);
            return rt;
        }
        AvnLog.d("read routefile "+infile+", name="+rt.name+" with "+rt.points.size()+" points");
        return rt;
    }

    public static Route parseRouteStream(InputStream is,boolean returnEmpty){
        return new RouteParser().parseRouteFile(is,returnEmpty);
    }

    private static class RouteParser {
        private Route route=null;
        public Route parseRouteFile(InputStream in){
            return parseRouteFile(in,true);
        }
        public Route parseRouteFile(InputStream in,boolean returnEmpty){
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
            };
            if (route == null && returnEmpty){
                return new Route();
            }
            return route;
        }

        private Route getRoute(){
            if (route == null) route=new Route();
            return route;
        }

        private void parseXML(XmlPullParser parser) throws XmlPullParserException,IOException {
            int eventType = parser.getEventType();
            RoutePoint currentRoutePoint = null;
            boolean gpxSeen=false;
            boolean rteSeen=false;
            while (eventType != XmlPullParser.END_DOCUMENT) {
                String name = null;
                switch (eventType) {
                    case XmlPullParser.START_TAG:
                        name = parser.getName();
                        if (name.equalsIgnoreCase("gpx")){
                            gpxSeen=true;
                        }
                        if (! gpxSeen) break;
                        if (name.equalsIgnoreCase("rte")){
                            rteSeen=true;
                        }
                        if (! rteSeen) break;
                        if (name.equalsIgnoreCase("rtept")) {
                            currentRoutePoint=new RoutePoint();
                            String lon=parser.getAttributeValue(null,"lon");
                            String lat=parser.getAttributeValue(null,"lat");
                            try{
                                currentRoutePoint.lat=Double.parseDouble(lat);
                                currentRoutePoint.lon=Double.parseDouble(lon);
                            }catch (Exception e){
                                Log.e(AvnLog.LOGPREFIX,"invalid route point - exception while parsing: "+e.getLocalizedMessage());
                                throw new XmlPullParserException("exception while parsing route: "+e.getLocalizedMessage());
                            }
                        }
                        if (name.equalsIgnoreCase("name")) {
                            if (currentRoutePoint != null) {
                                try {
                                    currentRoutePoint.name = parser.nextText();
                                } catch(XmlPullParserException i){}
                            }
                            else {
                                try {
                                    getRoute().name = parser.nextText();
                                }catch (XmlPullParserException i){}
                            }

                        }
                        break;
                    case XmlPullParser.END_TAG:
                        name = parser.getName();
                        if (name.equalsIgnoreCase("gpx")) gpxSeen=false;
                        if (name.equalsIgnoreCase("rte")) rteSeen=false;
                        if (name.equalsIgnoreCase("rtept") && currentRoutePoint != null) {
                            getRoute().points.add(currentRoutePoint);
                            currentRoutePoint=null;
                        }
                }
                eventType = parser.next();
            }
        }


    }
    private void update(){
        if (updateReceiver != null) updateReceiver.updated();
    }

    private void deleteRouteInfo(String name){
        synchronized (parserLock){
            routeInfos.remove(name);
        }
        update();
    }
    private void addRouteInfo(Route route){
        synchronized (parserLock){
            routeInfos.put(route.name,route.getInfo());
        }
        update();
    }

    public Map<String,RouteInfo> getRouteInfo(){
        synchronized (parserLock) {
            return routeInfos;
        }
    }



    private Route saveRoute(Route rt,boolean overwrite ) throws Exception{
        String name=rt.name;
        if (name == null){
            throw new Exception("cannot save route without name");
        }
        File routeFile=new File(routedir,name+".gpx");
        if (! overwrite && routeFile.exists()) throw new Exception("route "+name +" already exists");
        AvnLog.i("saving route "+name);
        FileOutputStream os=new FileOutputStream(routeFile);
        os.write(rt.toXml().getBytes("UTF-8"));
        os.close();
        if (mediaUpdater != null) mediaUpdater.triggerUpdateMtp(routeFile);
        addRouteInfo(rt);
        return rt;
    }

    private File openRouteFile(String name) throws Exception{
        File routeFile=new File(routedir,name+".gpx");
        if (! routeFile.isFile()) throw new Exception("route "+name+" not found");
        return routeFile;
    }

    public JSONObject loadRouteJson(String name) throws Exception {
        File routeFile=openRouteFile(name);
        AvnLog.i("loading route "+name);
        Route rt=new RouteParser().parseRouteFile(new FileInputStream(routeFile));
        return rt.toJson();
    }

    public boolean deleteRoute(String name){
        File routeFile=new File(routedir,name+".gpx");
        if (! routeFile.isFile()) {
            deleteRouteInfo(name);
            return true;
        }
        AvnLog.i("delete route "+name);
        boolean rt=routeFile.delete();
        deleteRouteInfo(name);
        return rt;
    }

    public void setLeg(String data) throws Exception{
        AvnLog.i("setLeg");
        currentLeg =new RoutingLeg(new JSONObject(data));
        saveCurrentLeg();
    }

    private void saveCurrentLeg() throws JSONException, IOException {
        String data=currentLeg.toJson().toString();
        File legFile=new File(routedir,LEGFILE);
        FileOutputStream os=new FileOutputStream(legFile);
        os.write(data.getBytes("UTF-8"));
        os.close();
    }

    public JSONObject getLeg() throws Exception{
        if (currentLeg != null) return currentLeg.getJsonData();
        JSONObject rt=new JSONObject();
        File legFile=new File(routedir,LEGFILE);
        boolean hasError=false;
        if (! legFile.isFile()) {
            rt.put("status","legfile "+legFile.getAbsolutePath()+" not found");
            hasError=true;
        }
        int maxlegsize=MAXROUTESIZE+2000;
        if (! hasError && legFile.length() > maxlegsize){
            rt.put("status","legfile "+legFile.getAbsolutePath()+" too big, allowed "+maxlegsize);
            hasError=true;
        }
        if (! hasError) {
            FileInputStream is = new FileInputStream(legFile);
            byte buffer[] = new byte[(int) (legFile.length())];
            int rd = is.read(buffer);
            if (rd != legFile.length()) {
                rt.put("status", "unable to read all bytes for " + legFile.getAbsolutePath());
                hasError=true;
            }
            if (! hasError) {
                try {
                    rt = new JSONObject(new String(buffer, "UTF-8"));
                } catch (Exception e) {
                    rt.put("status", "exception while parsing legfile " + legFile.getAbsolutePath() + ": " + e.getLocalizedMessage());
                    hasError=true;
                }
            }
        }
        if (hasError){
            currentLeg=new RoutingLeg(new JSONObject());
            rt=currentLeg.toJson();
            saveCurrentLeg();
        }
        else {
            currentLeg = new RoutingLeg(rt);
        }
        return rt;
    }

    public void unsetLeg(){
        AvnLog.i("unset leg");
        File legFile=new File(routedir,LEGFILE);
        if (legFile.isFile()) legFile.delete();
        currentLeg =null;
    }

    private void resetLast(){
        lastDistanceToNext=null;
        lastDistanceToCurrent=null;
    }
    public boolean handleApproach(Location currentPosition){
        RoutingLeg leg=this.currentLeg;
        if (leg == null || ! leg.active ||currentPosition == null ) {
            resetLast();
            return false;
        }
        float currentDistance=leg.to.distanceTo(currentPosition);
        if (currentDistance > leg.approachDistance){
            resetLast();
            return false;
        }
        double tolerance=leg.approachDistance/10; //some tolerance for positions
        int nextIdx=-1;
        if (leg.getRoute() != null) {
            nextIdx=leg.getRoute().getNextTarget(leg.currentTarget);
        }
        float nextDistance=0;
        RoutePoint nextTarget=null;
        if (nextIdx >= 0 ) {
            nextTarget = leg.getRoute().points.get(nextIdx);
            nextDistance = nextTarget.distanceTo(currentPosition);
        }
        if (lastDistanceToCurrent == null || lastDistanceToNext == null){
            //first time..
            lastDistanceToCurrent=currentDistance;
            lastDistanceToNext=nextDistance;
            return true;
        }
        if (currentDistance <= (lastDistanceToCurrent + tolerance)){
            //still approaching wp
            if (currentDistance <= lastDistanceToCurrent) {
                lastDistanceToCurrent = currentDistance;
                lastDistanceToNext = nextDistance;
            }
            return true;
        }
        if (nextIdx >= 0 && (nextDistance > (lastDistanceToNext - tolerance))){
            //still not approaching next wp
            if (nextDistance > lastDistanceToNext) {
                lastDistanceToCurrent = currentDistance;
                lastDistanceToNext = nextDistance;
            }
            return true;
        }
        if (nextTarget == null){
            //switch of routing
            leg.active=false;
        }
        else {
            //switch to next wp
            leg.currentTarget = nextIdx;
            leg.from = leg.to;
            leg.to = nextTarget;
        }
        resetLast();
        try {
            saveCurrentLeg();
        } catch (Exception e) {
            AvnLog.e("error saving current leg ",e);
        }
        return false;
    }

    public RoutePoint getCurrentTarget(){
        if (currentLeg == null) return null;
        if (! currentLeg.active) return null;
        return currentLeg.to;
    }

    public boolean checkAnchor(Location currentPosition){
        RoutingLeg leg=this.currentLeg;
        if (leg == null) return false;
        if (! leg.hasAnchorWatch()) return false;
        if (currentPosition == null) return true; //lost gps
        float distance=leg.from.distanceTo(currentPosition);
        if (distance > leg.anchorDistance) return true;
        return false;
    }
    public boolean anchorWatchActive(){
        RoutingLeg leg=this.currentLeg;
        if (leg == null) {
            try {
                getLeg();
            }catch(Exception e){
                AvnLog.e("unable to read leg: "+e.getMessage());
            }
            leg=this.currentLeg;
            if (leg == null) return false;
        }
        return leg.hasAnchorWatch();
    }

    public void setMediaUpdater(IMediaUpdater u){
        mediaUpdater=u;
    }



}
