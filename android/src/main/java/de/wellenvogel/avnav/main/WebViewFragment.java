package de.wellenvogel.avnav.main;

import android.app.Activity;
import android.app.Fragment;
import android.content.*;
import android.os.*;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.*;
import android.widget.Toast;

import de.wellenvogel.avnav.util.AvnLog;

/**
 * Created by andreas on 04.12.14.
 */
public class WebViewFragment extends Fragment implements IJsEventHandler {
    private WebView webView;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    private MainActivity getMainActivity(){
        return (MainActivity)getActivity();
    }

    private RequestHandler getRequestHandler(){
        MainActivity a=getMainActivity();
        if (a == null) return null;
        return a.getRequestHandler();
    }
    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
        super.onCreateView(inflater, container, savedInstanceState);
        webView = new WebView(inflater.getContext());
        webView.setLayoutParams(new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        webView.getSettings().setJavaScriptEnabled(true);
        /*
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
        */
        String htmlPage = getRequestHandler().getStartPage();
        webView.setWebViewClient(new WebViewClient() {
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                Toast.makeText(getActivity(), "Oh no! " + description, Toast.LENGTH_SHORT).show();
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                RequestHandler handler= getRequestHandler();
                WebResourceResponse rt=null;
                if (handler != null) rt=handler.handleRequest(view,url);
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
        webView.addJavascriptInterface(getRequestHandler().mJavaScriptApi,"avnavAndroid");
        getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        //we nedd to add a filename to the base to make local storage working...
        //http://stackoverflow.com/questions/8390985/android-4-0-1-breaks-webview-html-5-local-storage
        String start= RequestHandler.URLPREFIX+"viewer/dummy.html?navurl=avnav_navi.php";
        if (BuildConfig.DEBUG) start+="&log=1";
        webView.loadDataWithBaseURL(start,htmlPage,"text/html","UTF-8",null);
        return webView;
    }

    @Override
    public void onAttach(Activity activity) {
        super.onAttach(activity);
        getMainActivity().registerJsEventHandler(this);
    }

    @Override
    public void onDetach() {
        super.onDetach();
        MainActivity a= getMainActivity();
        if (a!= null) a.deregisterJsEventHandler(this);
    }

    /**
     * send an event to the js code
     * @param key - a key string - only a-z_0-9A-Z
     * @param id
     */
    @Override
    public void sendEventToJs(String key, int id) {
        AvnLog.i("js event key="+key+", id="+id);
        webView.loadUrl("javascript:avnav.gui.sendAndroidEvent('" + key + "'," + id + ")");
    }
}
