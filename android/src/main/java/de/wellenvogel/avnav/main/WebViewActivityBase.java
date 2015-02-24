package de.wellenvogel.avnav.main;

import android.app.Activity;
import android.content.*;
import android.content.res.AssetManager;
import android.location.Location;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.os.IBinder;
import android.os.ParcelFileDescriptor;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import android.webkit.*;
import android.widget.Toast;
import de.wellenvogel.avnav.gps.GpsService;
import de.wellenvogel.avnav.gps.TrackWriter;
import de.wellenvogel.avnav.util.AvnLog;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.xwalk.core.JavascriptInterface;
import org.xwalk.core.XWalkActivity;

import java.io.*;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;

/**
 * Created by andreas on 06.01.15.
 */
public class WebViewActivityBase extends XWalkActivity {
    public static final String URLPREFIX="file://android_asset/";
    protected static final String NAVURL="viewer/avnav_navi.php";
    protected static final String CHARTPREFIX="charts";
    private static final String DEMOCHARTS="demo"; //urls will start with CHARTPREFIX/DEMOCHARTS
    private static final String REALCHARTS="charts";
    private static final String OVERVIEW="avnav.xml"; //request for chart overview
    private static final String GEMFEXTENSION =".gemf";
    private static final int ROUTE_OPEN_REQUEST=0;
    private static final long ROUTE_MAX_SIZE=100000; //see avnav_router.py
    protected final Activity activity=this;
    MimeTypeMap mime = MimeTypeMap.getSingleton();
    AssetManager assetManager;
    private String workdir;
    private File workBase;
    private boolean showDemoCharts;
    private HashMap<String,String> ownMimeMap=new HashMap<String, String>();
    private SimpleDateFormat dateFormat=new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSSZ");
    private GpsService gpsService=null;
    //gemf files
    private GemfHandler gemfFile= null;
    //mapping of url name to real filename
    private HashMap<String,String> fileNames=new HashMap<String, String>();

    private void sendFile(String name, String type){
        if (!type.equals("track") && ! type.equals("route")){
            Log.e(AvNav.LOGPRFX,"invalid type "+type+" for sendFile");
            return;
        }
        String dirname="tracks";
        if (type.equals("route")) dirname="routes";
        File dir=new File(workBase,dirname);
        File file=new File(dir,name);
        if (! file.isFile()){
            Log.e(AvNav.LOGPRFX,"file "+name+" not found");
            return;
        }
        Uri data=Uri.fromFile(file);
        Intent shareIntent = new Intent();
        shareIntent.setAction(Intent.ACTION_SEND);
        shareIntent.putExtra(Intent.EXTRA_STREAM, data);
        shareIntent.setType("application/gpx+xml");
        startActivity(Intent.createChooser(shareIntent, getResources().getText(R.string.selectApp)+name));
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != ROUTE_OPEN_REQUEST) return;
        if (resultCode != RESULT_OK) {
            // Exit without doing anything else
            return;
        } else {
            Uri returnUri = data.getData();
            String name=returnUri.getLastPathSegment();
            name=name.replaceAll("\\.gpx$","");
            try {
                ParcelFileDescriptor pfd = getContentResolver().openFileDescriptor(returnUri, "r");
                long size=pfd.getStatSize();
                if (size > ROUTE_MAX_SIZE) throw new Exception("route to big, allowed "+ROUTE_MAX_SIZE);
                int isize=(int)size;
                FileDescriptor fd=pfd.getFileDescriptor();
                FileInputStream is=new FileInputStream(pfd.getFileDescriptor());
                byte buffer[]=new byte[isize];
                int rd=is.read(buffer,0,isize);
                if (rd != isize) throw new Exception("unable to read file");
                File routefile=new File(new File(workBase,"routes"),name+".gpx");
                if (routefile.exists()) throw new Exception("route "+name+" already exists");
                saveRoute(new String(buffer,"UTF-8"),name,false);
            } catch (Exception e) {
                Toast.makeText(getApplicationContext(), "unable top open file "+name+": "+e.getLocalizedMessage(), Toast.LENGTH_LONG).show();
                e.printStackTrace();
                Log.e(AvNav.LOGPRFX, "File not found.");
                return;
            }
        }
    }
    private String saveRoute(String xml,String name,boolean force){
        try {
            JSONObject rt = new JSONObject();
            try {
                rt.put("status", "OK");
                File routeDir = new File(workBase, "routes");
                File routeFile=new File(routeDir,name+".gpx");
                if (! routeFile.exists() || force) {
                    FileOutputStream os = new FileOutputStream(routeFile);
                    os.write(xml.getBytes());
                    os.close();
                }
                else {
                    rt.put("status","route already exists");
                }
            } catch (Exception e) {
                rt.put("status",e.getLocalizedMessage());
            }
            return rt.toString();
        }catch (Exception e){
            return "";
        }
    }

    protected class JavaScriptApi{


        @JavascriptInterface
        public String storeRoute(String route,String name){
            return saveRoute(route,name,false);
        }
        @JavascriptInterface
        public void downloadRoute(String routeXml,String name){
            saveRoute(routeXml,name,true);
            sendFile(name+".gpx","route");
        }

        @JavascriptInterface
        public String uploadRoute(){
            Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
            intent.setType("*/*");
            intent.addCategory(Intent.CATEGORY_OPENABLE);

            try {
                startActivityForResult(
                        Intent.createChooser(intent, getText(R.string.uploadRoute)),
                        0);
            } catch (android.content.ActivityNotFoundException ex) {
                // Potentially direct the user to the Market with a Dialog
                Toast.makeText(getApplicationContext(), getText(R.string.installFileManager), Toast.LENGTH_SHORT).show();
            }

            return "";

        }

        @JavascriptInterface
        public void downloadTrack(String name){
            sendFile(name,"track");
        }
        @JavascriptInterface
        public String test(String text){
            Toast.makeText(getApplicationContext(), text, Toast.LENGTH_LONG).show();
            return "";
        }
    };

    protected JavaScriptApi mJavaScriptApi=new JavaScriptApi();

    /** Defines callbacks for service binding, passed to bindService() */
    private ServiceConnection mConnection = new ServiceConnection() {

        @Override
        public void onServiceConnected(ComponentName className,
                                       IBinder service) {
            // We've bound to LocalService, cast the IBinder and get LocalService instance
            GpsService.GpsServiceBinder binder = (GpsService.GpsServiceBinder) service;
            gpsService = binder.getService();
            AvnLog.d(AvNav.LOGPRFX, "gps service connected");

        }

        @Override
        public void onServiceDisconnected(ComponentName arg0) {
            gpsService=null;
            AvnLog.d(AvNav.LOGPRFX,"gps service disconnected");
        }
    };

    @Override
    protected void onStart() {
        super.onStart();

        Intent intent = new Intent(this, GpsService.class);
        bindService(intent, mConnection, Context.BIND_AUTO_CREATE);
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (gpsService != null){
            unbindService(mConnection);
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.webview);
        SharedPreferences prefs=getSharedPreferences(AvNav.PREFNAME,Context.MODE_PRIVATE);
        workdir=prefs.getString(AvNav.WORKDIR, Environment.getExternalStorageDirectory().getAbsolutePath()+"/avnav");
        workBase=new File(workdir);
        showDemoCharts=prefs.getBoolean(AvNav.SHOWDEMO,false);
        ownMimeMap.put("js","text/javascript");
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        assetManager=getAssets();

    }
    String mimeType(String fname){
        String ext=fname.replaceAll(".*\\.", "");
        String mimeType=mime.getMimeTypeFromExtension(ext);
        if (mimeType == null) {
            mimeType=ownMimeMap.get(ext);
        }
        return mimeType;
    }

    public static class ExtendedWebResourceResponse extends WebResourceResponse{
        int length;
        public ExtendedWebResourceResponse(int length,String mime,String encoding,InputStream is){
            super(mime,encoding,is);
            this.length=length;
        }
        public int getLength(){
            return length;
        }
    }

    WebResourceResponse handleRequest(View view,String url){
        if (url.startsWith(URLPREFIX)){
            try {
                String fname=url.substring(URLPREFIX.length());
                if (fname.startsWith(NAVURL)){
                    return handleNavRequest(url);
                }
                if (fname.startsWith(CHARTPREFIX)){
                    return handleChartRequest(fname);
                }
                InputStream is=assetManager.open(fname);
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
            input = assetManager.open("viewer/avnav_viewer.html");

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

    ExtendedWebResourceResponse handleNavRequest(String url){
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
                if (gpsService != null) navLocation=gpsService.getGpsData();
                fout=navLocation;
            }
            if (type.equals("listCharts")){
                fileNames.clear();
                closeGemf();
                handled=true;
                JSONObject out=new JSONObject();
                try {
                    out.put("status", "OK");
                    JSONArray arr = new JSONArray();
                    File chartDir = new File(workBase, "charts");
                    readChartDir(chartDir,"1",arr);
                    if (showDemoCharts){
                        String demoCharts[]=assetManager.list("charts");
                        for (String demo: demoCharts){
                            if (! demo.endsWith(".xml")) continue;
                            String name=demo.replaceAll("\\.xml$", "");
                            AvnLog.d(AvNav.LOGPRFX,"found demo chart "+demo);
                            JSONObject e = new JSONObject();
                            e.put("name", name);
                            e.put("url", "/"+CHARTPREFIX+"/"+DEMOCHARTS+"/" + name);
                            e.put("charturl","/"+ CHARTPREFIX+"/"+DEMOCHARTS+"/" + name);
                            arr.put(e);
                        }
                    }
                    out.put("data", arr);
                }catch (Exception e){
                    Log.e(AvNav.LOGPRFX, "error reading chartlist: " + e.getLocalizedMessage());
                    out.put("status","ERROR");
                    out.put("info",e.getLocalizedMessage());
                }
                fout=out;
            }
            if (type.equals("track")){
                handled=true;
                if (gpsService != null) {
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
                    ArrayList<Location> track=gpsService.getTrack(maxnum,interval);
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
                if (gpsService !=null){
                    fout=gpsService.getAisData(lat,lon,distance);
                }
            }
            if (type.equals("routing")){
                JSONObject o = new JSONObject();
                o.put("status","OK");
                String command=uri.getQueryParameter("command");
                if (command.equals("getleg") || command.equals("setleg")){
                    handled=true;
                }
                if (command.equals("getroute") || command.equals("deleteroute")){
                    String name=uri.getQueryParameter("name");
                    if (name != null) {
                        File routes = new File(workBase, "routes");
                        File routeFile = new File(routes, name + ".gpx");

                        if (command.equals("deleteroute")) {
                            if (routeFile.isFile()) {
                                routeFile.delete();
                            }
                            else {
                                o.put("status","route not found");
                            }
                        } else {
                            if (routeFile.isFile()) {
                                return new ExtendedWebResourceResponse((int) routeFile.length(), "application/xml", "", new FileInputStream(routeFile));
                            }
                            return new ExtendedWebResourceResponse(0, "application/octet-stream", "", new ByteArrayInputStream(new byte[0]));
                        }
                    }
                    handled = true;
                }
                if (command.equals("listroutes")){
                    handled=true;
                    JSONArray a=new JSONArray();
                    File routes=new File(workBase,"routes");
                    for (File r:routes.listFiles()){
                        if (! r.getName().endsWith(".gpx")) continue;
                        JSONObject e=new JSONObject();
                        e.put("name",r.getName().replaceAll("\\.gpx$",""));
                        e.put("time",r.lastModified()/1000);
                        e.put("numpoints",0); //TODO
                        e.put("length",0); //TODO
                        a.put(e);
                    }
                    o.put("items",a);
                    fout=o;
                }
                if (handled) fout=o;
            }
            if (type.equals("listdir")){
                String dirtype=uri.getQueryParameter("type");
                JSONArray items=new JSONArray();
                if (dirtype.equals("track")){
                    ArrayList<TrackWriter.TrackInfo> tracks=gpsService.listTracks();
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
                    File chartDir = new File(workBase, "charts");
                    readChartDir(chartDir,"1",items);
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
                if (dltype != null && dltype.equals("track") && name != null) {
                    File trackfile = new File(gpsService.getTrackDir(), name);
                    if (trackfile.isFile()) {
                        return new ExtendedWebResourceResponse((int) trackfile.length(), "application/gpx+xml", "", new FileInputStream(trackfile));
                    }
                }
                byte[] o = ("file " + ((name!=null)?name:"<null>") + " not found").getBytes();
                return new ExtendedWebResourceResponse(o.length, "application/octet-stream", "", new ByteArrayInputStream(o));
            }
            if (type.equals("delete")) {
                JSONObject o=new JSONObject();
                String dtype = uri.getQueryParameter("type");
                String name = uri.getQueryParameter("name");
                if (dtype == null || !dtype.equals("track")){
                    o.put("status","invalid type");
                }
                else {
                    File trackfile = new File(gpsService.getTrackDir(), name);
                    if (! trackfile.isFile()){
                        o.put("status","track "+name+" not found");
                    }
                    else {
                        trackfile.delete();
                        o.put("status","OK");
                    }
                }
                handled=true;
                fout=o;
            }
            if (!handled){
                AvnLog.d(AvNav.LOGPRFX,"unhandled nav request "+type);
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
                    AvnLog.d(AvNav.LOGPRFX,"overview request "+fname);
                    fname=fname.substring(0,fname.length()-OVERVIEW.length()-1); //just the pure name
                    fname+=".xml";
                    closeGemf();
                    rt=assetManager.open(CHARTPREFIX+"/"+fname);
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
                            GemfHandler f = new GemfHandler(new GEMFFile(new File(realName)),fname);
                            rt=f.gemfOverview();
                            len=-1;
                            gemfFile=f;
                        }catch (Exception e){
                            Log.e(AvNav.LOGPRFX,"unable to read gemf file "+fname+": "+e.getLocalizedMessage());
                        }
                    }
                    else {
                        if (gemfFile != null){
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
                            rt=gs;
                            len=gs.getLength();
                        }
                        else {
                            Log.e(AvNav.LOGPRFX, "gemf file " + fname + " not open");
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
                        Log.e(AvNav.LOGPRFX,"invalid query for xml file "+fname);
                    }
                    rt=new FileInputStream(avnav);
                    len=(int)avnav.length();
                }
                else {
                    Log.e(AvNav.LOGPRFX,"invalid chart request "+fname);
                }
            }
            if (rt == null){
                Log.e(AvNav.LOGPRFX,"unknown chart path "+fname);


            }

            return new ExtendedWebResourceResponse(len,mimeType,"",rt);
        } catch (Exception e) {
            Log.e(AvNav.LOGPRFX,"chart file "+fname+" not found: "+e.getLocalizedMessage());
        }
        return null;
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
                    AvnLog.d(AvNav.LOGPRFX,"readCharts: adding url "+urlName+" for "+f.getAbsolutePath());
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
                    AvnLog.d(AvNav.LOGPRFX,"readCharts: adding url "+urlName+" for "+f.getAbsolutePath());
                    e.put("url","/"+CHARTPREFIX+"/"+urlName);
                    arr.put(e);
                }
            } catch (Exception e) {
                Log.e(AvNav.LOGPRFX, "exception handling file " + f.getAbsolutePath());
            }
        }
    }

    private void closeGemf(){
        if (gemfFile != null) {
            AvnLog.d(AvNav.LOGPRFX,"closing gemf file "+gemfFile.getUrlName());
            gemfFile.close();
        }
        gemfFile=null;
    }
}
