package de.wellenvogel.avnav.main;

import android.app.Activity;
import android.app.Fragment;
import android.app.ProgressDialog;
import android.content.*;
import android.net.Uri;
import android.os.*;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.*;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.lang.reflect.Method;
import java.util.HashMap;

import de.wellenvogel.avnav.appapi.JavaScriptApi;
import de.wellenvogel.avnav.appapi.RequestHandler;
import de.wellenvogel.avnav.appapi.WebServer;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.worker.GpsService;

import static android.app.Activity.RESULT_OK;
import static de.wellenvogel.avnav.main.Constants.LOGPRFX;

/**
 * Created by andreas on 04.12.14.
 */
public class WebViewFragment extends Fragment {
    private WebView webView;
    ProgressDialog pd;
    JavaScriptApi jsInterface=null;
    int goBackSequence=0;
    private float currentBrigthness=1;
    private void doSetBrightness(float newBrightness){
        Window w=getActivity().getWindow();
        WindowManager.LayoutParams lp=w.getAttributes();
        lp.screenBrightness=newBrightness;
        w.setAttributes(lp);
    }
    private Handler screenBrightnessHandler = new Handler(){
        @Override
        public void handleMessage(Message msg) {
            super.handleMessage(msg);
            int percent=msg.what;
            float newBrightness;
            if (percent >= 100){
                newBrightness= WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE;
            }
            else {
                newBrightness = (float) percent / 100;
                if (newBrightness < 0.01f) newBrightness = 0.01f;
                if (newBrightness > 1) newBrightness = 1;
            }
            currentBrigthness=newBrightness;
            doSetBrightness(newBrightness);
        }
    };

    public void setBrightness(int percent){
        Message msg=screenBrightnessHandler.obtainMessage(percent);
        screenBrightnessHandler.sendMessage(msg);
    }
    public void onBackPressed(){
        final int num=goBackSequence+1;
        sendEventToJs(Constants.JS_BACK,num);
        //as we cannot be sure that the JS code will for sure handle
        //our back pressed (maybe a different page has been loaded) , we wait at most 200ms for it to ack this
        //otherwise we really go back here
        Thread waiter=new Thread(new Runnable() {
            @Override
            public void run() {
                long wait=200;
                while (wait>0) {
                    long current = System.currentTimeMillis();
                    if (goBackSequence == num) break;
                    try {
                        Thread.sleep(10);
                    } catch (InterruptedException e) {
                    }
                    wait-=10;
                }
                if (wait == 0) {
                    Log.e(AvnLog.LOGPREFIX,"go back handler did not fire");
                    getMainActivity().runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            getMainActivity().goBack();
                        }
                    });
                }
            }
        });
        waiter.start();
    }

    public void jsGoBackAccepted(int id){
        goBackSequence=id;
    }

    public void launchBrowser() {
        try {
            GpsService service = getMainActivity().getGpsService();
            WebServer webServer = service.getWebServer();
            if (webServer == null) return;
            if (!webServer.isRunning()) return;
            int port = webServer.getPort();
            if (port == 0) return;
            String start = "http://localhost:" + port + "/viewer/avnav_viewer.html";
            if (BuildConfig.DEBUG) start += "?log=1";
            AvnLog.d(LOGPRFX, "start browser with " + start);
            try {
                Intent myIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(start));
                startActivity(Intent.createChooser(myIntent, "Chose browser"));

            } catch (ActivityNotFoundException e) {
                Toast.makeText(getMainActivity(), "No application can handle this request."
                        + " Please install a webbrowser", Toast.LENGTH_LONG).show();
                e.printStackTrace();
            }

        } catch (Throwable t) {
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {

        super.onCreate(savedInstanceState);
        ((MainActivity)getActivity()).hideToolBar();
        jsInterface=new JavaScriptApi(this,getRequestHandler());
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
        if (pd != null){
            try{
                pd.dismiss();
            }catch (Throwable t){}
        }
        pd = ProgressDialog.show(getActivity(), "", getString(R.string.loading), true);
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
        String htmlPage = null;
        RequestHandler handler=getRequestHandler();
        if (handler != null) htmlPage=handler.getStartPage();
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
                        rt = handler.handleRequest(view,url);
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
        webView.addJavascriptInterface(jsInterface,"avnavAndroid");
        getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        handleBars();


        //we nedd to add a filename to the base to make local storage working...
        //http://stackoverflow.com/questions/8390985/android-4-0-1-breaks-webview-html-5-local-storage
        String start= RequestHandler.INTERNAL_URL_PREFIX +RequestHandler.ROOT_PATH+"/dummy.html?navurl=avnav_navi.php";
        if (BuildConfig.DEBUG) start+="&logNmea=1";
        if (htmlPage != null) {
            webView.loadDataWithBaseURL(start, htmlPage, "text/html", "UTF-8", null);
        }
        return webView;
    }

    private void handleBars(){
        SharedPreferences sharedPrefs=getActivity().getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        boolean hideStatus=sharedPrefs.getBoolean(Constants.HIDE_BARS,false);
        if (hideStatus ) {
            View decorView = getActivity().getWindow().getDecorView();
            int flags=View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
            flags+=View.SYSTEM_UI_FLAG_FULLSCREEN;
            flags+=View.SYSTEM_UI_FLAG_HIDE_NAVIGATION;
            decorView.setSystemUiVisibility(flags);
        }
    }
    @Override
    public void onResume() {
        super.onResume();
        handleBars();
    }

    @Override
    public void onAttach(Activity activity) {
        super.onAttach(activity);
    }

    @Override
    public void onDetach() {
        super.onDetach();
        jsInterface.onDetach();
    }

    /**
     * send an event to the js code
     * @param key - a key string - only a-z_0-9A-Z
     * @param id
     */
    public void sendEventToJs(String key, long id) {
        AvnLog.i("js event key="+key+", id="+id);
        webView.loadUrl("javascript:if (avnav && avnav.android) avnav.android.receiveEvent('" + key + "'," + id + ")");
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (pd != null){
            try{
                pd.dismiss();
            }catch (Throwable t){}
        }
        webView.destroy();
    }
    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        switch (requestCode) {
            case Constants.FILE_OPEN:
                if (resultCode != RESULT_OK) {
                    // Exit without doing anything else
                    return;
                } else {
                    Uri returnUri = data.getData();
                    if (jsInterface != null) jsInterface.saveFile(returnUri);
                }
                return;
        }
        super.onActivityResult(requestCode,resultCode,data);
    }


}
