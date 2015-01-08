package de.wellenvogel.avnav.main;

import android.app.ActionBar;
import android.content.Intent;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebResourceResponse;
import de.wellenvogel.avnav.util.AvnLog;
import org.xwalk.core.SharedXWalkView;
import org.xwalk.core.XWalkPreferences;
import org.xwalk.core.XWalkResourceClient;
import org.xwalk.core.XWalkView;

/**
 * Created by andreas on 08.01.15.
 */
public class Xwalk extends WebViewActivityBase {
    private SharedXWalkView mXwalkView;
    @Override
    public void onCreate(Bundle savedInstanceState) {

        super.onCreate(savedInstanceState);
        //setContentView(R.layout.xwalkold);
        mXwalkView = new SharedXWalkView(this,this);
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
        mXwalkView.load(URLPREFIX+"viewer/dummy.html?navurl=avnav_navi.php", getStartPage());
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
        if (mXwalkView != null) {
            mXwalkView.onActivityResult(requestCode, resultCode, data);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        if (mXwalkView != null) {
            mXwalkView.onNewIntent(intent);
        }
    }
}