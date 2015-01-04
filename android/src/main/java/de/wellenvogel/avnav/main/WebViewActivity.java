package de.wellenvogel.avnav.main;

import android.app.Activity;
import android.content.*;
import android.content.res.AssetManager;
import android.location.*;
import android.net.Uri;
import android.os.*;
import android.util.Log;
import android.view.WindowManager;
import android.webkit.*;
import android.widget.Toast;
import de.wellenvogel.avnav.gps.GpsService;
import de.wellenvogel.avnav.util.AvnLog;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.*;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;

/**
 * Created by andreas on 04.12.14.
 */
public class WebViewActivity extends Activity {



    private WebView webView;
    private AssetManager assetManager;
    private final Activity activity=this;
    private static final String URLPREFIX="file://android_asset/";
    private static final String NAVURL="viewer/avnav_navi.php";
    private static final String CHARTPREFIX="charts";
    private static final String DEMOCHARTS="demo"; //urls will start with CHARTPREFIX/DEMOCHARTS
    private static final String REALCHARTS="charts";
    private static final String OVERVIEW="avnav.xml"; //request for chart overview
    private static final String GEMFEXTENSION =".gemf";


    private String workdir;
    private File workBase;
    private boolean showDemoCharts;
    MimeTypeMap mime = MimeTypeMap.getSingleton();
    private HashMap<String,String> ownMimeMap=new HashMap<String, String>();

    private SimpleDateFormat dateFormat=new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSSZ");
    private GpsService gpsService=null;

    //gemf files
    private GemfHandler gemfFile= null;
    //mapping of url name to real filename
    private HashMap<String,String> fileNames=new HashMap<String, String>();

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
        workdir=getIntent().getStringExtra(AvNav.WORKDIR);
        workBase=new File(workdir);
        showDemoCharts=getIntent().getBooleanExtra(AvNav.SHOWDEMO,true);
        ownMimeMap.put("js","text/javascript");
        webView = (WebView) findViewById(R.id.webView1);
        webView.getSettings().setJavaScriptEnabled(true);
        /*
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
        */
        assetManager = getAssets();
        String htmlPage = null;
        InputStream input;
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
        webView.setWebViewClient(new WebViewClient() {
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                Toast.makeText(activity, "Oh no! " + description, Toast.LENGTH_SHORT).show();
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
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
                    AvnLog.d("AvNav","external request "+url);
                    return super.shouldInterceptRequest(view, url);
                }
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            public void onConsoleMessage(String message, int lineNumber, String sourceID) {
                AvnLog.d("AvNav", message + " -- From line "
                        + lineNumber + " of "
                        + sourceID);
            }
        });
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setDatabaseEnabled(true);
        String databasePath = webView.getContext().getDir("databases",
                Context.MODE_PRIVATE).getPath();
        webView.getSettings().setDatabasePath(databasePath);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        //we nedd to add a filename to the base to make local storage working...
        //http://stackoverflow.com/questions/8390985/android-4-0-1-breaks-webview-html-5-local-storage
        webView.loadDataWithBaseURL(URLPREFIX+"viewer/dummy.html?navurl=avnav_navi.php",htmlPage,"text/html","UTF-8",null);

    }

    private String mimeType(String fname){
        String ext=fname.replaceAll(".*\\.", "");
        String mimeType=mime.getMimeTypeFromExtension(ext);
        if (mimeType == null) {
            mimeType=ownMimeMap.get(ext);
        }
        return mimeType;
    }

    private WebResourceResponse handleNavRequest(String url){
        Uri uri= Uri.parse(url);
        String type=uri.getQueryParameter("request");
        if (type == null) type="gps";
        Object fout=null;
        InputStream is=null;
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
                    Log.e(AvNav.LOGPRFX,"error reading chartlist: "+e.getLocalizedMessage());
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
                String command=uri.getQueryParameter("command");
                if (command.equals("getleg") ){
                    handled=true;
                }
                if (command.equals("getroute")){
                    handled=true;
                }
            }
            if (!handled){
                AvnLog.d(AvNav.LOGPRFX,"unhandled nav request "+type);
            }
            String outstring="";
            if (fout != null) outstring=fout.toString();
            is = new ByteArrayInputStream(outstring.getBytes("UTF-8"));
        } catch (Exception e) {
            e.printStackTrace();
        }
        return new WebResourceResponse("application/json","UTF-8",is);
    }

    private WebResourceResponse handleChartRequest(String fname){
        fname=fname.substring(CHARTPREFIX.length()+1);
        InputStream rt=null;
        fname = fname.replaceAll("\\?.*", "");
        String mimeType=mimeType(fname);
        try {
            if (fname.startsWith(DEMOCHARTS)){
                fname=fname.substring(DEMOCHARTS.length()+1);
                if (fname.endsWith(OVERVIEW)){
                    AvnLog.d(AvNav.LOGPRFX,"overview request "+fname);
                    fname=fname.substring(0,fname.length()-OVERVIEW.length()-1); //just the pure name
                    fname+=".xml";
                    closeGemf();
                    rt=assetManager.open(CHARTPREFIX+"/"+fname);
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
                            rt = gemfFile.getInputStream(x, y, z, Integer.parseInt(param[0]));
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
                }
                else {
                    Log.e(AvNav.LOGPRFX,"invalid chart request "+fname);
                }
            }
            if (rt == null){
                Log.e(AvNav.LOGPRFX,"unknown chart path "+fname);
                WebResourceResponse resp=new WebResourceResponse(null,null,new ByteArrayInputStream("".getBytes()));
                //resp.setStatusCodeAndReasonPhrase(404,"not found");

            }

            return new WebResourceResponse(mimeType,"",rt);
        } catch (Exception e) {
            Log.e(AvNav.LOGPRFX,"chart file "+fname+" not found: "+e.getLocalizedMessage());
        }
        return null;
    }

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

    private void readChartDir(File chartDir,String index,JSONArray arr) {
        if (! chartDir.isDirectory()) return;
        for (File f : chartDir.listFiles()) {
            try {
                if (f.getName().endsWith(GEMFEXTENSION)){
                    String gemfName = f.getName();
                    gemfName = gemfName.substring(0, gemfName.length() - GEMFEXTENSION.length());
                    JSONObject e = new JSONObject();
                    e.put("name", gemfName);
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
