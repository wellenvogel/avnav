package de.wellenvogel.avnav.main;

import android.app.Activity;
import android.app.ActivityManager;
import android.app.Fragment;
import android.app.FragmentManager;
import android.app.FragmentTransaction;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.ServiceConnection;
import android.content.SharedPreferences;
import android.content.res.AssetManager;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Message;
import android.preference.PreferenceManager;
import android.util.Log;
import android.view.WindowManager;

import org.xwalk.core.XWalkActivity;

import java.io.File;
import java.util.List;

import de.wellenvogel.avnav.appapi.RequestHandler;
import de.wellenvogel.avnav.worker.GpsService;
import de.wellenvogel.avnav.settings.SettingsActivity;
import de.wellenvogel.avnav.util.ActionBarHandler;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.util.DialogBuilder;

/**
 * Created by andreas on 06.01.15.
 */
public class MainActivity extends XWalkActivity implements IDialogHandler,IMediaUpdater,SharedPreferences.OnSharedPreferenceChangeListener {

    private String lastStartMode=null; //The last mode we used to select the fragment
    SharedPreferences sharedPrefs;
    protected final Activity activity=this;
    AssetManager assetManager;
    private String workdir;
    private File workBase;
    GpsService gpsService=null;
    int goBackSequence;
    private ActionBarHandler mToolbar;
    public ActionBarHandler getToolbar(){
        return mToolbar;
    }
    private boolean exitRequested=false;
    private boolean running=false;
    private BroadcastReceiver broadCastReceiverStop;
    private BroadcastReceiver reloadReceiver;
    private Handler mediaUpdateHandler=new Handler(){
        @Override
        public void handleMessage(Message msg) {
            AvnLog.d(Constants.LOGPRFX,"Mediaupdater for "+msg);
            super.handleMessage(msg);
            File f=(File)msg.obj;
            updateMtp(f);
        }
    };
    RequestHandler requestHandler=null;
    private boolean serviceNeedsRestart=false;


    public void updateMtp(File file){
        AvnLog.d(Constants.LOGPRFX, "MTP update for " + file.getAbsolutePath());
        try {
            MediaScannerConnection.scanFile(this, new String[]{file.getAbsolutePath()}, null, null);
            this.sendBroadcast(new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE,
                    Uri.fromFile(file)));
        }catch(Exception e){
            Log.e(Constants.LOGPRFX, "error when updating MTP " + e.getLocalizedMessage());
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        switch (requestCode) {
            case Constants.SETTINGS_REQUEST:
                if (resultCode != RESULT_OK){
                    endApp();
                    return;
                }
                break;
            default:
                AvnLog.e("unknown activity result " + requestCode);
        }
    }

    private boolean startGpsService(){
        if (Build.VERSION.SDK_INT >= 26) {
            ActivityManager activityManager = (ActivityManager) this.getSystemService(Context.ACTIVITY_SERVICE);
            List<ActivityManager.RunningAppProcessInfo> runningAppProcesses = activityManager.getRunningAppProcesses();
            if (runningAppProcesses != null) {
                int importance = runningAppProcesses.get(0).importance;
                // higher importance has lower number (?)
                if (importance > ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND){
                    AvnLog.e("still in background while trying to start service");
                    return false;
                }
            }
        }

        if (! SettingsActivity.checkSettings(this,false,true)) return false;

        File trackDir=new File(AvnUtil.getWorkDir(sharedPrefs,this),"tracks");
        Intent intent = new Intent(this, GpsService.class);
        intent.putExtra(GpsService.PROP_TRACKDIR, trackDir.getAbsolutePath());
        if (Build.VERSION.SDK_INT >= 26){
            startForegroundService(intent);
        }
        else {
            startService(intent);
        }
        bindService(intent,mConnection,BIND_AUTO_CREATE);
        serviceNeedsRestart=false;
        return true;
    }


    private void stopGpsService(boolean unbind){
        if (gpsService !=null){
            gpsService.stopMe(unbind);
        }
        if (unbind) {
            Intent intent = new Intent(this, GpsService.class);
            try {
                unbindService(mConnection);
                stopService(intent);
            }catch (Exception e){}
        }
    }

    /**
     * IDialogHandler
     */
    @Override
    public boolean onCancel(int dialogId) {
        return true;
    }

    @Override
    public boolean onOk(int dialogId) {
        return true;
    }

    @Override
    public boolean onNeutral(int dialogId) {
        return true;
    }

    /**
     * end IDialogHandler
     */


    public void showSettings(boolean initial){
        serviceNeedsRestart=true;
        Intent sintent= new Intent(this,SettingsActivity.class);
        sintent.putExtra(Constants.EXTRA_INITIAL,initial);
        startActivityForResult(sintent,Constants.SETTINGS_REQUEST);
    }

    //to be called e.g. from js
    public void goBack(){
        try {
            DialogBuilder.confirmDialog(this, 0, R.string.endApplication, new DialogInterface.OnClickListener() {
                @Override
                public void onClick(DialogInterface dialog, int which) {
                    if (which == DialogInterface.BUTTON_POSITIVE){
                        endApp();
                    }
                }
            });
        } catch(Throwable i){
            //sometime a second call (e.g. when the JS code was too slow) will throw an exception
            Log.e(AvnLog.LOGPREFIX,"exception in goBack:"+i.getLocalizedMessage());
        }
    }

    private void endApp(){
        exitRequested=true;
        finish();
    }



    /** Defines callbacks for service binding, passed to bindService() */
    private ServiceConnection mConnection = new ServiceConnection() {

        @Override
        public void onServiceConnected(ComponentName className,
                                       IBinder service) {
            // We've bound to LocalService, cast the IBinder and get LocalService instance
            GpsService.GpsServiceBinder binder = (GpsService.GpsServiceBinder) service;
            gpsService = binder.getService();
            if (gpsService !=null) {
                gpsService.setMediaUpdater(MainActivity.this);
            }
            AvnLog.d(Constants.LOGPRFX, "gps service connected");

        }

        @Override
        public void onServiceDisconnected(ComponentName arg0) {
            gpsService=null;
            AvnLog.d(Constants.LOGPRFX,"gps service disconnected");
        }
    };

    @Override
    protected void onStart() {
        super.onStart();

    }

    @Override
    protected void onStop() {
        super.onStop();
        //stopGpsService(false);
        if (requestHandler != null) requestHandler.stop();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        running=false;
        serviceNeedsRestart = true;
        if  (broadCastReceiverStop != null){
            unregisterReceiver(broadCastReceiverStop);
        }
        if (reloadReceiver != null){
            unregisterReceiver(reloadReceiver);
        }
        if (exitRequested) {
            stopGpsService(true);
            System.exit(0);
        }
        else{
            AvnLog.e("main unintentionally stopped");
            Intent intent = new Intent(this, GpsService.class);
            try {
                unbindService(mConnection);
            }catch (Exception e){}
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (running) return;
        setContentView(R.layout.viewcontainer);
        mToolbar=new ActionBarHandler(this,R.menu.main_activity_actions);
        sharedPrefs=getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        PreferenceManager.setDefaultValues(this,Constants.PREFNAME,Context.MODE_PRIVATE, R.xml.expert_preferences, false);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        assetManager=getAssets();
        serviceNeedsRestart=true;
        sharedPrefs.registerOnSharedPreferenceChangeListener(this);
        IntentFilter filterStop=new IntentFilter(Constants.BC_STOPAPPL);
        broadCastReceiverStop=new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                AvnLog.i("received stop appl");
                MainActivity.this.exitRequested=true;
                MainActivity.this.finish();

            }
        };
        registerReceiver(broadCastReceiverStop,filterStop);
        reloadReceiver =new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                sendEventToJs(Constants.JS_RELOAD,1);
            }
        };
        IntentFilter triggerFilter=new IntentFilter((Constants.BC_RELOAD_DATA));
        registerReceiver(reloadReceiver,triggerFilter);
        running=true;
    }

    void hideToolBar(){
        if (mToolbar != null) mToolbar.hide();
    }
    @Override
    public void onSharedPreferenceChanged(SharedPreferences sharedPreferences, String key) {
        if (! key.equals(Constants.WAITSTART)) serviceNeedsRestart = true;
        Log.d(Constants.LOGPRFX, "preferences changed");
        if (key.equals(Constants.WORKDIR)){
            updateWorkDir(AvnUtil.getWorkDir(sharedPreferences,this));
        }
        if (key.equals(Constants.CHARTDIR)){
            updateWorkDir(sharedPreferences.getString(Constants.CHARTDIR,""));
        }
    }

    private void updateWorkDir(String dirname){
        if (dirname == null || dirname.isEmpty()) return;
        updateWorkDir(new File(dirname));
    }

    private void updateWorkDir(File workDir){
        if (workDir == null) return;
        final File baseDir=workDir;
        if (! baseDir.isDirectory()) return;
        Thread initialUpdater=new Thread(new Runnable() {
            @Override
            public void run() {
                if (!baseDir.isDirectory()) return;
                for (File uf: baseDir.listFiles()){
                    if (uf.isFile() && uf.exists()) triggerUpdateMtp(uf);
                    if (uf.isDirectory()) {
                        for (File df : uf.listFiles()) {
                            if (df.exists() && df.isFile()) triggerUpdateMtp(df);
                        }
                    }
                }
            }
        });
        initialUpdater.start();
    }

    @Override
    protected void onPause() {
        super.onPause();
        AvnLog.d("main: pause");
    }

    @Override
    protected void onResume() {
        super.onResume();
        AvnLog.d("main: onResume");
        if (!SettingsActivity.checkSettings(this,false,false)){
            showSettings(true);
            return;
        }
        if (! handleRestart()){
            showSettings(true);
            return;
        }
        updateWorkDir(AvnUtil.getWorkDir(null,this));
        updateWorkDir(sharedPrefs.getString(Constants.CHARTDIR,""));
        if (requestHandler != null) {
            requestHandler.stop();
            requestHandler=null;
        }
        requestHandler=new RequestHandler(this);
        startFragmentOrActivity(false);
    }

    private boolean handleRestart(){
        if (!serviceNeedsRestart) return true;
        AvnLog.d(Constants.LOGPRFX,"MainActivity:onResume serviceRestart");
        stopGpsService(false);
        sendEventToJs(Constants.JS_RELOAD,0);
        return startGpsService();
    }

    /**
     * when the activity becomes visible (onResume) we either
     * start a fragment or we go to a new activity (like settings)
     */
    void startFragmentOrActivity(boolean forceSettings){
        String mode=sharedPrefs.getString(Constants.RUNMODE, "");
        boolean startPendig=sharedPrefs.getBoolean(Constants.WAITSTART, false);
        if (mode.isEmpty() || startPendig || forceSettings){
            //TODO: show info dialog
            lastStartMode=null;
            showSettings(false);
            return;
        }
        if (lastStartMode == null || !lastStartMode.equals(mode)){
            sharedPrefs.edit().putBoolean(Constants.WAITSTART,true).commit();
            FragmentManager fragmentManager = getFragmentManager();
            FragmentTransaction fragmentTransaction = fragmentManager.beginTransaction();
            //TODO: select right fragment based on mode
            Fragment fragment=null;
            if (mode.equals(Constants.MODE_SERVER)){
                fragment= new WebServerFragment();
            }
            if (fragment == null) {
                fragment=new WebViewFragment();
            }
            fragmentTransaction.replace(R.id.webmain, fragment);
            fragmentTransaction.commit();
            lastStartMode=mode;
        }
        else{
            sendEventToJs(Constants.JS_PROPERTY_CHANGE,0); //this will some pages cause to reload...
        }
    }

    @Override
    public void onBackPressed(){
        Fragment current=getFragmentManager().findFragmentById(R.id.webmain);
        if (current instanceof WebViewFragment){
            ((WebViewFragment) current).onBackPressed();
            return;
        }
        goBack();
    }


    /**
     * @param key
     * @param id
     */
    public void sendEventToJs(String key, int id){
        Fragment current=getFragmentManager().findFragmentById(R.id.webmain);
        if (current instanceof WebViewFragment){
            ((WebViewFragment)current).sendEventToJs(key,id);
        }
    }


    public RequestHandler getRequestHandler(){
        return requestHandler;
    }

    @Override
    public void triggerUpdateMtp(File file) {
        if (mediaUpdateHandler == null )return;
        Message msg=mediaUpdateHandler.obtainMessage();
        msg.obj=file;
        Log.d(Constants.LOGPRFX,"mtp update for "+file);
        mediaUpdateHandler.sendMessage(msg);
    }
    public GpsService getGpsService() {
        return gpsService;
    }


}
