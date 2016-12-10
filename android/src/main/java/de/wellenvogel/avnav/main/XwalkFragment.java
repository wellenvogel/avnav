package de.wellenvogel.avnav.main;

import android.app.Activity;
import android.app.Fragment;
import android.app.ProgressDialog;
import android.content.Intent;
import android.os.Bundle;
import android.support.annotation.Nullable;
import android.util.AttributeSet;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebResourceResponse;
import de.wellenvogel.avnav.util.AvnLog;
import org.xwalk.core.*;

/**
 * Created by andreas on 08.01.15.
 */
public class XwalkFragment extends Fragment implements IJsEventHandler {
    private XWalkView mXwalkView;
    ProgressDialog pd;
    @Override
    public void onCreate(Bundle savedInstanceState) {

        super.onCreate(savedInstanceState);
        pd = ProgressDialog.show(getActivity(), "", getString(R.string.loading), true);
        getActivity().getActionBar().hide();
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
    public void onAttach(Activity activity) {
        super.onAttach(activity);
        getMainActivity().registerJsEventHandler(this);
    }

    @Override
    public void onDetach() {
        super.onDetach();
        MainActivity a=getMainActivity();
        if (a!=null) a.deregisterJsEventHandler(this);
    }

    @Nullable
    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
        SharedXWalkView.initialize(this.getActivity(),null);
        mXwalkView = new XWalkView(inflater.getContext(),(AttributeSet)null);
        mXwalkView.setLayoutParams(new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        mXwalkView.setResourceClient(new XWalkResourceClient(mXwalkView){
            @Override
            public WebResourceResponse shouldInterceptLoadRequest(XWalkView view, String url) {
                WebResourceResponse rt=null;
                RequestHandler handler=getRequestHandler();
                if (handler != null) rt=handler.handleRequest(view, url);
                if (rt != null) return rt;
                return super.shouldInterceptLoadRequest(view, url);
            }

            @Override
            public void onLoadFinished(XWalkView view, String url) {
                super.onLoadFinished(view, url);
                if (pd.isShowing()) pd.dismiss();
            }
        });
        if (BuildConfig.DEBUG){
            AvnLog.d(Constants.LOGPRFX,"enable xwalk remote debugging");
            XWalkPreferences.setValue(XWalkPreferences.REMOTE_DEBUGGING, true);
        }
        mXwalkView.addJavascriptInterface(getRequestHandler().mJavaScriptApi,"avnavAndroid");
        String start= RequestHandler.URLPREFIX+"viewer/dummy.html?navurl=avnav_navi.php";
        if (BuildConfig.DEBUG) start+="&logNmea=1";
        mXwalkView.load(start, getRequestHandler().getStartPage());
        return mXwalkView;

    }
    @Override
    public void onPause() {
        super.onPause();
        if (mXwalkView != null) {
            mXwalkView.pauseTimers();
            mXwalkView.onHide();
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (mXwalkView != null) {
            mXwalkView.resumeTimers();
            mXwalkView.onShow();
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (mXwalkView != null) {
            mXwalkView.onDestroy();
        }
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (mXwalkView != null) {
            mXwalkView.onActivityResult(requestCode, resultCode, data);
        }
    }



    /**
     * send an event to the js code
     * @param key - a key string - only a-z_0-9A-Z
     * @param id
     */
    @Override
    public void sendEventToJs(String key, int id) {
        AvnLog.i("js event key="+key+", id="+id);
        if (mXwalkView !=null) mXwalkView.load("javascript:avnav.gui.sendAndroidEvent('" + key + "'," + id + ")", null);
    }
}