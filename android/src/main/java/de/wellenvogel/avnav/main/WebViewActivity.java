package de.wellenvogel.avnav.main;

import android.app.Activity;
import android.content.Context;
import android.content.res.AssetManager;
import android.net.Uri;
import android.os.Bundle;
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
    MimeTypeMap mime = MimeTypeMap.getSingleton();
    private HashMap<String,String> ownMimeMap=new HashMap<String, String>();
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.webview);

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
                        InputStream is=assetManager.open(fname);
                        String ext=fname.replaceAll(".*\\.", "");
                        String mimeType=mime.getMimeTypeFromExtension(ext);
                        if (mimeType == null) {
                            mimeType=ownMimeMap.get(ext);
                        }
                        return new WebResourceResponse(mimeType,"",is);
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

    private WebResourceResponse handleNavRequest(String url){
        Uri uri= Uri.parse(url);
        String type=uri.getQueryParameter("request");
        if (type == null) type="gps";
        JSONObject out=new JSONObject();
        InputStream is=null;
        try{
            if (type.equals("gps")){
                out.put("class","TPV");
                out.put("lat",50.4);
                out.put("lon",13.2);
                out.put("speed",5);
                out.put("track",15);
                out.put("mode",1);
                out.put("tag","RMC");
            }
            if (type.equals("listCharts")){
                out.put("status","OK");
                JSONArray arr=new JSONArray();
                JSONObject e=new JSONObject();
                e.put("name","test1");
                e.put("url","gemf/test1");
                e.put("charturl","gemf/test1");
                arr.put(e);
                out.put("data",arr);
            }
            String outstring=out.toString();
            is = new ByteArrayInputStream(outstring.getBytes("UTF-8"));
        } catch (Exception e) {
            e.printStackTrace();
        }
        return new WebResourceResponse("application/json","UTF-8",is);
    }


}
