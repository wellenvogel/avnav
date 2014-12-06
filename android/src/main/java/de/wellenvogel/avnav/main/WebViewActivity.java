package de.wellenvogel.avnav.main;

import android.app.Activity;
import android.content.Context;
import android.content.res.AssetManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.util.Log;
import android.webkit.*;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.*;
import java.util.HashMap;

/**
 * Created by andreas on 04.12.14.
 */
public class WebViewActivity extends Activity {

    private WebView webView;
    private AssetManager assetManager;
    private final Activity activity=this;
    private static String URLPREFIX="file://android_asset/";
    private static String NAVURL="viewer/avnav_navi.php";
    private static String CHARTPREFIX="charts";
    private static String DEMOCHARTS="demo"; //urls will start with CHARTPREFIX/DEMOCHARTS
    private static String REALCHARTS="charts";
    private static String OVERVIEW="avnav.xml"; //request for chart overview

    private String workdir;
    private File workBase;
    private boolean showDemoCharts;
    MimeTypeMap mime = MimeTypeMap.getSingleton();
    private HashMap<String,String> ownMimeMap=new HashMap<String, String>();
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
        try{
            if (type.equals("gps")){
                out.put("class","TPV");
                out.put("lat",54.12);
                out.put("lon",13.45);
                out.put("speed",5);
                out.put("track",15);
                out.put("mode",1);
                out.put("tag","RMC");
            }
            if (type.equals("listCharts")){
                try {
                    out.put("status", "OK");
                    JSONArray arr = new JSONArray();
                    File chartDir = new File(workBase, "charts");
                    //TODO: read gemf files from here..
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
                File requested= new File(new File(workBase,CHARTPREFIX), fname);
                rt=new FileInputStream(requested);
            }
            if (rt == null){
                Log.e(AvNav.LOGPRFX,"unknown chart path "+fname);
                return null;
            }

            return new WebResourceResponse(mimeType(fname),null,rt);
        } catch (Exception e) {
            Log.e(AvNav.LOGPRFX,"chart file "+fname+" not found");
        }
        return null;
    }
}
