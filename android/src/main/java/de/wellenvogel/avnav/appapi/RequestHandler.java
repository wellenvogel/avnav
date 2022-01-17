package de.wellenvogel.avnav.appapi;

import android.content.SharedPreferences;
import android.location.Location;
import android.net.Uri;
import android.view.View;
import android.webkit.MimeTypeMap;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.UnsupportedEncodingException;
import java.net.InetSocketAddress;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

import de.wellenvogel.avnav.charts.ChartHandler;
import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.settings.AudioEditTextPreference;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.worker.Alarm;
import de.wellenvogel.avnav.worker.GpsService;
import de.wellenvogel.avnav.worker.RouteHandler;

/**
 * Created by andreas on 22.11.15.
 */
public class RequestHandler {
    //we have to use a valid http url instead of a file url for loading our page
    //otherwise we crash the renderer process with ol6 and chrome 86 in debug builds
    /*
    E/chromium: [ERROR:render_process_host_impl.cc(5148)] Terminating render process for bad Mojo message: Received bad user message: Non committable URL passed to BlobURLStore::Register
    E/chromium: [ERROR:bad_message.cc(26)] Terminating renderer for bad IPC message, reason 123
    E/DecorView: mWindow.mActivityCurrentConfig is null
    E/chromium: [ERROR:aw_browser_terminator.cc(123)] Renderer process (9537) crash detected (code -1).
    E/chromium: [ERROR:aw_browser_terminator.cc(89)] Render process (9537) kill (OOM or update) wasn't handed by all associated webviews, killing application.
     */
    public static final String INTERNAL_URL_PREFIX ="http://assets";
    public static final String ROOT_PATH="/viewer";
    protected static final String NAVURL="viewer/avnav_navi.php";
    private SimpleDateFormat dateFormat=new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSSZ");
    GpsService service;
    private SharedPreferences preferences;
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
    public static String TYPE_OVERLAY="overlay";
    public static String TYPE_ADDON="addon";
    public static String TYPE_CONFIG="config";
    public static String TYPE_REMOTE="remotechannel";


    public static class TypeItemMap<VT> extends HashMap<String, AvnUtil.KeyValue<VT>>{
        public TypeItemMap(AvnUtil.KeyValue<VT>...list){
            for (AvnUtil.KeyValue<VT> i : list){
                put(i.key,i);
            }
        }
    }

    public static TypeItemMap<Integer> typeHeadings=new TypeItemMap<Integer>(
            new AvnUtil.KeyValue<Integer>(TYPE_ROUTE, R.string.uploadRoute),
            new AvnUtil.KeyValue<Integer>(TYPE_CHART,R.string.uploadChart),
            new AvnUtil.KeyValue<Integer>(TYPE_IMAGE,R.string.uploadImage),
            new AvnUtil.KeyValue<Integer>(TYPE_USER,R.string.uploadUser),
            new AvnUtil.KeyValue<Integer>(TYPE_LAYOUT,R.string.uploadLayout),
            new AvnUtil.KeyValue<Integer>(TYPE_OVERLAY,R.string.uploadOverlay),
            new AvnUtil.KeyValue<Integer>(TYPE_TRACK,R.string.uploadTrack)
    );

    //directories below workdir
    public static TypeItemMap<File> typeDirs=new TypeItemMap<File>(
            new AvnUtil.KeyValue<File>(TYPE_ROUTE,new File("routes")),
            new AvnUtil.KeyValue<File>(TYPE_CHART,new File("charts")),
            new AvnUtil.KeyValue<File>(TYPE_TRACK,new File("tracks")),
            new AvnUtil.KeyValue<File>(TYPE_LAYOUT,new File("layout")),
            new AvnUtil.KeyValue<File>(TYPE_USER,new File(new File("user"),"viewer")),
            new AvnUtil.KeyValue<File>(TYPE_IMAGE,new File(new File("user"),"images")),
            new AvnUtil.KeyValue<File>(TYPE_OVERLAY,new File("overlays"))

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

    public static JSONObject getReturn(AvnUtil.KeyValue...data) throws JSONException {
        JSONObject rt=new JSONObject();
        Object error=null;
        for (AvnUtil.KeyValue kv : data){
            if ("error".equals(kv.key)) error=kv.value;
            else rt.put(kv.key,kv.value);
        }
        rt.put("status",error == null?"OK":error);
        return rt;
    }
    public static JSONObject getReturn(ArrayList<AvnUtil.KeyValue> data) throws JSONException {
        JSONObject rt=new JSONObject();
        Object error=null;
        for (AvnUtil.KeyValue kv : data){
            if ("error".equals(kv.key)) error=kv.value;
            else rt.put(kv.key,kv.value);
        }
        rt.put("status",error == null?"OK":error);
        return rt;
    }


    public static JSONObject getErrorReturn(String error, AvnUtil.KeyValue...data) throws JSONException {
        JSONObject rt=new JSONObject();
        rt.put("status",error == null?"OK":error);
        for (AvnUtil.KeyValue kv : data){
            if (!"error".equals(kv.key)) rt.put(kv.key,kv.value);
        }
        return rt;
    }

    public File getWorkDirFromType(String type) throws Exception {
        AvnUtil.KeyValue<File> subDir=typeDirs.get(type);
        if (subDir == null) throw new Exception("invalid type "+type);
        return new File(getWorkDir(),subDir.value.getPath());
    }

    public RequestHandler(GpsService service){
        this.service = service;
        this.gemfHandler =new ChartHandler(service,this);
        this.gemfHandler.updateChartList();
        this.addonHandler= new AddonHandler(service,this);
        startHandler();
        layoutHandler=new LayoutHandler(service,"viewer/layout",
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
            final DirectoryRequestHandler userHandler=new UserDirectoryRequestHandler(this,service,
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
            final DirectoryRequestHandler imageHandler=new DirectoryRequestHandler(TYPE_IMAGE,service,
                    getWorkDirFromType(TYPE_IMAGE), "user/images",null);
            handlerMap.put(TYPE_IMAGE, new LazyHandlerAccess() {
                @Override
                public INavRequestHandler getHandler() {
                    return imageHandler;
                }
            });
        }catch(Exception e){
            AvnLog.e("unable to create images handler",e);
        }
        try {
            final DirectoryRequestHandler overlayHandler=new DirectoryRequestHandler(TYPE_OVERLAY,service,
                    getWorkDirFromType(TYPE_OVERLAY), "user/overlays",null);
            handlerMap.put(TYPE_OVERLAY, new LazyHandlerAccess() {
                @Override
                public INavRequestHandler getHandler() {
                    return overlayHandler;
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
        handlerMap.put(TYPE_CONFIG, new LazyHandlerAccess() {
            @Override
            public INavRequestHandler getHandler() {
                return getGpsService();
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
        return AvnUtil.getWorkDir(getSharedPreferences(), service);
    }
    GpsService getGpsService(){
        return service;
    }
    public synchronized  SharedPreferences getSharedPreferences(){
        if (preferences != null) return preferences;
        preferences=AvnUtil.getSharedPreferences(service);
        return preferences;
    }

    public static String mimeType(String fname){
        HashMap<String,String> ownMimeMap=new HashMap<String, String>();
        ownMimeMap.put("js", "text/javascript");
        String ext=fname.replaceAll(".*\\.", "");
        String mimeType=MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        if (mimeType == null) {
            mimeType=ownMimeMap.get(ext);
        }
        return mimeType;
    }

    public ExtendedWebResourceResponse handleRequest(View view, String url) throws Exception {
        return handleRequest(view,url,"GET");
    }

    /**
     * used for the internal requests from our WebView
     * @param view
     * @param url undecoded url
     * @return
     * @throws Exception
     */
    public ExtendedWebResourceResponse handleRequest(View view, String url,String method) throws Exception {
        Uri uri=null;
        try {
            uri = Uri.parse(url);
        }catch (Exception e){
            return null;
        }
        String path=uri.getPath();
        if (path == null) return null;
        if (url.startsWith(INTERNAL_URL_PREFIX)){
            try {
                if (path.startsWith("/")) path=path.substring(1);
                if (path.startsWith(NAVURL)){
                    return handleNavRequest(uri,null);
                }
                ExtendedWebResourceResponse rt=tryDirectRequest(uri,method);
                if (rt != null) return rt;
                InputStream is= service.getAssets().open(path);
                return new ExtendedWebResourceResponse(-1,mimeType(path),"",is);
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

    public ExtendedWebResourceResponse tryDirectRequest(Uri uri,String method) throws Exception {
        String path=uri.getPath();
        if (path == null) return null;
        if (path.startsWith("/")) path=path.substring(1);
        INavRequestHandler handler=getPrefixHandler(path);
        if (handler != null){
            return handler.handleDirectRequest(uri,this, method);
        }
        return null;
    }

    public String getStartPage(){
        InputStream input;
        String htmlPage=null;
        try {
            input = service.getAssets().open("viewer/avnav_viewer.html");

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

    IWebSocketHandler getWebSocketHandler(String path){
        //for now limited to one handler
        //can be extended with the same pattern like for normal handlers
        if (path.startsWith("/"+TYPE_REMOTE)){
            GpsService service=getGpsService();
            if (service != null) return service.getRemoteChannel();
            return null;
        }
        if (path.equals("/viewer/wstest")){
            return new IWebSocketHandler(){
                @Override
                public void onReceive(String msg, IWebSocket socket) {
                    try {
                        socket.send("reply: "+msg);
                    } catch (IOException e) {
                        e.printStackTrace();
                    }
                }

                @Override
                public void onConnect(IWebSocket socket) {
                    AvnLog.ifs("ws connect");
                    try {
                        socket.send("hello");
                    } catch (IOException e) {
                        e.printStackTrace();
                    }
                }

                @Override
                public void onClose(IWebSocket socket) {
                    AvnLog.dfs("ws close");
                }

                @Override
                public void onError(String error, IWebSocket socket) {
                    AvnLog.dfs("ws error %s",error);
                }
            };

        }
        return null;
    }

    ExtendedWebResourceResponse handleNavRequest(Uri uri, PostVars postData) throws Exception{
        return handleNavRequest(uri,postData,null);
    }
    ExtendedWebResourceResponse handleNavRequest(Uri uri, PostVars postData,ServerInfo serverInfo) throws Exception {
        return handleNavRequestInternal(uri,postData,serverInfo).getResponse();
    }
    static class NavResponse{
        private ExtendedWebResourceResponse response;
        private Object jsonResponse;
        NavResponse(Object o){jsonResponse=o;}
        NavResponse(ExtendedWebResourceResponse r){response=r;}
        ExtendedWebResourceResponse getResponse() throws UnsupportedEncodingException {
            if (response != null) return response;
            byte o[]=jsonResponse.toString().getBytes("UTF-8");
            long len=o.length;
            InputStream is = new ByteArrayInputStream(o);
            return new ExtendedWebResourceResponse(len,"application/json","UTF-8",is);
        }
        boolean isJson(){return jsonResponse != null;}
        Object getJson(){return jsonResponse;}
    }
    NavResponse handleNavRequestInternal(Uri uri, PostVars postData,ServerInfo serverInfo) throws Exception {
        if (uri.getPath() == null) return null;
        String remain=uri.getPath();
        if (remain.startsWith("/")) remain=remain.substring(1);
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
                        e.put("ts",l.getTime()/1000.0);
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
            if (type.equals("route")){
                if (getGpsService() != null && getRouteHandler() != null) {
                    JSONObject o=getRouteHandler().handleApiRequest(uri,postData, null);
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
                    fout=getReturn(new AvnUtil.KeyValue<JSONArray>("items",handler.handleList(uri, serverInfo)));
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
                        AvnLog.e("error in download request "+uri.getPath(),e);
                    }
                }
                if (!handled && dltype != null && dltype.equals("alarm") && name != null) {
                    AudioEditTextPreference.AudioInfo info=AudioEditTextPreference.getAudioInfoForAlarmName(name, service);
                    if (info != null){
                        AudioEditTextPreference.AudioStream stream=AudioEditTextPreference.getAlarmAudioStream(info, service);
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
                return new NavResponse(resp);
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
                        if (!"chart".equals(dtype)) {
                            INavRequestHandler chartHandler = getHandler("chart");
                            if (chartHandler != null) {
                                try {
                                    ((ChartHandler) chartHandler).deleteFromOverlays(dtype, name);
                                } catch (Exception e){
                                    AvnLog.e("exception when trying to delete from overlays",e);
                                }
                            }
                        }
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
                    JSONArray gpsStatus=getGpsService().getStatus();
                    for (int i=0;i<gpsStatus.length();i++){
                        items.put(gpsStatus.get(i));
                    }
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
                o.put("uploadOverlays",true);
                o.put("uploadTracks",true);
                o.put("remoteChannel",true);
                o.put("fetchHead",Constants.HAS_HEAD_SUPPORT|| serverInfo != null);
                if (serverInfo == null) {
                    //we can only handle the config stuff internally
                    //as potentially there are permission dialogs
                    o.put("config", true);
                }
                fout=getReturn(new AvnUtil.KeyValue<JSONObject>("data",o));
            }
            if (type.equals("api")){
                try {
                    String apiType = AvnUtil.getMandatoryParameter(uri, "type");
                    RequestHandler.LazyHandlerAccess handler = handlerMap.get(apiType);
                    if (handler == null || handler.getHandler() == null ) throw new Exception("no handler for api request "+apiType);
                    JSONObject resp=handler.getHandler().handleApiRequest(uri,postData, serverInfo);
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
            if (fout != null) return new NavResponse(fout);
            return new NavResponse(getErrorReturn("request not handled"));
        } catch (JSONException jse) {
            return new NavResponse(getErrorReturn(jse.getMessage()));
        }
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
