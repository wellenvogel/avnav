package de.wellenvogel.avnav.main;

import android.app.Activity;
import android.app.Fragment;
import android.content.*;
import android.content.res.AssetManager;
import android.location.*;
import android.net.Uri;
import android.os.*;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
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
public class WebViewFragment extends Fragment {
    private WebView webView;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    private WebViewActivityBase getWebActivity(){
        return (WebViewActivityBase)getActivity();
    }
    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
        //super.onCreateView(inflater, container, savedInstanceState);
        View main=inflater.inflate(R.layout.webview,container,false);
        webView = (WebView)main.findViewById(R.id.webview);
        webView.getSettings().setJavaScriptEnabled(true);
        /*
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
        */
        String htmlPage = getWebActivity().getStartPage();
        webView.setWebViewClient(new WebViewClient() {
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                Toast.makeText(getActivity(), "Oh no! " + description, Toast.LENGTH_SHORT).show();
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                WebResourceResponse rt=getWebActivity().handleRequest(view,url);
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
        webView.addJavascriptInterface(getWebActivity().mJavaScriptApi,"avnavAndroid");
        getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        //we nedd to add a filename to the base to make local storage working...
        //http://stackoverflow.com/questions/8390985/android-4-0-1-breaks-webview-html-5-local-storage
        String start=getWebActivity().URLPREFIX+"viewer/dummy.html?navurl=avnav_navi.php";
        if (BuildConfig.DEBUG) start+="&log=1";
        webView.loadDataWithBaseURL(start,htmlPage,"text/html","UTF-8",null);
        return main;
    }

    /**
     * send an event to the js code
     * @param key - a key string - only a-z_0-9A-Z
     * @param id
     */

    protected void sendEventToJs(String key, int id) {
        AvnLog.i("js event key="+key+", id="+id);
        webView.loadUrl("javascript:avnav.gui.sendAndroidEvent('" + key + "'," + id + ")");
    }
}
