package de.wellenvogel.avnav.worker;

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
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Date;
import java.util.Formatter;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

import de.wellenvogel.avnav.appapi.DirectoryRequestHandler;
import de.wellenvogel.avnav.appapi.ExtendedWebResourceResponse;
import de.wellenvogel.avnav.appapi.PostVars;
import de.wellenvogel.avnav.appapi.RequestHandler;
import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.IMediaUpdater;
import de.wellenvogel.avnav.appapi.INavRequestHandler;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;

/**
 * Created by andreas on 12.12.14.
 */
public class RouteHandler extends DirectoryRequestHandler {

    public static interface UpdateReceiver{
        public void updated();
    }

    private static final String LEGFILE="currentLeg.json";
    private static final long MAXROUTESIZE= Constants.MAXFILESIZE;
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
        public boolean canDelete=true;

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
            e.put("name",name+".gpx");
            e.put("time",mtime/1000);
            e.put("numpoints",numpoints);
            e.put("length",length);
            e.put("canDelete",canDelete);
            return e;
        }

        public RouteInfo clone()  {
            RouteInfo rt=new RouteInfo();
            rt.name=name;
            rt.mtime=mtime;
            rt.numpoints=numpoints;
            rt.length=length;
            rt.canDelete=canDelete;
            return rt;
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
        public static String MOBNAME="MOB";
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

        public boolean isMob(){
            if (to == null) return false;
            if ( ! active) return false;
            if (hasAnchorWatch()) return false;
            if (MOBNAME.equals(to.name)) return true;
            return false;
        }
    }


    private File routedir;
    private HashMap<String,RouteInfo> routeInfos=new HashMap<String, RouteInfo>();
    private boolean stopParser;
    private final Object parserLock=new Object();
    private RoutingLeg currentLeg;
    private long legSequence=System.currentTimeMillis();

    public RouteHandler(File routedir,UpdateReceiver updater) throws IOException {
        super(RequestHandler.TYPE_ROUTE,routedir,"route",null);
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
                            try {
                                Route rt = new RouteParser().parseRouteFile(new FileInputStream(f));
                                RouteInfo info = rt.getInfo();
                                if (!rt.name.equals(name)) {
                                    //TODO: make this more robust!
                                    throw new Exception("name in route " + rt.name + " does not match route file name");
                                }
                                info.mtime = f.lastModified();
                                localList.put(name, info);
                                mustUpdate=true;
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
    public Map<String,RouteInfo> getRouteInfo(){
        synchronized (parserLock) {
            return routeInfos;
        }
    }

    @Override
    public boolean handleUpload(PostVars postData, String name, boolean ignoreExisting) throws Exception {
        boolean rt=super.handleUpload(postData, name, ignoreExisting);
        if (rt) triggerParser();
        return rt;
    }

    @Override
    public boolean handleDelete(String name, Uri uri) throws Exception {
        boolean rt=super.handleDelete(name, uri);
        if (rt) deleteRouteInfo(name);
        return rt;
    }

    @Override
    public JSONArray handleList(Uri uri, RequestHandler.ServerInfo serverInfo) throws Exception {
        JSONArray rt=new JSONArray();
        for (RouteInfo i:getRouteInfo().values()){
            RouteInfo iv=i.clone();
            JSONObject info=iv.toJson();
            info.put("url",getUrlFromName(iv.name+".gpx"));
            rt.put(info);
        }
        return rt;
    }

    @Override
    protected JSONObject handleSpecialApiRequest(String command, Uri uri, PostVars postData, RequestHandler.ServerInfo serverInfo) throws Exception {
        if (command.equals("getleg")){
            return getLeg();
        }
        if (command.equals("setleg")){
            setLeg(postData.getAsString());
            return RequestHandler.getReturn();
        }
        return super.handleSpecialApiRequest(command, uri, postData, serverInfo);
    }

    public void setLeg(String data) throws Exception{
        AvnLog.i("setLeg");
        String old=(currentLeg!=null)?currentLeg.toJson().toString():null;
        if (old == null){
            if (data != null) legSequence++;
        }
        else {
            if (!old.equals(data)) {
                legSequence++;
            }
        }
        currentLeg =(data != null)?new RoutingLeg(new JSONObject(data)):null;
        saveCurrentLeg();
    }

    private void saveCurrentLeg() throws JSONException, IOException {
        String data=currentLeg.toJson().toString();
        File legFile=new File(routedir,LEGFILE);
        FileOutputStream os=new FileOutputStream(legFile);
        os.write(data.getBytes(StandardCharsets.UTF_8));
        os.close();
    }

    public JSONObject getLeg() throws Exception{
        if (currentLeg != null) return currentLeg.getJsonData();
        JSONObject rt=new JSONObject();
        File legFile=new File(routedir,LEGFILE);
        boolean hasError=false;
        long maxlegsize=MAXROUTESIZE+2000;
        try{
            rt=AvnUtil.readJsonFile(legFile,maxlegsize);
            currentLeg = new RoutingLeg(rt);
        }
        catch (Exception e){
            AvnLog.e("error reading leg file: ",e);
            currentLeg=new RoutingLeg(new JSONObject());
            rt=currentLeg.toJson();
            saveCurrentLeg();
        }
        return rt;
    }

    public void unsetLeg(){
        AvnLog.i("unset leg");
        File legFile=new File(routedir,LEGFILE);
        if (legFile.isFile()) legFile.delete();
        if (currentLeg != null) legSequence++;
        currentLeg =null;
    }

    public long getLegSequence(){
        return legSequence;
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
        if (leg.isMob()){
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

    public boolean mobActive(){
        if (currentLeg == null) return false;
        return currentLeg.isMob();
    }

    public void setMediaUpdater(IMediaUpdater u){
    }



}
