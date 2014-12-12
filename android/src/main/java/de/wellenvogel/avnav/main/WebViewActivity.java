package de.wellenvogel.avnav.main;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.*;
import android.content.res.AssetManager;
import android.location.*;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.os.IBinder;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.Log;
import android.view.WindowManager;
import android.webkit.*;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.*;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.List;

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
    private HashMap<String,GemfHandler> gemfFiles= new HashMap<String, GemfHandler>();

    @Override
    protected void onStart() {
        super.onStart();
        LocationManager locationService = (LocationManager) getSystemService(LOCATION_SERVICE);
        boolean enabled = locationService.isProviderEnabled(LocationManager.GPS_PROVIDER);

        // check if enabled and if not send user to the GSP settings
        // Better solution would be to display a dialog and suggesting to
        // go to the settings
        if (!enabled) {
            AlertDialog.Builder builder = new AlertDialog.Builder(this);
            builder.setMessage(R.string.noLocation);
            builder.setPositiveButton(R.string.ok, new DialogInterface.OnClickListener() {
                public void onClick(DialogInterface dialog, int id) {
                    // User clicked OK button
                    Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
                    startActivity(intent);
                }
            });
            builder.setNegativeButton(R.string.cancel, new DialogInterface.OnClickListener() {
                public void onClick(DialogInterface dialog, int id) {
                    // User cancelled the dialog
                }
            });
            AlertDialog dialog = builder.create();
            dialog.show();

        }
        Intent intent = new Intent(this, GpsService.class);
        intent.putExtra(GpsService.PROP_TRACKDIR,workBase.getAbsolutePath()+"/tracks");
        //TODO: add other parameters here
        startService(intent);
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
        workBase=new File(Environment.getExternalStorageDirectory(),workdir);
        showDemoCharts=getIntent().getBooleanExtra(AvNav.SHOWDEMO,true);
        ownMimeMap.put("js","text/javascript");
        webView = (WebView) findViewById(R.id.webView1);
        webView.getSettings().setJavaScriptEnabled(true);
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
                    Log.d("AvNav","external request "+url);
                    return super.shouldInterceptRequest(view, url);
                }
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            public void onConsoleMessage(String message, int lineNumber, String sourceID) {
                Log.d("AvNav", message + " -- From line "
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
        webView.loadDataWithBaseURL(URLPREFIX+"viewer/dummy.html",htmlPage,"text/html","UTF-8",null);

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
        JSONObject out=new JSONObject();
        InputStream is=null;
        boolean handled=false;
        try{
            if (type.equals("gps")){
                handled=true;
                Location navLocation=null;
                if (gpsService != null) navLocation=gpsService.getCurrentLocation();
                if (navLocation != null){

                    out.put("class", "TPV");
                    out.put("lat", navLocation.getLatitude());
                    out.put("lon", navLocation.getLongitude());
                    out.put("speed", navLocation.getSpeed()*1852/3600); //we expect this in kn
                    out.put("course", navLocation.getBearing());
                    out.put("mode", 1);
                    out.put("tag", "RMC");
                    out.put("time",dateFormat.format(new Date(navLocation.getTime())));


                }
            }
            if (type.equals("listCharts")){
                handled=true;
                try {
                    out.put("status", "OK");
                    JSONArray arr = new JSONArray();
                    File chartDir = new File(workBase, "charts");
                    for (File f : chartDir.listFiles()){
                        if (! f.getName().endsWith(GEMFEXTENSION)) continue;
                        try {
                            String gemfName = f.getName();
                            gemfName = gemfName.substring(0, gemfName.length() - GEMFEXTENSION.length());
                            gemfFiles.put(gemfName, new GemfHandler(f));
                            JSONObject e=new JSONObject();
                            e.put("name",gemfName);
                            e.put("url","/"+CHARTPREFIX+"/"+REALCHARTS+"/"+gemfName);
                            arr.put(e);
                        }catch (Exception e){
                            Log.e(AvNav.LOGPRFX,"exception opening gemf file "+f.getAbsolutePath());
                        }

                    }
                    if (showDemoCharts){
                        String demoCharts[]=assetManager.list("charts");
                        for (String demo: demoCharts){
                            if (! demo.endsWith(".xml")) continue;
                            String name=demo.replaceAll("\\.xml$", "");
                            Log.d(AvNav.LOGPRFX,"found demo chart "+demo);
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
            }
            if (type.equals("track")) handled=true;
            if (type.equals("ais")) handled=true;
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
                Log.d(AvNav.LOGPRFX,"unhandled nav request "+type);
            }
            String outstring=out.toString();
            is = new ByteArrayInputStream(outstring.getBytes("UTF-8"));
        } catch (Exception e) {
            e.printStackTrace();
        }
        return new WebResourceResponse("application/json","UTF-8",is);
    }

    private WebResourceResponse handleChartRequest(String fname){
        fname=fname.substring(CHARTPREFIX.length()+1);
        InputStream rt=null;
        String mimeType=mimeType(fname);
        try {
            if (fname.startsWith(DEMOCHARTS)){
                fname=fname.substring(DEMOCHARTS.length()+1);
                fname = fname.replaceAll("\\?.*", "");
                if (fname.endsWith(OVERVIEW)){
                    Log.d(AvNav.LOGPRFX,"overview request "+fname);
                    fname=fname.substring(0,fname.length()-OVERVIEW.length()-1); //just the pure name
                    fname+=".xml";
                    rt=assetManager.open(CHARTPREFIX+"/"+fname);
                }
                else throw new Exception("unable to handle demo request for "+fname);
            }
            if (fname.startsWith(REALCHARTS)) {
                fname=fname.substring(REALCHARTS.length()+1);
                fname = fname.replaceAll("\\?.*", "");
                String baseAndUrl[]=fname.split("/",2);
                GemfHandler f=gemfFiles.get(baseAndUrl[0]);
                if (f != null){
                    if (baseAndUrl[1].equals(OVERVIEW)){
                        rt=f.gemfOverview();
                    }
                    else {
                        //we have source/z/x/y in baseAndUrl[1]
                        String param[] = baseAndUrl[1].split("/");
                        if (param.length < 4) {
                            throw new Exception("invalid parameter for gemf call " + fname);
                        }
                        mimeType="image/png";
                        //TODO: handle sources
                        int z=Integer.parseInt(param[1]);
                        int x=Integer.parseInt(param[2]);
                        int y=Integer.parseInt(param[3].replaceAll("\\.png",""));
                        rt = f.getInputStream(x,y,z,Integer.parseInt(param[0]));
                    }
                }
                else {
                    Log.e(AvNav.LOGPRFX,"gemf file "+baseAndUrl[0]+" not found");
                    return null;
                }
            }
            if (rt == null){
                Log.e(AvNav.LOGPRFX,"unknown chart path "+fname);
                return null;
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
            Log.d(AvNav.LOGPRFX,"gps service connected");

        }

        @Override
        public void onServiceDisconnected(ComponentName arg0) {
            gpsService=null;
            Log.d(AvNav.LOGPRFX,"gps service disconnected");
        }
    };

}
