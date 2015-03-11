package de.wellenvogel.avnav.main;

import android.app.ActionBar;
import android.content.Intent;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebResourceResponse;
import de.wellenvogel.avnav.util.AvnLog;
import org.xwalk.core.*;

/**
 * Created by andreas on 08.01.15.
 */
public class XwalkActivity extends WebViewActivityBase {
    private SharedXWalkView mXwalkView;
    private XwalkDownloadHandler downloadHandler=new XwalkDownloadHandler(this);
    @Override
    public void onCreate(Bundle savedInstanceState) {

        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        mXwalkView = new SharedXWalkView(this, null, new SharedXWalkExceptionHandler() {
            @Override
            public void onSharedLibraryNotFound() {
                downloadHandler.showDownloadDialog(getString(R.string.xwalkNotFoundTitle),
                        getString(R.string.xwalkNotFoundText)+AvNav.XWALKVERSION,true);
            }
        });
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        ActionBar a=getActionBar();
        if (a != null) a.hide();
        setContentView(mXwalkView);
        mXwalkView.setResourceClient(new XWalkResourceClient(mXwalkView){
            @Override
            public WebResourceResponse shouldInterceptLoadRequest(XWalkView view, String url) {
                WebResourceResponse rt=handleRequest(view,url);
                if (rt != null) return rt;
                return super.shouldInterceptLoadRequest(view, url);
            }
        });
        if (BuildConfig.DEBUG){
            AvnLog.d(AvNav.LOGPRFX,"enable xwalk remote debugging");
            XWalkPreferences.setValue(XWalkPreferences.REMOTE_DEBUGGING, true);
        }
        mXwalkView.addJavascriptInterface(mJavaScriptApi,"avnavAndroid");
        String start=URLPREFIX+"viewer/dummy.html?navurl=avnav_navi.php";
        if (BuildConfig.DEBUG) start+="&log=1";
        mXwalkView.load(start, getStartPage());

    }
    @Override
    protected void onPause() {
        super.onPause();
        if (mXwalkView != null) {
            mXwalkView.pauseTimers();
            mXwalkView.onHide();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (mXwalkView != null) {
            mXwalkView.resumeTimers();
            mXwalkView.onShow();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (mXwalkView != null) {
            mXwalkView.onDestroy();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode,resultCode,data);
        if (mXwalkView != null) {
            mXwalkView.onActivityResult(requestCode, resultCode, data);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (mXwalkView != null) {
            mXwalkView.onNewIntent(intent);
        }
    }

    /**
     * send an event to the js code
     * @param key - a key string - only a-z_0-9A-Z
     * @param id
     */
    @Override
    protected void sendEventToJs(String key, int id) {
        AvnLog.i("js event key="+key+", id="+id);
        if (mXwalkView !=null) mXwalkView.load("javascript:avnav.gui.sendAndroidEvent('" + key + "'," + id + ")", null);
    }
}