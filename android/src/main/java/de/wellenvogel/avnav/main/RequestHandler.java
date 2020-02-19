package de.wellenvogel.avnav.main;

import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.Resources;
import android.location.Location;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.support.v4.content.FileProvider;
import android.support.v4.provider.DocumentFile;
import android.util.Log;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.WebResourceResponse;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.SocketException;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Map;

import de.wellenvogel.avnav.gemf.GemfChart;
import de.wellenvogel.avnav.gemf.GemfHandler;
import de.wellenvogel.avnav.gemf.GemfReader;
import de.wellenvogel.avnav.gps.Alarm;
import de.wellenvogel.avnav.gps.GpsDataProvider;
import de.wellenvogel.avnav.gps.GpsService;
import de.wellenvogel.avnav.gps.RouteHandler;
import de.wellenvogel.avnav.settings.AudioEditTextPreference;
import de.wellenvogel.avnav.util.AssetsProvider;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.util.LayoutHandler;

/**
 * Created by andreas on 22.11.15.
 */
public class RequestHandler {
    public static final String URLPREFIX="file://android_asset/";
    public static final String USERPREFIX="user/";
    public static final long ROUTE_MAX_SIZE=100000; //see avnav_router.py
    public static final long FILE_MAX_SIZE=1000000; //for file uploads
    protected static final String NAVURL="viewer/avnav_navi.php";
    private static final String DEMOCHARTS="demo"; //urls will start with CHARTPREFIX/DEMOCHARTS
    private static final String OVERVIEW="avnav.xml"; //request for chart overview
    private SimpleDateFormat dateFormat=new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSSZ");
    private MainActivity activity;
    protected JavaScriptApi mJavaScriptApi=new JavaScriptApi();
    private HashMap<String,String> ownMimeMap=new HashMap<String, String>();
    private MimeTypeMap mime = MimeTypeMap.getSingleton();
    private final Object handlerMonitor =new Object();
    private IMediaUpdater updater=null;

    private Thread chartHandler=null;
    private boolean chartHandlerRunning=false;
    private final Object chartHandlerMonitor=new Object();

    private GemfReader gemfReader;
    private LayoutHandler layoutHandler;
    private UploadData uploadData=null;

    public static class ServerInfo{
        public InetSocketAddress address;
        boolean listenAny=false;
        String lastError=null;
    }

    static class UploadData{
        int id;
        String name;
        String fileData;
        public UploadData(int id){
            this.id=id;
        }
        boolean isReady(int id){
            if (id != this.id) return false;
            if (name == null || fileData == null) return false;
            return true;
        }
    }

    static interface LazyHandlerAccess{
        INavRequestHandler getHandler();
    }

    private HashMap<String,LazyHandlerAccess> handlerMap=new HashMap<>();

    RequestHandler(MainActivity activity){
        this.activity=activity;
        this.updater=activity;
        this.gemfReader=new GemfReader(activity);
        ownMimeMap.put("js", "text/javascript");
        startHandler();
        layoutHandler=new LayoutHandler(activity,"viewer/layout",
                new File(getWorkDir(),"layout"));
        handlerMap.put("layout", new LazyHandlerAccess() {
            @Override
            public INavRequestHandler getHandler() {
                return layoutHandler;
            }
        });
        handlerMap.put("route", new LazyHandlerAccess() {
            @Override
            public INavRequestHandler getHandler() {
                return getRouteHandler();
            }
        });
        handlerMap.put("track", new LazyHandlerAccess() {
            @Override
            public INavRequestHandler getHandler() {
                return getTrackWriter();
            }
        });
        handlerMap.put("chart", new LazyHandlerAccess() {
            @Override
            public INavRequestHandler getHandler() {
                return gemfReader;
            }
        });
    }

    private INavRequestHandler getTrackWriter() {
        GpsService gps=getGpsService();
        if (gps == null) return null;
        return gps.getTrackWriter();
    }

    private INavRequestHandler getHandler(String type){
        if (type == null) return null;
        LazyHandlerAccess access=handlerMap.get(type);
        if (access == null) return null;
        return access.getHandler();
    }

    void startHandler(){
        synchronized (handlerMonitor) {
            if (chartHandler == null) {
                chartHandlerRunning=true;
                chartHandler = new Thread(new Runnable() {
                    @Override
                    public void run() {
                        AvnLog.i("RequestHandler: chartHandler thread is starting");
                        while (chartHandlerRunning) {
                            gemfReader.updateChartList();
                            try {
                                synchronized (chartHandlerMonitor){
                                    chartHandlerMonitor.wait(5000);
                                }
                            } catch (InterruptedException e) {
                                break;
                            }
                        }
                        AvnLog.i("RequestHandler: chartHandler thread is stopping");
                    }
                });
                chartHandler.setDaemon(true);
                chartHandler.start();
            }
        }

    }
    private RouteHandler getRouteHandler(){
        return getGpsService().getRouteHandler();
    }

    private File getWorkDir(){
        return AvnUtil.getWorkDir(getSharedPreferences(),activity);
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

    WebResourceResponse handleUserRequest(String url){
        if (! url.startsWith(USERPREFIX)) return null;
        url=url.substring((USERPREFIX.length())).replaceAll("\\?.*","");
        String[] parts=url.split("/");
        if (parts.length < 1) return null;
        File path=new File(getWorkDir(),"user");
        boolean dirOk=path.isDirectory();
        for (int i=0;(i<parts.length-1) && dirOk;i++){
            path=new File(path,parts[i]);
            if (! path.isDirectory() || (parts[i].equals(".."))) {
                dirOk=false;
                break;
            }
        }
        if (dirOk) {
            path = new File(path, parts[parts.length - 1]);
            if (!path.isFile() || !path.canRead()) dirOk=false;
        }
        try {
            if (! dirOk){
                //fallbacks
                String fallback=null;
                if (url.equals("viewer/keys.json")) {
                    fallback = "viewer/layout/keys.json";
                }
                if (fallback != null){
                    InputStream is=activity.assetManager.open(fallback);
                    return new WebResourceResponse(mimeType(fallback),"",is);
                }
                return null;
            }
            return new WebResourceResponse(mimeType(path.getName()),"",new FileInputStream(path));
        } catch (Exception e) {
            AvnLog.e("unable to open file "+url);
        }
        return null;
    }

    WebResourceResponse handleRequest(View view,String url){
        if (url.startsWith(URLPREFIX)){
            try {
                String fname=url.substring(URLPREFIX.length());
                if (fname.startsWith(NAVURL)){
                    return handleNavRequest(url,null);
                }
                if (fname.startsWith(Constants.CHARTPREFIX)){
                    return handleChartRequest(fname);
                }
                if (fname.startsWith(USERPREFIX)){
                    return handleUserRequest(fname);
                }
                InputStream is=activity.assetManager.open(fname.replaceAll("\\?.*",""));
                return new WebResourceResponse(mimeType(fname),"",is);
            } catch (Throwable e) {
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

    JSONObject handleUploadRequest(Uri uri,String postData) throws Exception{
        String dtype = uri.getQueryParameter("type");
        if (dtype == null ) throw new IOException("missing parameter type for upload");
        String ignoreExisting=uri.getQueryParameter("ignoreExisting");
        String name=uri.getQueryParameter("name");
        INavRequestHandler handler=getHandler(dtype);
        if (handler != null){
            boolean success=handler.handleUpload(postData,name,ignoreExisting != null && ignoreExisting.equals("true"));
            JSONObject rt=new JSONObject();
            if (success) {
                rt.put("status", "OK");
            }
            else{
                rt.put("status", "already exists");
            }
            return rt;
        }
        return null;
    }

    ExtendedWebResourceResponse handleNavRequest(String url, String postData){
        return handleNavRequest(url,postData,null);
    }
    ExtendedWebResourceResponse handleNavRequest(String url, String postData,ServerInfo serverInfo){
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
                }
                fout=navLocation;
            }
            if (type.equals("nmeaStatus")){
                handled=true;
                JSONObject o=new JSONObject();
                if (getGpsService() != null) {
                    JSONObject status = getGpsService().getNmeaStatus();
                    o.put("data", status);
                    o.put("status", "OK");
                }
                else{
                    o.put("status","no gps service");
                }
                fout=o;
            }
            if (type.equals("listCharts")){
                handled=true;
                JSONObject out=new JSONObject();
                try {
                    out.put("status", "OK");
                    JSONArray arr = new JSONArray();
                    for (INavRequestHandler.IJsonObect item:gemfReader.handleList()){
                        arr.put(item.toJson());
                    }
                    if (getSharedPreferences().getBoolean(Constants.SHOWDEMO,false)){
                        String demoCharts[]=activity.assetManager.list("charts");
                        for (String demo: demoCharts){
                            if (! demo.endsWith(".xml")) continue;
                            String name=demo.replaceAll("\\.xml$", "");
                            AvnLog.d(Constants.LOGPRFX,"found demo chart "+demo);
                            JSONObject e = new JSONObject();
                            e.put("name", name);
                            e.put("url", "/"+ Constants.CHARTPREFIX+"/"+DEMOCHARTS+"/" + name);
                            e.put("charturl","/"+ Constants.CHARTPREFIX+"/"+DEMOCHARTS+"/" + name);
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
                            try {
                                getRouteHandler().setLeg(legData);
                                getGpsService().timerAction();
                            }catch (Exception e){
                                o.put("status",e.getMessage());
                            }
                        }
                        else{
                            o.put("status","missing leg data");
                        }
                        handled = true;
                    }
                    if (handled) fout = o;
                }
            }
            if (type.equals("listdir") || type.equals("list")){
                String dirtype=uri.getQueryParameter("type");
                INavRequestHandler handler=getHandler(dirtype);
                JSONArray items=new JSONArray();
                if (handler != null){
                    for (INavRequestHandler.IJsonObect item:handler.handleList()){
                        items.put(item.toJson());
                    }
                    handled=true;
                }
                if (handled){
                    JSONObject o=new JSONObject();
                    o.put("status","OK");
                    o.put("items",items);
                    fout=o;
                }

            }
            if (type.equals("download")){
                boolean setAttachment=true;
                String dltype=uri.getQueryParameter("type");
                String name=uri.getQueryParameter("name");
                String noattach=uri.getQueryParameter("noattach");
                if (noattach != null && noattach.equals("true")) setAttachment=false;
                ExtendedWebResourceResponse resp=null;
                INavRequestHandler handler=getHandler(dltype);
                if (handler != null){
                    handled=true;
                    resp=handler.handleDownload(name,uri);
                }
                if (!handled && dltype != null && dltype.equals("alarm") && name != null) {
                    AudioEditTextPreference.AudioInfo info=AudioEditTextPreference.getAudioInfoForAlarmName(name,activity);
                    if (info != null){
                        AudioEditTextPreference.AudioStream stream=AudioEditTextPreference.getAlarmAudioStream(info,activity);
                        if (stream == null){
                            AvnLog.e("unable to get audio stream for "+info.uri.toString());
                        }
                        else {
                            resp = new ExtendedWebResourceResponse((int) stream.len, "audio/mpeg", "", stream.stream);
                        }
                    }
                    else{
                        AvnLog.e("unable to get audio info for "+name);
                    }
                }
                if (resp == null) {
                    byte[] o = ("file " + ((name != null) ? name : "<null>") + " not found").getBytes();
                    resp = new ExtendedWebResourceResponse(o.length, "application/octet-stream", "", new ByteArrayInputStream(o));
                }
                if (setAttachment) resp.setHeader("Content-Disposition", "attachment");
                resp.setHeader("Content-Type",resp.getMimeType());
                return resp;
            }
            if (type.equals("delete")) {
                JSONObject o=new JSONObject();
                String dtype = uri.getQueryParameter("type");
                String name = uri.getQueryParameter("name");
                INavRequestHandler handler=getHandler(dtype);
                if (handler != null){
                    handled=true;
                    boolean deleteOk=handler.handleDelete(name,uri );
                    if (deleteOk){
                        o.put("status","OK");
                    }
                    else{
                        o.put("status","unable to delete");
                    }
                }
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
                if (serverInfo != null){
                    //we are queried from the WebServer - just return all network interfaces
                    JSONObject http=new JSONObject();
                    http.put("name","AVNHttpServer");
                    http.put("configname","AVNHttpServer"); //this is the part the GUI looks for
                    JSONArray status=new JSONArray();
                    JSONObject serverStatus=new JSONObject();
                    serverStatus.put("info","listening on "+serverInfo.address.toString());
                    serverStatus.put("name","HttpServer");
                    serverStatus.put("status", GpsDataProvider.STATUS_NMEA);
                    status.put(serverStatus);
                    JSONObject info=new JSONObject();
                    info.put("items",status);
                    http.put("info",info);
                    JSONObject props=new JSONObject();
                    JSONArray addr=new JSONArray();
                    if (serverInfo.listenAny) {
                        try {
                            Enumeration<NetworkInterface> intfs = NetworkInterface.getNetworkInterfaces();
                            while (intfs.hasMoreElements()) {
                                NetworkInterface intf = intfs.nextElement();
                                Enumeration<InetAddress> ifaddresses = intf.getInetAddresses();
                                while (ifaddresses.hasMoreElements()) {
                                    InetAddress ifaddress = ifaddresses.nextElement();
                                    if (ifaddress.getHostAddress().contains(":"))
                                        continue; //skip IPV6 for now
                                    String ifurl = ifaddress.getHostAddress() + ":" + serverInfo.address.getPort();
                                    addr.put(ifurl);
                                }
                            }
                        } catch (SocketException e1) {
                        }
                    }
                    else{
                        addr.put(serverInfo.address.getAddress().getHostAddress()+":"+serverInfo.address.getPort());
                    }
                    props.put("addresses",addr);
                    http.put("properties",props);
                    items.put(http);

                }
                o.put("handler",items);
                fout=o;
            }
            if (type.equals("alarm")){
                handled=true;
                JSONObject o=null;
                String status=uri.getQueryParameter("status");
                if (status != null && ! status.isEmpty()){
                    JSONObject rt=new JSONObject();
                    if (status.matches(".*all.*")){
                        rt=getGpsService().getAlarStatusJson();
                    }
                    else {
                        Map <String,Alarm> alarmStatus=getGpsService().getAlarmStatus();
                        String[] queryAlarms = status.split(",");
                        for (String alarm:queryAlarms){
                            Alarm ao=alarmStatus.get(alarm);
                            if (ao != null){
                                rt.put(alarm,ao.toJson());
                            }
                        }
                    }
                    o=new JSONObject();
                    o.put("status","OK");
                    o.put("data",rt);
                }
                String stop=uri.getQueryParameter("stop");
                if (stop != null && ! stop.isEmpty()){
                    getGpsService().resetAlarm(stop);
                    o=new JSONObject();
                    o.put("status","OK");
                }
                if (o == null){
                    o=new JSONObject();
                    o.put("status","error");
                    o.put("info","unknown alarm command");
                }
                fout=o;
            }
            if (type.equals("upload")){
                fout=handleUploadRequest(uri,postData);
                if (fout != null) handled=true;
            }
            if (type.equals("capabilities")){
                //see keys.jsx in viewer - gui.capabilities
                handled=true;
                JSONObject o=new JSONObject();
                o.put("addons",false);
                o.put("uploadCharts",false);
                o.put("plugins",false);
                o.put("uploadRoute",true);
                o.put("uploadLayout",true);
                JSONObject response=new JSONObject();
                response.put("status","OK");
                response.put("data",o);
                fout=response;
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
            is=new ByteArrayInputStream(new byte[]{});
            len=0;
        }
        return new ExtendedWebResourceResponse(len,"application/json","UTF-8",is);
    }

    ExtendedWebResourceResponse handleChartRequest(String fname){
        fname=fname.substring(Constants.CHARTPREFIX.length()+1);
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
                    rt=activity.assetManager.open(Constants.CHARTPREFIX+"/"+fname);
                    len=-1;
                }
                else throw new Exception("unable to handle demo request for "+fname);
            }
            if (fname.startsWith(Constants.REALCHARTS)) {
                //the name will be REALCHARTS/index/type/name/param
                //type being either avnav or gemf
                String baseAndUrl[] = fname.split("/", 5);
                if (baseAndUrl.length < 5) throw new Exception("invalid chart request "+fname);
                String key=baseAndUrl[0]+"/"+baseAndUrl[1]+"/"+baseAndUrl[2]+"/"+baseAndUrl[3];
                GemfChart chart= gemfReader.getChartDescription(key);
                if (chart == null) throw new Exception("request a file that is not in the list: "+fname);
                if (baseAndUrl[2].equals("gemf")) {
                    if (baseAndUrl[4].equals(OVERVIEW)) {
                        try {
                            return chart.getOverview();
                        }catch (Exception e){
                            Log.e(Constants.LOGPRFX,"unable to read gemf file "+fname+": "+e.getLocalizedMessage());
                        }
                    } else {
                        GemfHandler f = chart.getGemf();
                        //we have source/z/x/y in baseAndUrl[1]
                        String param[] = baseAndUrl[4].split("/");
                        if (param.length < 4) {
                            throw new Exception("invalid parameter for gemf call " + fname);
                        }
                        int z = Integer.parseInt(param[1]);
                        int x = Integer.parseInt(param[2]);
                        int y = Integer.parseInt(param[3].replaceAll("\\.png", ""));
                        return f.getChartData(x,y,z,Integer.parseInt(param[0]));
                    }
                }
                else if (baseAndUrl[2].equals("avnav")){
                    if (!baseAndUrl[4].equals(OVERVIEW)){
                        throw new Exception("only overview supported for xml files: "+fname);
                    }
                    return chart.getOverview();
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









    private boolean sendFile(String name, String type){
        if (!type.equals("track") && ! type.equals("route") && ! type.equals("layout")){
            Log.e(Constants.LOGPRFX,"invalid type "+type+" for sendFile");
            return false;
        }
        String dirname="tracks";
        if (type.equals("route")) dirname="routes";
        Uri data=null;
        if (type.equals("layout")) {
            data=layoutHandler.getUriForLayout(name);
        }
        else {
            File dir = new File(getWorkDir(), dirname);
            File file = new File(dir, name);
            if (!file.isFile()) {
                Log.e(Constants.LOGPRFX, "file " + name + " not found");
                return false;
            }
            data = FileProvider.getUriForFile(activity, Constants.FILE_PROVIDER_AUTHORITY, file);
        }
        if (data == null) return false;
        Intent shareIntent = new Intent();
        shareIntent.setAction(Intent.ACTION_SEND);
        shareIntent.putExtra(Intent.EXTRA_STREAM, data);
        shareIntent.setFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        if (type.equals("layout")) {
            shareIntent.setType("application/json");
        }
        else{
            shareIntent.setType("application/gpx+xml");
        }
        String title=activity.getText(R.string.selectApp)+" "+name;
        activity.startActivity(Intent.createChooser(shareIntent, title));
        return true;
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
        public boolean downloadFile(String name,String type){
            return sendFile(name,type);
        }

        /**
         * replacement for the missing ability to intercept post requests
         * will only work for small data provided here as a string
         * basically it calls the request handler and returns the status as string
         * @param url
         * @param postvars
         * @return status
         */
        @JavascriptInterface
        public String handleUpload(String url,String postvars){
            try {
                JSONObject rt=handleUploadRequest(Uri.parse(url),postvars);
                return rt.getString("status");
            } catch (Exception e) {
                AvnLog.e("error in upload request for "+url+":",e);
                return e.getMessage();
            }

        }

        /**
         * request a file from the system
         * this is some sort of a workaround for the not really working onOpenFileChooser
         * in the onActivityResult (MainActivity) we store the selected file and its name
         * in the uploadData structure
         * so we limit the size of the file to 1M - this should be ok for our routes, layouts and similar
         * the id is some minimal security to ensure that somenone later on can only access the file
         * when knowing this id
         * the results will be retrieved via getFileName and getFileData
         * a new call to this API will empty/overwrite any older data being retrieved
         * when the file successfully has been fetched, we fire a uploadAvailable event to the JS with the id
         * @param type one of the user data types (route|layout)
         * @param id to identify the file
         */
        @JavascriptInterface
        public void requestFile(String type,int id){
            RequestHandler.this.uploadData=new UploadData(id);
            Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
            intent.setType("*/*");
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            Resources res=getAppResources();
            try {
                activity.startActivityForResult(
                        Intent.createChooser(intent,
                                //TODO: be more flexible for types...
                                res.getText(type.equals("route")?R.string.uploadRoute:R.string.uploadLayout)),
                        Constants.FILE_OPEN);
            } catch (android.content.ActivityNotFoundException ex) {
                // Potentially direct the user to the Market with a Dialog
                Toast.makeText(activity.getApplicationContext(), res.getText(R.string.installFileManager), Toast.LENGTH_SHORT).show();
            }
        }

        @JavascriptInterface
        public String getFileName(int id){
            if (uploadData==null || ! uploadData.isReady(id)) return null;
            return uploadData.name;
        }

        @JavascriptInterface
        public String getFileData(int id){
            if (uploadData==null || ! uploadData.isReady(id)) return null;
            return uploadData.fileData;
        }


        @JavascriptInterface
        public String setLeg(String legData){
            if (getRouteHandler() == null) return returnStatus("not initialized");
            try {
                getRouteHandler().setLeg(legData);
                getGpsService().timerAction();
                return returnStatus("OK");
            } catch (Exception e) {
                AvnLog.i("unable to save leg "+e.getLocalizedMessage());
                return returnStatus(e.getMessage());
            }
        }

        @JavascriptInterface
        public String unsetLeg(){
            if (getRouteHandler() == null) return returnStatus("not initialized");
            try {
                getRouteHandler().unsetLeg();
                getGpsService().timerAction();
                return returnStatus("OK");
            } catch (Exception e) {
                AvnLog.i("unable to unset leg "+e.getLocalizedMessage());
                return returnStatus(e.getMessage());
            }
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
            activity.showSettings(false);
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
        synchronized (handlerMonitor) {
            if (chartHandler != null){
                chartHandlerRunning=false;
                synchronized (chartHandlerMonitor){
                    chartHandlerMonitor.notifyAll();
                }
                chartHandler.interrupt();
                try {
                    chartHandler.join(1000);
                } catch (InterruptedException e) {
                }
                chartHandler=null;
            }
        }
    }

    /**
     * calles when settings changed
     */
    void update() {
        synchronized (chartHandlerMonitor) {
            chartHandlerMonitor.notifyAll();
        }

        startHandler();
    }



    void saveFile(Uri returnUri) {
        try {
            if (uploadData == null) return;
            AvnLog.i("importing route: "+returnUri);
            DocumentFile df=DocumentFile.fromSingleUri(activity,returnUri);
            ParcelFileDescriptor pfd = activity.getContentResolver().openFileDescriptor(returnUri, "r");
            long size=pfd.getStatSize();
            if (size > RequestHandler.FILE_MAX_SIZE) throw new Exception("file to big, allowed "+ RequestHandler.FILE_MAX_SIZE);
            AvnLog.i("saving file "+returnUri.getLastPathSegment());
            byte buffer[]=new byte[(int)(FILE_MAX_SIZE/10)];
            int rd=0;
            StringBuilder data=new StringBuilder();
            InputStream is=new FileInputStream(pfd.getFileDescriptor());
            while ((rd=is.read(buffer)) > 0){
                data.append(new String(buffer,0,rd, StandardCharsets.UTF_8));
            }
            is.close();
            uploadData.name=df.getName();
            uploadData.fileData=data.toString();
            activity.sendEventToJs(Constants.JS_UPLOAD_AVAILABLE, uploadData.id);
        } catch (Throwable e) {
            Toast.makeText(activity.getApplicationContext(), "unable to read file: "+e.getLocalizedMessage(), Toast.LENGTH_LONG).show();
            e.printStackTrace();
            Log.e(Constants.LOGPRFX, "unable to read file: "+e.getLocalizedMessage());
            return;
        }
    }
}
