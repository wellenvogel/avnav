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
public class WebViewActivity extends WebViewActivityBase {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.webview);
        webView = (WebView) findViewById(R.id.webView1);
        webView.getSettings().setJavaScriptEnabled(true);
        /*
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
        */
        String htmlPage = getStartPage();
        webView.setWebViewClient(new WebViewClient() {
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                Toast.makeText(activity, "Oh no! " + description, Toast.LENGTH_SHORT).show();
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                WebResourceResponse rt=handleRequest(view,url);
                if (rt==null) return super.shouldInterceptRequest(view, url);
                return rt;
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

}
