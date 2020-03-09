package de.wellenvogel.avnav.main;

import android.app.Activity;
import android.app.Fragment;
import android.app.ProgressDialog;
import android.content.*;
import android.net.Uri;
import android.os.*;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.*;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.lang.reflect.Method;
import java.util.HashMap;

import de.wellenvogel.avnav.appapi.IJsEventHandler;
import de.wellenvogel.avnav.appapi.RequestHandler;
import de.wellenvogel.avnav.util.AvnLog;

/**
 * Created by andreas on 04.12.14.
 */
public class WebViewFragment extends Fragment implements IJsEventHandler {
    private WebView webView;
    ProgressDialog pd;

    @Override
    public void onCreate(Bundle savedInstanceState) {

        super.onCreate(savedInstanceState);
        pd = ProgressDialog.show(getActivity(), "", getString(R.string.loading), true);
        ((MainActivity)getActivity()).hideToolBar();
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
        webView.getSettings().setAllowFileAccess(true);
        if (Build.VERSION.SDK_INT >= 16){
            try {
                WebSettings settings = webView.getSettings();
                Method m = WebSettings.class.getDeclaredMethod("setAllowUniversalAccessFromFileURLs", boolean.class);
                m.setAccessible(true);
                m.invoke(settings, true);
            }catch (Exception e){}
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT && BuildConfig.DEBUG) {
            try {
                Method m=WebView.class.getDeclaredMethod("setWebContentsDebuggingEnabled",boolean.class);
                m.setAccessible(true);
                m.invoke(webView,true);
                m=WebSettings.class.getDeclaredMethod("setMediaPlaybackRequiresUserGesture",boolean.class);
                m.setAccessible(true);
                m.invoke(webView.getSettings(),false);
            } catch (Exception e) {
            }
        }
        String htmlPage = getRequestHandler().getStartPage();
        webView.setWebViewClient(new WebViewClient() {
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                Toast.makeText(getActivity(), "Oh no! " + description, Toast.LENGTH_SHORT).show();
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                RequestHandler handler= getRequestHandler();
                WebResourceResponse rt=null;
                if (handler != null) {
                    try {
                        rt = handler.handleRequest(view, url);
                    }catch (Throwable t){
                        AvnLog.e("web request for "+url+" failed",t);
                        InputStream is=new ByteArrayInputStream(new byte[]{});
                        if (Build.VERSION.SDK_INT >= 21){
                            return new WebResourceResponse("application/octet-stream", "UTF-8",500,"error "+t.getMessage(),new HashMap<String, String>(),is);
                        }
                        else {
                            return new WebResourceResponse("application/octet-stream", "UTF-8", is);
                        }
                    }
                }
                if (rt==null) return super.shouldInterceptRequest(view, url);
                return rt;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (pd.isShowing()) pd.dismiss();
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url != null && (url.startsWith("http://")||url.startsWith("https://") )) {
                    view.getContext().startActivity(
                            new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    return true;
                } else {
                    return false;
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
        webView.getSettings().setTextZoom(100);
        String databasePath = webView.getContext().getDir("databases",
                Context.MODE_PRIVATE).getPath();
        webView.getSettings().setDatabasePath(databasePath);
        webView.addJavascriptInterface(getRequestHandler().getJavaScriptApi(),"avnavAndroid");
        getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        //we nedd to add a filename to the base to make local storage working...
        //http://stackoverflow.com/questions/8390985/android-4-0-1-breaks-webview-html-5-local-storage
        String start= RequestHandler.URLPREFIX+"viewer/dummy.html?navurl=avnav_navi.php";
        if (BuildConfig.DEBUG) start+="&logNmea=1";
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
        webView.loadUrl("javascript:avnav.android.receiveEvent('" + key + "'," + id + ")");
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        webView.destroy();
    }
}
