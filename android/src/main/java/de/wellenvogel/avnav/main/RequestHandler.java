package de.wellenvogel.avnav.main;

import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.Resources;
import android.location.Location;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.util.Log;
import android.view.View;
import android.webkit.MimeTypeMap;
import android.webkit.WebResourceResponse;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.xwalk.core.JavascriptInterface;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

import de.wellenvogel.avnav.gps.GpsService;
import de.wellenvogel.avnav.gps.RouteHandler;
import de.wellenvogel.avnav.gps.TrackWriter;
import de.wellenvogel.avnav.util.AvnLog;

/**
 * Created by andreas on 22.11.15.
 */
public class RequestHandler {
    public static final String URLPREFIX="file://android_asset/";
    public static final long ROUTE_MAX_SIZE=100000; //see avnav_router.py
    protected static final String NAVURL="viewer/avnav_navi.php";
    protected static final String CHARTPREFIX="charts";
    private static final String DEMOCHARTS="demo"; //urls will start with CHARTPREFIX/DEMOCHARTS
    private static final String REALCHARTS="charts";
    private static final String OVERVIEW="avnav.xml"; //request for chart overview
    private static final String GEMFEXTENSION =".gemf";
    private SimpleDateFormat dateFormat=new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSSZ");
    private MainActivity activity;
    protected JavaScriptApi mJavaScriptApi=new JavaScriptApi();
    private HashMap<String,String> ownMimeMap=new HashMap<String, String>();
    private MimeTypeMap mime = MimeTypeMap.getSingleton();
    private final Object routeHandlerMonitor=new Object();
    private IMediaUpdater updater=null;
    //routes
    private RouteHandler routeHandler=null;
    //mapping of url name to real filename
    private HashMap<String,String> fileNames=new HashMap<String, String>();
    //gemf files
    private GemfHandler gemfFile= null;

    RequestHandler(MainActivity activity){
        this.activity=activity;
        this.updater=activity;
        ownMimeMap.put("js", "text/javascript");
        startRouteHandler();
    }

    void startRouteHandler(){
        synchronized (routeHandlerMonitor) {
            if (routeHandler != null) {
                routeHandler.stop();
            }
            routeHandler = new RouteHandler(new File(getWorkDir(), "routes"));
            routeHandler.start();
            routeHandler.setMediaUpdater(updater);
        }

    }
    private RouteHandler getRouteHandler(){
        synchronized (routeHandlerMonitor){
            return routeHandler;
        }
    }
    private File getWorkDir(){
        return new File(getSharedPreferences().getString(Constants.WORKDIR,""));
    }
    private GpsService getGpsService(){
        return activity.gpsService;
    }
    SharedPreferences getSharedPreferences(){
        return activity.sharedPrefs;
    }

    public static class ExtendedWebResourceResponse extends WebResourceResponse {
        int length;
        private HashMap<String,String> headers=new HashMap<String, String>();
        public ExtendedWebResourceResponse(int length,String mime,String encoding,InputStream is){
            super(mime,encoding,is);
            this.length=length;
        }
        public int getLength(){
            return length;
        }
        public void setHeader(String name,String value){
            headers.put(name,value);
        }
        public HashMap<String,String> getHeaders() {
            return headers;
        }
    }

    String mimeType(String fname){
        String ext=fname.replaceAll(".*\\.", "");
        String mimeType=mime.getMimeTypeFromExtension(ext);
        if (mimeType == null) {
            mimeType=ownMimeMap.get(ext);
        }
        return mimeType;
    }
    WebResourceResponse handleRequest(View view,String url){
        if (url.startsWith(URLPREFIX)){
            try {
                String fname=url.substring(URLPREFIX.length());
                if (fname.startsWith(NAVURL)){
                    return handleNavRequest(url,null);
                }
                if (fname.startsWith(CHARTPREFIX)){
                    return handleChartRequest(fname);
                }
                InputStream is=activity.assetManager.open(fname);
                return new WebResourceResponse(mimeType(fname),"",is);
            } catch (IOException e) {
                e.printStackTrace();
            }
            return null;
        }
        else {
            AvnLog.d("AvNav", "external request " + url);
            return null;
        }
    }

    String getStartPage(){
        InputStream input;
        String htmlPage=null;
        try {
            input = activity.assetManager.open("viewer/avnav_viewer.html");

            int size = input.available();
            byte[] buffer = new byte[size];
            input.read(buffer);
            input.close();
            // byte buffer into a string
            htmlPage = new String(buffer);

        } catch (IOException e) {
            e.printStackTrace();
        }
        return htmlPage;
    }

    ExtendedWebResourceResponse handleNavRequest(String url, String postData){
        Uri uri= Uri.parse(url);
        String type=uri.getQueryParameter("request");
        if (type == null) type="gps";
        Object fout=null;
        InputStream is=null;
        int len=0;
        boolean handled=false;
        try{
            if (type.equals("gps")){
                handled=true;
                JSONObject navLocation=null;
                if (getGpsService() != null) {
                    navLocation=getGpsService().getGpsData();
                    if (navLocation == null) {
                        navLocation = new JSONObject();
                    }
                    JSONObject nmea = new JSONObject();
                    JSONObject status = getGpsService().getNmeaStatus();
                    nmea.put("status", status);
                    navLocation.put("raw", nmea);

                }
                fout=navLocation;
            }
            if (type.equals("listCharts")){
                handled=true;
                JSONObject out=new JSONObject();
                try {
                    out.put("status", "OK");
                    JSONArray arr = new JSONArray();
                    readAllCharts(arr);
                    if (getSharedPreferences().getBoolean(Constants.SHOWDEMO,false)){
                        String demoCharts[]=activity.assetManager.list("charts");
                        for (String demo: demoCharts){
                            if (! demo.endsWith(".xml")) continue;
                            String name=demo.replaceAll("\\.xml$", "");
                            AvnLog.d(Constants.LOGPRFX,"found demo chart "+demo);
                            JSONObject e = new JSONObject();
                            e.put("name", name);
                            e.put("url", "/"+CHARTPREFIX+"/"+DEMOCHARTS+"/" + name);
                            e.put("charturl","/"+ CHARTPREFIX+"/"+DEMOCHARTS+"/" + name);
                            arr.put(e);
                        }
                    }
                    out.put("data", arr);
                }catch (Exception e){
                    Log.e(Constants.LOGPRFX, "error reading chartlist: " + e.getLocalizedMessage());
                    out.put("status","ERROR");
                    out.put("info",e.getLocalizedMessage());
                }
                fout=out;
            }
            if (type.equals("track")){
                handled=true;
                if (getGpsService() != null) {
                    String intervals = uri.getQueryParameter("interval");
                    String maxnums = uri.getQueryParameter("maxnum");
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
                    ArrayList<Location> track=getGpsService().getTrack(maxnum, interval);
                    //the returned track is inverse order, i.e. the newest entry comes first
                    JSONArray arr=new JSONArray();
                    for (int i=track.size()-1;i>=0;i--){
                        Location l=track.get(i);
                        JSONObject e=new JSONObject();
                        e.put("ts",l.getTime());
                        e.put("time",dateFormat.format(new Date(l.getTime())));
                        e.put("lon",l.getLongitude());
                        e.put("lat",l.getLatitude());
                        arr.put(e);
                    }
                    fout=arr;
                }
            }
            if (type.equals("ais")) {
                handled=true;
                String slat=uri.getQueryParameter("lat");
                String slon=uri.getQueryParameter("lon");
                String sdistance=uri.getQueryParameter("distance");
                double lat=0,lon=0,distance=0;
                try{
                    if (slat != null) lat=Double.parseDouble(slat);
                    if (slon != null) lon=Double.parseDouble(slon);
                    if (sdistance != null)distance=Double.parseDouble(sdistance);
                }catch (Exception e){}
                if (getGpsService() !=null){
                    fout=getGpsService().getAisData(lat, lon, distance);
                }
            }
            if (type.equals("routing")){
                if (getRouteHandler() != null) {
                    JSONObject o = new JSONObject();
                    o.put("status", "OK");
                    String command = uri.getQueryParameter("command");
                    if (command.equals("getleg")){
                        o=getRouteHandler().getLeg();
                        handled=true;
                    }
                    if (command.equals("unsetleg")){
                        getRouteHandler().unsetLeg();
                        handled=true;
                    }
                    if(command.equals("setleg")) {
                        String legData = uri.getQueryParameter("leg");
                        if (legData == null) legData=postData;
                        if (legData != null){
                            getRouteHandler().setLeg(legData);
                        }
                        else{
                            o.put("status","missing leg data");
                        }
                        handled = true;
                    }
                    if(command.equals("deleteroute")) {
                        String name = uri.getQueryParameter("name");
                        handled=true;
                        if (name != null) {
                            getRouteHandler().deleteRoute(name);
                        } else {
                            o.put("status", "missing parameter name");
                        }
                    }
                    if (command.equals("getroute")) {
                        //we directly handle this here...
                        String name = uri.getQueryParameter("name");
                        if (name != null) {
                            try{
                                o=getRouteHandler().loadRouteJson(name);
                            }catch (Exception e){
                                o.put("status",e.getLocalizedMessage());
                            }
                        }
                        handled = true;
                    }
                    if (command.equals("listroutes")) {
                        handled = true;
                        JSONArray a = new JSONArray();
                        Map<String,RouteHandler.RouteInfo> routeInfos=getRouteHandler().getRouteInfo();
                        for (String k:routeInfos.keySet()){
                            a.put(routeInfos.get(k).toJson());
                        }
                        o.put("items", a);
                        fout = o;
                    }
                    if (command.equals("setroute")) {
                        handled = true;
                        if (postData == null) {
                            o.put("status", "no data for setroute");
                        } else {
                            try{
                                getRouteHandler().saveRoute(postData, true);
                            }
                            catch(Exception e){
                                o.put("status",e.getLocalizedMessage());
                            }
                        }
                    }
                    if (handled) fout = o;
                }
            }
            if (type.equals("listdir")){
                String dirtype=uri.getQueryParameter("type");
                JSONArray items=new JSONArray();
                if (dirtype.equals("track")){
                    ArrayList<TrackWriter.TrackInfo> tracks=getGpsService().listTracks();
                    for (TrackWriter.TrackInfo info:tracks){
                        JSONObject e=new JSONObject();
                        e.put("name",info.name);
                        e.put("time",info.mtime/1000);
                        items.put(e);
                    }
                    handled=true;
                }
                if (dirtype.equals("chart")){
                    handled=true;
                    readAllCharts(items);
                }
                if (handled){
                    JSONObject o=new JSONObject();
                    o.put("status","OK");
                    o.put("items",items);
                    fout=o;
                }

            }
            if (type.equals("download")){
                String dltype=uri.getQueryParameter("type");
                String name=uri.getQueryParameter("name");
                ExtendedWebResourceResponse resp=null;
                if (dltype != null && dltype.equals("track") && name != null) {
                    File trackfile = new File(getGpsService().getTrackDir(), name);
                    if (trackfile.isFile()) {
                        resp=new ExtendedWebResourceResponse((int) trackfile.length(), "application/gpx+xml", "", new FileInputStream(trackfile));
                    }
                }
                if (dltype != null && dltype.equals("route") && name != null) {
                    File routefile = new File(new File(getWorkDir(),"routes"), name+".gpx");
                    if (routefile.isFile()) {
                        resp=new ExtendedWebResourceResponse((int) routefile.length(), "application/gpx+xml", "", new FileInputStream(routefile));
                    }
                }
                if (resp == null) {
                    byte[] o = ("file " + ((name != null) ? name : "<null>") + " not found").getBytes();
                    resp = new ExtendedWebResourceResponse(o.length, "application/octet-stream", "", new ByteArrayInputStream(o));
                }
                resp.setHeader("Content-Disposition", "attachment");
                resp.setHeader("Content-Type",resp.getMimeType());
                return resp;
            }
            if (type.equals("delete")) {
                JSONObject o=new JSONObject();
                String dtype = uri.getQueryParameter("type");
                String name = uri.getQueryParameter("name");
                if (dtype == null || (! dtype.equals("track") && ! dtype.equals("chart"))){
                    o.put("status","invalid type");
                }
                if (dtype.equals("track")) {
                    try {
                        getGpsService().deleteTrackFile(name);
                        o.put("status","OK");
                    }catch (Exception e){
                        o.put("status",e.getMessage());
                    }
                }
                if (dtype.equals("chart")) {
                    String charturl=uri.getQueryParameter("url");
                    String realName=fileNames.get(charturl.substring(CHARTPREFIX.length()+2));
                    if (realName == null){
                        o.put("status","chart "+name+" not found");
                    }
                    else {
                        File chartfile=new File(realName);
                        chartfile.delete();
                        if (updater != null) updater.triggerUpdateMtp(chartfile);
                        o.put("status","OK");
                    }
                }
                handled=true;
                fout=o;
            }
            if (type.equals("status")){
                handled=true;
                JSONObject o=new JSONObject();
                JSONArray items=new JSONArray();
                if (getGpsService() != null) {
                    //internal GPS
                    JSONObject gps = new JSONObject();
                    gps.put("name", "GPS");
                    gps.put("info", getGpsService().getStatus());
                    items.put(gps);
                    JSONObject tw=new JSONObject();
                    tw.put("name","TrackWriter");
                    tw.put("info",getGpsService().getTrackStatus());
                    items.put(tw);

                }
                o.put("handler",items);
                fout=o;
            }
            if (!handled){
                AvnLog.d(Constants.LOGPRFX,"unhandled nav request "+type);
            }
            String outstring="";
            if (fout != null) outstring=fout.toString();
            byte o[]=outstring.getBytes("UTF-8");
            len=o.length;
            is = new ByteArrayInputStream(o);
        } catch (Exception e) {
            e.printStackTrace();
        }
        return new ExtendedWebResourceResponse(len,"application/json","UTF-8",is);
    }

    ExtendedWebResourceResponse handleChartRequest(String fname){
        fname=fname.substring(CHARTPREFIX.length()+1);
        InputStream rt=null;
        fname = fname.replaceAll("\\?.*", "");
        String mimeType=mimeType(fname);
        int len=0;
        try {
            if (fname.startsWith(DEMOCHARTS)){
                fname=fname.substring(DEMOCHARTS.length()+1);
                if (fname.endsWith(OVERVIEW)){
                    AvnLog.d(Constants.LOGPRFX,"overview request "+fname);
                    fname=fname.substring(0,fname.length()-OVERVIEW.length()-1); //just the pure name
                    fname+=".xml";
                    closeGemf();
                    rt=activity.assetManager.open(CHARTPREFIX+"/"+fname);
                    len=-1;
                }
                else throw new Exception("unable to handle demo request for "+fname);
            }
            if (fname.startsWith(REALCHARTS)) {
                //the name will be REALCHARTS/index/type/name/param
                //type being either avnav or gemf
                String baseAndUrl[] = fname.split("/", 5);
                if (baseAndUrl.length < 5) throw new Exception("invalid chart request "+fname);
                String key=baseAndUrl[0]+"/"+baseAndUrl[1]+"/"+baseAndUrl[2]+"/"+baseAndUrl[3];
                String realName=fileNames.get(key);
                if (realName == null) throw new Exception("request a file that is not in the list: "+fname);
                if (baseAndUrl[2].equals("gemf")) {
                    if (baseAndUrl[4].equals(OVERVIEW)) {
                        closeGemf();
                        try {
                            GemfHandler f = new GemfHandler(new GEMFFile(new File(realName)),key);
                            rt=f.gemfOverview();
                            len=-1;
                            gemfFile=f;
                        }catch (Exception e){
                            Log.e(Constants.LOGPRFX,"unable to read gemf file "+fname+": "+e.getLocalizedMessage());
                        }
                    }
                    else {
                        if (gemfFile != null){
                            if (!gemfFile.getUrlName().equals(key)){
                                Log.e(AvnLog.LOGPREFIX,"unable to operate multiple gemf files in parallel");
                                throw new Exception("unable to operate multiple gemf files in parallel");
                            }
                            //we have source/z/x/y in baseAndUrl[1]
                            String param[] = baseAndUrl[4].split("/");
                            if (param.length < 4) {
                                throw new Exception("invalid parameter for gemf call " + fname);
                            }
                            mimeType = "image/png";
                            //TODO: handle sources
                            int z = Integer.parseInt(param[1]);
                            int x = Integer.parseInt(param[2]);
                            int y = Integer.parseInt(param[3].replaceAll("\\.png", ""));
                            GEMFFile.GEMFInputStream gs = gemfFile.getInputStream(x, y, z, Integer.parseInt(param[0]));
                            if (gs == null) return null;
                            rt=gs;
                            len=gs.getLength();
                        }
                        else {
                            Log.e(Constants.LOGPRFX, "gemf file " + fname + " not open");
                            return null;
                        }
                    }
                }
                else if (baseAndUrl[2].equals("avnav")){
                    if (!baseAndUrl[4].equals(OVERVIEW)){
                        throw new Exception("only overview supported for xml files: "+fname);
                    }
                    File avnav=new File(realName);
                    if (! avnav.isFile()){
                        Log.e(Constants.LOGPRFX,"invalid query for xml file "+fname);
                    }
                    rt=new FileInputStream(avnav);
                    len=(int)avnav.length();
                }
                else {
                    Log.e(Constants.LOGPRFX,"invalid chart request "+fname);
                }
            }
            if (rt == null){
                Log.e(Constants.LOGPRFX,"unknown chart path "+fname);


            }

            return new ExtendedWebResourceResponse(len,mimeType,"",rt);
        } catch (Exception e) {
            Log.e(Constants.LOGPRFX, "chart file " + fname + " not found: " + e.getLocalizedMessage());
        }
        return null;
    }

    private void readAllCharts(JSONArray arr){
        closeGemf();
        fileNames.clear();
        //here we will have more dirs in the future...
        File chartDir = new File(getWorkDir(), "charts");
        readChartDir(chartDir,"1",arr);
        String secondChartDirStr=getSharedPreferences().getString(Constants.CHARTDIR,"");
        if (! secondChartDirStr.isEmpty()){
            File secondChartDir=new File(secondChartDirStr);
            if (! secondChartDir.equals(chartDir)){
                readChartDir(secondChartDir,"2",arr);
            }
        }
        return;
    }

    private void readChartDir(File chartDir,String index,JSONArray arr) {
        if (! chartDir.isDirectory()) return;
        for (File f : chartDir.listFiles()) {
            try {
                if (f.getName().endsWith(GEMFEXTENSION)){
                    String gemfName = f.getName();
                    gemfName = gemfName.substring(0, gemfName.length() - GEMFEXTENSION.length());
                    JSONObject e = new JSONObject();
                    e.put("name", gemfName);
                    e.put("time",f.lastModified()/1000);
                    String urlName=REALCHARTS + "/"+index+"/gemf/" + gemfName;
                    fileNames.put(urlName,f.getAbsolutePath());
                    AvnLog.d(Constants.LOGPRFX,"readCharts: adding url "+urlName+" for "+f.getAbsolutePath());
                    e.put("url", "/"+CHARTPREFIX + "/" +urlName);
                    arr.put(e);
                }
                if (f.getName().endsWith(".xml")){
                    String name=f.getName().substring(0,f.getName().length()-".xml".length());
                    JSONObject e=new JSONObject();
                    e.put("name",name);
                    e.put("time",f.lastModified()/1000);
                    String urlName=REALCHARTS+"/"+index+"/avnav/"+name;
                    fileNames.put(urlName,f.getAbsolutePath());
                    AvnLog.d(Constants.LOGPRFX,"readCharts: adding url "+urlName+" for "+f.getAbsolutePath());
                    e.put("url","/"+CHARTPREFIX+"/"+urlName);
                    arr.put(e);
                }
            } catch (Exception e) {
                Log.e(Constants.LOGPRFX, "exception handling file " + f.getAbsolutePath());
            }
        }
    }

    private void closeGemf(){
        if (gemfFile != null) {
            AvnLog.d(Constants.LOGPRFX,"closing gemf file "+gemfFile.getUrlName());
            gemfFile.close();
        }
        gemfFile=null;
    }

    private void sendFile(String name, String type,Resources res){
        if (!type.equals("track") && ! type.equals("route")){
            Log.e(Constants.LOGPRFX,"invalid type "+type+" for sendFile");
            return;
        }
        String dirname="tracks";
        if (type.equals("route")) dirname="routes";
        File dir=new File(getWorkDir(),dirname);
        File file=new File(dir,name);
        if (! file.isFile()){
            Log.e(Constants.LOGPRFX,"file "+name+" not found");
            return;
        }
        Uri data=Uri.fromFile(file);
        Intent shareIntent = new Intent();
        shareIntent.setAction(Intent.ACTION_SEND);
        shareIntent.putExtra(Intent.EXTRA_STREAM, data);
        shareIntent.setType("application/gpx+xml");
        String title=res.getText(R.string.selectApp)+" "+name;
        activity.startActivity(Intent.createChooser(shareIntent, title));
    }

    //potentially the Javascript interface code is called from the Xwalk app package
    //so we have to be careful to always access the correct resource manager when accessing resources!
    //to make this visible we pass a resource manager to functions called from here that open dialogs
    protected class JavaScriptApi{
        private String returnStatus(String status){
            JSONObject o=new JSONObject();
            try {
                o.put("status", status);
            }catch (JSONException i){}
            return o.toString();
        }
        private Resources getAppResources() {
            Resources rt = null;
            rt = activity.getResources();
            return rt;
        }
        @JavascriptInterface
        public String storeRoute(String route){
            AvnLog.i("store route");
            if (getRouteHandler() == null) return returnStatus("no route handler");
            try{
                getRouteHandler().saveRoute(route, true);
                return returnStatus("OK");
            }catch (Exception e){
                Log.e(AvnLog.LOGPREFIX,"error while storing route: "+e.getLocalizedMessage());
                return returnStatus(e.getLocalizedMessage());
            }
        }
        @JavascriptInterface
        public void downloadRoute(String route){
            if (getRouteHandler() == null){
                Log.e(AvnLog.LOGPREFIX," no route handler for downloadRoute");
            }
            try {
                RouteHandler.Route rt=getRouteHandler().saveRoute(route, true);
                sendFile(rt.name + ".gpx", "route", getAppResources());
            }catch(Exception e){
                Toast.makeText(activity.getApplicationContext(), e.getLocalizedMessage(), Toast.LENGTH_SHORT).show();
            }
        }

        @JavascriptInterface
        public String uploadRoute(){
            Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
            intent.setType("*/*");
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            Resources res=getAppResources();
            try {
                activity.startActivityForResult(
                        Intent.createChooser(intent, res.getText(R.string.uploadRoute)),
                        0);
            } catch (android.content.ActivityNotFoundException ex) {
                // Potentially direct the user to the Market with a Dialog
                Toast.makeText(activity.getApplicationContext(), res.getText(R.string.installFileManager), Toast.LENGTH_SHORT).show();
            }

            return "";

        }

        @JavascriptInterface
        public void downloadTrack(String name){
            sendFile(name,"track",getAppResources());
        }

        @JavascriptInterface
        public void setLeg(String legData){
            if (getRouteHandler() == null) return;
            try {
                getRouteHandler().setLeg(legData);
            } catch (Exception e) {
                AvnLog.i("unable to save leg "+e.getLocalizedMessage());
            }
        }

        @JavascriptInterface
        public void unsetLeg(){
            if (getRouteHandler() == null) return;
            try {
                getRouteHandler().unsetLeg();
            } catch (Exception e) {
                AvnLog.i("unable to unset leg "+e.getLocalizedMessage());
            }
        }

        @JavascriptInterface
        public String getLeg(){
            if (getRouteHandler() == null) return "";
            try {
                return getRouteHandler().getLeg().toString();
            } catch (Exception e) {
                AvnLog.i("unable to get leg "+e.getLocalizedMessage());
            }
            return "";
        }
        @JavascriptInterface
        public void goBack(){
            activity.backHandler.sendEmptyMessage(1);
        }

        @JavascriptInterface
        public void acceptEvent(String key,int num){
            if (key != null && key.equals("backPressed")) activity.goBackSequence=num;
        }

        @JavascriptInterface
        public void showSettings(){
            activity.showSettings();
        }

        @JavascriptInterface
        public void applicationStarted(){
            getSharedPreferences().edit().putBoolean(Constants.WAITSTART,false).commit();
        }
        @JavascriptInterface
        public void externalLink(String url){
            Intent goDownload = new Intent(Intent.ACTION_VIEW);
            goDownload.setData(Uri.parse(url));
            try {
                activity.startActivity(goDownload);
            } catch (Exception e) {
                Toast.makeText(activity, e.getLocalizedMessage(), Toast.LENGTH_LONG).show();
                return;
            }
        }
        @JavascriptInterface
        public String getVersion(){
            try {
                String versionName = activity.getPackageManager()
                        .getPackageInfo(activity.getPackageName(), 0).versionName;
                return versionName;
            } catch (PackageManager.NameNotFoundException e) {
                return "<unknown>";
            }
        }

    };

    void stop(){
        synchronized (routeHandlerMonitor) {
            if (routeHandler != null) {
                routeHandler.stop();
            }
        }
    }

    /**
     * calles when settings changed
     */
    void update(){
        startRouteHandler();
    }

    void saveRoute(Uri returnUri) {


        try {
            AvnLog.i("importing route: "+returnUri);
            ParcelFileDescriptor pfd = activity.getContentResolver().openFileDescriptor(returnUri, "r");
            long size=pfd.getStatSize();
            if (size > RequestHandler.ROUTE_MAX_SIZE) throw new Exception("route to big, allowed "+ RequestHandler.ROUTE_MAX_SIZE);
            if (getRouteHandler() == null){
                Log.e(AvnLog.LOGPREFIX,"no route handler for saving route");
                return;
            }
            AvnLog.i("saving route");
            getRouteHandler().saveRoute(new FileInputStream(pfd.getFileDescriptor()), false);
            activity.sendEventToJs("routeImported", 1);
        } catch (Exception e) {
            Toast.makeText(activity.getApplicationContext(), "unable save route: "+e.getLocalizedMessage(), Toast.LENGTH_LONG).show();
            e.printStackTrace();
            Log.e(Constants.LOGPRFX, "unable to save route: "+e.getLocalizedMessage());
            return;
        }
    }
}
