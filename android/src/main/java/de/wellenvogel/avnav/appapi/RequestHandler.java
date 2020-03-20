package de.wellenvogel.avnav.appapi;

import android.content.SharedPreferences;
import android.location.Location;
import android.net.Uri;
import android.util.Log;
import android.view.View;
import android.webkit.MimeTypeMap;
import android.webkit.WebResourceResponse;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.SocketException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Date;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Map;

import de.wellenvogel.avnav.charts.ChartHandler;
import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.MainActivity;
import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.settings.AudioEditTextPreference;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.worker.Alarm;
import de.wellenvogel.avnav.worker.GpsDataProvider;
import de.wellenvogel.avnav.worker.GpsService;
import de.wellenvogel.avnav.worker.RouteHandler;

/**
 * Created by andreas on 22.11.15.
 */
public class RequestHandler {
    public static final String URLPREFIX="file://android_asset/";
    protected static final String NAVURL="viewer/avnav_navi.php";
    private SimpleDateFormat dateFormat=new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSSZ");
    MainActivity activity;
    private SharedPreferences preferences;
    private HashMap<String,String> ownMimeMap=new HashMap<String, String>();
    private MimeTypeMap mime = MimeTypeMap.getSingleton();
    private final Object handlerMonitor =new Object();

    private Thread chartHandler=null;
    private boolean chartHandlerRunning=false;
    private final Object chartHandlerMonitor=new Object();

    private ChartHandler gemfHandler;
    private LayoutHandler layoutHandler;
    private AddonHandler addonHandler;

    //file types from the js side
    public static String TYPE_ROUTE="route";
    public static String TYPE_LAYOUT="layout";
    public static String TYPE_CHART="chart";
    public static String TYPE_TRACK="track";
    public static String TYPE_USER="user";
    public static String TYPE_IMAGE="images";
    public static String TYPE_ADDON="addon";

    public static class KeyValue<VT>{
        String key;
        public VT value;
        public KeyValue(String key, VT v){
            this.key=key;
            this.value=v;
        }
    }


    public static class TypeItemMap<VT> extends HashMap<String, KeyValue<VT>>{
        public TypeItemMap(KeyValue<VT>...list){
            for (KeyValue<VT> i : list){
                put(i.key,i);
            }
        }
    }

    public static TypeItemMap<Integer> typeHeadings=new TypeItemMap<Integer>(
            new KeyValue<Integer>(TYPE_ROUTE, R.string.uploadRoute),
            new KeyValue<Integer>(TYPE_CHART,R.string.uploadChart),
            new KeyValue<Integer>(TYPE_IMAGE,R.string.uploadImage),
            new KeyValue<Integer>(TYPE_USER,R.string.uploadUser),
            new KeyValue<Integer>(TYPE_LAYOUT,R.string.uploadLayout)
    );

    //directories below workdir
    public static TypeItemMap<File> typeDirs=new TypeItemMap<File>(
            new KeyValue<File>(TYPE_ROUTE,new File("routes")),
            new KeyValue<File>(TYPE_CHART,new File("charts")),
            new KeyValue<File>(TYPE_TRACK,new File("tracks")),
            new KeyValue<File>(TYPE_LAYOUT,new File("layout")),
            new KeyValue<File>(TYPE_USER,new File(new File("user"),"viewer")),
            new KeyValue<File>(TYPE_IMAGE,new File(new File("user"),"images"))

    );

    public static class ServerInfo{
        public InetSocketAddress address;
        public boolean listenAny=false;
        public String lastError=null;
    }


    static interface LazyHandlerAccess{
        INavRequestHandler getHandler();
    }

    private HashMap<String,LazyHandlerAccess> handlerMap=new HashMap<>();

    public static JSONObject getReturn(KeyValue ...data) throws JSONException {
        JSONObject rt=new JSONObject();
        Object error=null;
        for (KeyValue kv : data){
            if ("error".equals(kv.key)) error=kv.value;
            else rt.put(kv.key,kv.value);
        }
        rt.put("status",error == null?"OK":error);
        return rt;
    }
    public static JSONObject getErrorReturn(String error,KeyValue ...data) throws JSONException {
        JSONObject rt=new JSONObject();
        rt.put("status",error == null?"OK":error);
        for (KeyValue kv : data){
            if (!"error".equals(kv.key)) rt.put(kv.key,kv.value);
        }
        return rt;
    }



    public RequestHandler(MainActivity activity){
        this.activity=activity;
        this.gemfHandler =new ChartHandler(activity,this);
        this.gemfHandler.updateChartList();
        this.addonHandler= new AddonHandler(activity,this);
        ownMimeMap.put("js", "text/javascript");
        startHandler();
        layoutHandler=new LayoutHandler(activity,"viewer/layout",
                new File(getWorkDir(),typeDirs.get(TYPE_LAYOUT).value.getPath()));
        handlerMap.put(TYPE_LAYOUT, new LazyHandlerAccess() {
            @Override
            public INavRequestHandler getHandler() {
                return layoutHandler;
            }
        });
        handlerMap.put(TYPE_ROUTE, new LazyHandlerAccess() {
            @Override
            public INavRequestHandler getHandler() {
                return getRouteHandler();
            }
        });
        handlerMap.put(TYPE_TRACK, new LazyHandlerAccess() {
            @Override
            public INavRequestHandler getHandler() {
                return getTrackWriter();
            }
        });
        handlerMap.put(TYPE_CHART, new LazyHandlerAccess() {
            @Override
            public INavRequestHandler getHandler() {
                return gemfHandler;
            }
        });
        try{
            final DirectoryRequestHandler userHandler=new UserDirectoryRequestHandler(this,
                    addonHandler);
            handlerMap.put(TYPE_USER, new LazyHandlerAccess() {
                @Override
                public INavRequestHandler getHandler() {
                    return userHandler;
                }
            });
        }catch (Exception e){
            AvnLog.e("unable to create user handler",e);
        }
        try {
            final DirectoryRequestHandler imageHandler=new DirectoryRequestHandler(this, TYPE_IMAGE,
                    typeDirs.get(TYPE_IMAGE).value, "user/images",null);
            handlerMap.put(TYPE_IMAGE, new LazyHandlerAccess() {
                @Override
                public INavRequestHandler getHandler() {
                    return imageHandler;
                }
            });
        }catch(Exception e){
            AvnLog.e("unable to create images handler",e);
        }
        handlerMap.put(TYPE_ADDON, new LazyHandlerAccess() {
            @Override
            public INavRequestHandler getHandler() {
                return addonHandler;
            }
        });

    }

    private INavRequestHandler getTrackWriter() {
        GpsService gps=getGpsService();
        if (gps == null) return null;
        return gps.getTrackWriter();
    }

    INavRequestHandler getHandler(String type){
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
                            gemfHandler.updateChartList();
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
    RouteHandler getRouteHandler(){
        GpsService service=getGpsService();
        if (service == null) return null;
        return service.getRouteHandler();
    }

    protected File getWorkDir(){
        return AvnUtil.getWorkDir(getSharedPreferences(),activity);
    }
    GpsService getGpsService(){
        return activity.getGpsService();
    }
    public synchronized  SharedPreferences getSharedPreferences(){
        if (preferences != null) return preferences;
        preferences=AvnUtil.getSharedPreferences(activity);
        return preferences;
    }

    public String mimeType(String fname){
        String ext=fname.replaceAll(".*\\.", "");
        String mimeType=mime.getMimeTypeFromExtension(ext);
        if (mimeType == null) {
            mimeType=ownMimeMap.get(ext);
        }
        return mimeType;
    }


    public WebResourceResponse handleRequest(View view, String url) throws Exception {
        if (url.startsWith(URLPREFIX)){
            try {
                String fname=url.substring(URLPREFIX.length());
                if (fname.startsWith(NAVURL)){
                    return handleNavRequest(url,null);
                }
                INavRequestHandler handler=getPrefixHandler(fname);
                if (handler != null){
                    return handler.handleDirectRequest(fname);
                }
                InputStream is=activity.getAssets().open(fname.replaceAll("\\?.*",""));
                return new WebResourceResponse(mimeType(fname),"",is);
            } catch (Throwable e) {
                e.printStackTrace();
                throw new Exception("error processing "+url+": "+e.getLocalizedMessage());
            }
        }
        else {
            AvnLog.d("AvNav", "external request " + url);
            return null;
        }
    }

    public String getStartPage(){
        InputStream input;
        String htmlPage=null;
        try {
            input = activity.getAssets().open("viewer/avnav_viewer.html");

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

    JSONObject handleUploadRequest(Uri uri,PostVars postData) throws Exception{
        String dtype = uri.getQueryParameter("type");
        if (dtype == null ) throw new IOException("missing parameter type for upload");
        String overwrite=uri.getQueryParameter("overwrite");
        String name=uri.getQueryParameter("name");
        INavRequestHandler handler=getHandler(dtype);
        if (handler != null){
            boolean success=handler.handleUpload(postData,name,overwrite != null && overwrite.equals("true"));
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

    ExtendedWebResourceResponse handleNavRequest(String url, PostVars postData) throws Exception{
        return handleNavRequest(url,postData,null);
    }
    ExtendedWebResourceResponse handleNavRequest(String url, PostVars postData,ServerInfo serverInfo) throws Exception {
        Uri uri= Uri.parse(url);
        String remain=uri.getPath();
        if (remain != null) {
            remain=remain.substring(Math.min(remain.length(),NAVURL.length()+1));
        }
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
                if (getGpsService() != null && getRouteHandler() != null) {
                    JSONObject o=getRouteHandler().handleApiRequest(uri,postData);
                    if (o != null){
                        handled=true;
                        fout=o;
                    }
                }
            }
            if (type.equals("listdir") || type.equals("list")){
                String dirtype=uri.getQueryParameter("type");
                INavRequestHandler handler=getHandler(dirtype);
                if (handler != null){
                    handled=true;
                    fout=getReturn(new KeyValue<JSONArray>("items",handler.handleList()));
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
                    try {
                        resp = handler.handleDownload(name, uri);
                    }catch (Exception e){
                        AvnLog.e("error in download request "+url,e);
                    }
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
                if (setAttachment) {
                    String value="attachment";
                    if (remain != null && ! remain.isEmpty()) value+="; filename=\""+remain+"\"";
                    resp.setHeader("Content-Disposition", value);
                }
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
                    try {
                        boolean deleteOk = handler.handleDelete(name, uri);
                        if (deleteOk) {
                            o.put("status", "OK");
                        } else {
                            o.put("status", "unable to delete");
                        }
                    }catch (Exception e){
                        o.put("status","error deleting "+name+": "+e.getLocalizedMessage());
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
                    if (getGpsService() != null) {
                        if (status.matches(".*all.*")) {
                            rt = getGpsService().getAlarStatusJson();
                        } else {
                            Map<String, Alarm> alarmStatus = getGpsService().getAlarmStatus();
                            String[] queryAlarms = status.split(",");
                            for (String alarm : queryAlarms) {
                                Alarm ao = alarmStatus.get(alarm);
                                if (ao != null) {
                                    rt.put(alarm, ao.toJson());
                                }
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
                o.put("addons",true);
                o.put("uploadCharts",true);
                o.put("plugins",false);
                o.put("uploadRoute",true);
                o.put("uploadLayout",true);
                o.put("canConnect",true);
                o.put("uploadUser",true);
                o.put("uploadImages",true);
                fout=getReturn(new KeyValue<JSONObject>("data",o));
            }
            if (type.equals("api")){
                try {
                    String apiType = AvnUtil.getMandatoryParameter(uri, "type");
                    RequestHandler.LazyHandlerAccess handler = handlerMap.get(apiType);
                    if (handler == null || handler.getHandler() == null ) throw new Exception("no handler for api request "+apiType);
                    JSONObject resp=handler.getHandler().handleApiRequest(uri,postData);
                    if (resp == null){
                        fout=getErrorReturn("api request returned null");
                    }
                    else{
                        fout=resp;
                    }
                }catch (Throwable t){
                    fout=getErrorReturn("exception: "+t.getLocalizedMessage());
                }

            }
            if (!handled){
                AvnLog.d(Constants.LOGPRFX,"unhandled nav request "+type);
            }
            String outstring="";
            if (fout != null) outstring=fout.toString();
            byte o[]=outstring.getBytes("UTF-8");
            len=o.length;
            is = new ByteArrayInputStream(o);
        } catch (JSONException jse) {
            jse.printStackTrace();
            is=new ByteArrayInputStream(new byte[]{});
            len=0;
        }
        return new ExtendedWebResourceResponse(len,"application/json","UTF-8",is);
    }





    public INavRequestHandler getPrefixHandler(String url){
        if (url == null) return null;
        for (LazyHandlerAccess handler : handlerMap.values()){
            if (handler.getHandler() == null || handler.getHandler().getPrefix() == null) continue;
            if (url.startsWith(handler.getHandler().getPrefix())) return handler.getHandler();
        }
        return null;
    }

    public Collection<INavRequestHandler> getHandlers(){
        ArrayList<INavRequestHandler> rt=new ArrayList<INavRequestHandler>();
        for (LazyHandlerAccess handler : handlerMap.values()){
            if (handler.getHandler() == null ) continue;
            rt.add(handler.getHandler());
        }
        return rt;
    }




    public void stop(){
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



}
