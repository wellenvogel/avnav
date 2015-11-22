package de.wellenvogel.avnav.gps;

import android.location.Location;
import android.util.Log;
import de.wellenvogel.avnav.main.AvNav;
import de.wellenvogel.avnav.main.IMediaUpdater;
import de.wellenvogel.avnav.main.ISO8601DateParser;
import de.wellenvogel.avnav.util.AvnLog;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.xmlpull.v1.XmlPullParser;
import org.xmlpull.v1.XmlPullParserException;
import org.xmlpull.v1.XmlPullParserFactory;

import java.io.*;
import java.nio.charset.Charset;
import java.text.SimpleDateFormat;
import java.util.*;

/**
 * Created by andreas on 12.12.14.
 */
public class RouteHandler {

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

    private static String escapeXml(String in){
        String rt=in.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;").replace("'","&apos;");
        return rt;
    }

    public static class RouteInfo{
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

        public RouteInfo getInfo(){
            RouteInfo rt=new RouteInfo();
            rt.numpoints=points.size();
            rt.length=computeLength();
            rt.name=new String(name);
            rt.mtime=System.currentTimeMillis();
            return rt;
        }

    };


    private File routedir;
    private HashMap<String,RouteInfo> routeInfos=new HashMap<String, RouteInfo>();
    private boolean stopParser;
    private Object parserLock=new Object();
    private JSONObject currentLeg;


    public RouteHandler(File routedir){
        this.routedir=routedir;
        stopParser=true;
    }

    public void stop(){
        stopParser=true;
        synchronized (parserLock){
            AvnLog.i("stopping parser");
            parserLock.notifyAll();
        }
    }

    public void start() {
        if (! stopParser) return;
        stopParser=false;
        Thread t=new Thread(new DirectoryReader());
        t.start();
    }
    private class DirectoryReader implements  Runnable{
        @Override
        public void run() {
            AvnLog.i("routes directory parser started");
            HashMap<String,RouteInfo> localList=new HashMap<String, RouteInfo>();
            while (true && ! stopParser){
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
                                AvnLog.d("parsed route: " + info.toString());
                            } catch (Exception e) {
                                Log.e(AvnLog.LOGPREFIX, "Exception parsing route " + f.getAbsolutePath() + ": " + e.getLocalizedMessage());
                            }
                        }
                    }
                }
                synchronized (parserLock){
                    routeInfos=localList;
                    try {
                        parserLock.wait(5000);
                    } catch (InterruptedException e) {
                    }
                }
            }
        }
    }

    public Route parseRouteFile(String routeName) {
        Route rt=new Route();
        File infile = new File(routedir,routeName+".gpx");
        if (!infile.isFile()) {
            AvnLog.d("unable to read routefile " + infile.getName());
            return rt;
        }
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

    private class RouteParser {
        private Route route=new Route();
        public Route parseRouteFile(InputStream in){
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
                                    route.name = parser.nextText();
                                }catch (XmlPullParserException i){}
                            }

                        }
                        break;
                    case XmlPullParser.END_TAG:
                        name = parser.getName();
                        if (name.equalsIgnoreCase("gpx")) gpxSeen=false;
                        if (name.equalsIgnoreCase("rte")) rteSeen=false;
                        if (name.equalsIgnoreCase("rtept") && currentRoutePoint != null) {
                            route.points.add(currentRoutePoint);
                            currentRoutePoint=null;
                        }
                }
                eventType = parser.next();
            }
        }


    }

    private void deleteRouteInfo(String name){
        synchronized (parserLock){
            routeInfos.remove(name);
        }
    }
    private void addRouteInfo(Route route){
        synchronized (parserLock){
            routeInfos.put(route.name,route.getInfo());
        }
    }

    public Map<String,RouteInfo> getRouteInfo(){
        synchronized (parserLock) {
            return routeInfos;
        }
    }

    /**
     * save a route
     * @param routeJson - the json string of the route
     * @throws Exception
     */
    public Route saveRoute(String routeJson, boolean overwrite) throws Exception {
        Route rt = Route.fromJson(new JSONObject(routeJson));
        return saveRoute(rt,overwrite);
    }

    /**
     * save a route e.g. received from another app
     * @param is
     * @param overwrite
     * @return
     * @throws Exception
     */
    public Route saveRoute(InputStream is, boolean overwrite) throws Exception{
        AvnLog.i("save route from stream");
        Route rt=new RouteParser().parseRouteFile(is);
        return saveRoute(rt,overwrite);
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

    public JSONObject loadRouteJson(String name) throws Exception {
        File routeFile=new File(routedir,name+".gpx");
        if (! routeFile.isFile()) throw new Exception("route "+name+" not found");
        AvnLog.i("loading route "+name);
        Route rt=new RouteParser().parseRouteFile(new FileInputStream(routeFile));
        return rt.toJson();
    }

    public void deleteRoute(String name){
        File routeFile=new File(routedir,name+".gpx");
        if (! routeFile.isFile()) {
            deleteRouteInfo(name);
            return;
        }
        AvnLog.i("delete route "+name);
        routeFile.delete();
        deleteRouteInfo(name);
    }

    public void setLeg(String data) throws Exception{
        AvnLog.i("setLeg");
        currentLeg=new JSONObject(data);
        File legFile=new File(routedir,LEGFILE);
        FileOutputStream os=new FileOutputStream(legFile);
        os.write(data.getBytes("UTF-8"));
        os.close();
    }

    public JSONObject getLeg() throws Exception{
        if (currentLeg != null) return currentLeg;
        JSONObject rt=new JSONObject();
        File legFile=new File(routedir,LEGFILE);
        if (! legFile.isFile()) {
            rt.put("status","legfile "+legFile.getAbsolutePath()+" not found");
            return rt;
        }
        int maxlegsize=MAXROUTESIZE+2000;
        if (legFile.length() > maxlegsize){
            rt.put("status","legfile "+legFile.getAbsolutePath()+" too big, allowed "+maxlegsize);
            return rt;
        }
        FileInputStream is=new FileInputStream(legFile);
        byte buffer[]=new byte[(int)(legFile.length())];
        int rd=is.read();
        if (rd != legFile.length()){
            rt.put("status","unable to read all bytes for "+legFile.getAbsolutePath());
            return rt;
        }
        try {
            rt=new JSONObject(new String(buffer,"UTF-8"));
        }catch (Exception e){
            rt.put("status","exception while parsing legfile "+legFile.getAbsolutePath()+": "+e.getLocalizedMessage());
            return rt;
        }
        currentLeg=rt;
        return rt;
    }

    public void unsetLeg(){
        AvnLog.i("unset leg");
        File legFile=new File(routedir,LEGFILE);
        if (legFile.isFile()) legFile.delete();
        currentLeg=null;
    }

    public void setMediaUpdater(IMediaUpdater u){
        mediaUpdater=u;
    }



}
