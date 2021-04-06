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
import android.content.pm.PackageManager;
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

import java.io.File;
import java.util.List;

import de.wellenvogel.avnav.appapi.RequestHandler;
import de.wellenvogel.avnav.settings.SettingsActivity;
import de.wellenvogel.avnav.util.ActionBarHandler;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.util.DialogBuilder;
import de.wellenvogel.avnav.worker.GpsService;

import static de.wellenvogel.avnav.settings.SettingsActivity.checkSettings;

/**
 * Created by andreas on 06.01.15.
 */
public class MainActivity extends Activity implements IDialogHandler, IMediaUpdater, SharedPreferences.OnSharedPreferenceChangeListener, GpsService.MainActivityActions {
    //The last mode we used to select the fragment
    SharedPreferences sharedPrefs;
    protected final Activity activity=this;
    AssetManager assetManager;
    GpsService gpsService=null;
    private ActionBarHandler mToolbar;
    private boolean fragmentStarted=false;

    public ActionBarHandler getToolbar(){
        return mToolbar;
    }
    private boolean exitRequested=false;
    private boolean running=false;
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
                serviceNeedsRestart=true;
                break;
            default:
                AvnLog.e("unknown activity result " + requestCode);
        }
    }

    private GpsService.GpsServiceBinder binder;
    private Runnable bindAction;

    /** Defines callbacks for service binding, passed to bindService() */
    private ServiceConnection mConnection = new ServiceConnection() {

        @Override
        public void onServiceConnected(ComponentName className,
                                       IBinder service) {
            // We've bound to LocalService, cast the IBinder and get LocalService instance
            binder = (GpsService.GpsServiceBinder) service;
            gpsService = binder.getService();
            if (gpsService !=null) {
                gpsService.setMediaUpdater(MainActivity.this);
                if (bindAction != null){
                    bindAction.run();
                    bindAction=null;
                }
            }
            binder.registerCallback(MainActivity.this);
            AvnLog.d(Constants.LOGPRFX, "gps service connected");

        }

        @Override
        public void onServiceDisconnected(ComponentName arg0) {
            gpsService=null;
            if (binder != null) binder.deregisterCallback();
            binder=null;
            AvnLog.d(Constants.LOGPRFX,"gps service disconnected");
        }

    };
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

        if (! checkSettings(this,false,true)) return false;

        Intent intent = new Intent(this, GpsService.class);
        if (Build.VERSION.SDK_INT >= 26){
            startForegroundService(intent);
        }
        else {
            startService(intent);
        }
        serviceNeedsRestart=false;
        return true;
    }


    private void stopGpsService(){
        GpsService service=gpsService;
        if (service !=null){
            binder.deregisterCallback();
            gpsService=null;
            service.stopMe();
        }
        Intent intent = new Intent(this, GpsService.class);
        try {
             unbindService(mConnection);
             stopService(intent);
        }catch (Exception e){}

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
        Intent sintent= new Intent(this,SettingsActivity.class);
        sintent.putExtra(Constants.EXTRA_INITIAL,initial);
        startActivityForResult(sintent,Constants.SETTINGS_REQUEST);
    }

    @Override
    public void mainGoBack() {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                goBack();
            }
        });
    }

    @Override
    public void mainShutdown() {
        if (!exitRequested){
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try{
                        finishActivity(Constants.SETTINGS_REQUEST);
                    }catch(Throwable t){}
                    MainActivity.this.finish();
                }
            });
        }
    }

    //to be called e.g. from js
    public void goBack(){
        try {
            DialogBuilder builder=new DialogBuilder(this,R.layout.dialog_confirm);
            builder.createDialog();
            builder.setText(R.id.title,0);
            builder.setText(R.id.question,R.string.endApplication);
            builder.setButton(R.string.ok,DialogInterface.BUTTON_POSITIVE);
            builder.setButton(R.string.background,DialogInterface.BUTTON_NEUTRAL);
            builder.setButton(R.string.cancel,DialogInterface.BUTTON_NEGATIVE);
            builder.setOnClickListener(new DialogInterface.OnClickListener() {
                @Override
                public void onClick(DialogInterface dialog, int which) {
                    dialog.dismiss();
                    if (which == DialogInterface.BUTTON_POSITIVE){
                        endApp();
                    }
                    if (which == DialogInterface.BUTTON_NEUTRAL){
                        finish();
                    }
                }
            });
            builder.show();
        } catch(Throwable i){
            //sometime a second call (e.g. when the JS code was too slow) will throw an exception
            Log.e(AvnLog.LOGPREFIX,"exception in goBack:"+i.getLocalizedMessage());
        }
    }

    private void endApp(){
        exitRequested=true;
        finish();
    }



    @Override
    protected void onStart() {
        super.onStart();

    }

    @Override
    protected void onStop() {
        super.onStop();
        //stopGpsService(false);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        running=false;
        if (reloadReceiver != null){
            unregisterReceiver(reloadReceiver);
        }
        try {
            unbindService(mConnection);
        }catch (Exception e){}
        if (exitRequested) {
            stopGpsService();
            //System.exit(0);
        }
        else{
            AvnLog.e("main stopped");
        }
        gpsService=null;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (running) return;
        setContentView(R.layout.viewcontainer);
        mToolbar=new ActionBarHandler(this,R.menu.main_activity_actions);
        sharedPrefs=getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        PreferenceManager.setDefaultValues(this,Constants.PREFNAME,Context.MODE_PRIVATE, R.xml.sound_preferences, false);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        assetManager=getAssets();
        sharedPrefs.registerOnSharedPreferenceChangeListener(this);
        reloadReceiver =new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                sendEventToJs(Constants.JS_RELOAD,1);
            }
        };
        IntentFilter triggerFilter=new IntentFilter((Constants.BC_RELOAD_DATA));
        registerReceiver(reloadReceiver,triggerFilter);
        running=true;
        Intent intent = new Intent(this, GpsService.class);
        bindService(intent,mConnection,0);
    }

    void hideToolBar(){
        if (mToolbar != null) mToolbar.hide();
    }
    @Override
    public void onSharedPreferenceChanged(SharedPreferences sharedPreferences, String key) {
        Log.d(Constants.LOGPRFX, "preferences changed");
        if (key.equals(Constants.WORKDIR)){
            updateWorkDir(AvnUtil.getWorkDir(sharedPreferences,this));
            serviceNeedsRestart=true;
        }
        if (key.equals(Constants.CHARTDIR)){
            updateWorkDir(sharedPreferences.getString(Constants.CHARTDIR,""));
            serviceNeedsRestart=true;
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
    /**
     * check the current settings
     */
    private void handleInitialSettings(){
        final SharedPreferences sharedPrefs = getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        final SharedPreferences.Editor e=sharedPrefs.edit();
        if (! sharedPrefs.contains(Constants.ALARMSOUNDS)){
            e.putBoolean(Constants.ALARMSOUNDS,true);
        }
        String workdir=sharedPrefs.getString(Constants.WORKDIR, "");
        String chartdir=sharedPrefs.getString(Constants.CHARTDIR, "");
        if (workdir.isEmpty()){
            workdir=Constants.INTERNAL_WORKDIR;
        }
        e.putString(Constants.WORKDIR, workdir);
        e.putString(Constants.CHARTDIR, chartdir);
        e.apply();
        try {
            int version = getPackageManager()
                    .getPackageInfo(getPackageName(), 0).versionCode;
            if (sharedPrefs.getInt(Constants.VERSION,-1)!= version){
                e.putInt(Constants.VERSION,version);
            }
        } catch (Exception ex) {
        }
        e.commit();
    }

    private boolean checkForInitialDialogs(){
        boolean showsDialog=false;
        SharedPreferences sharedPrefs = getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        int oldVersion=sharedPrefs.getInt(Constants.VERSION, -1);
        boolean startPendig=sharedPrefs.getBoolean(Constants.WAITSTART, false);
        int version=0;
        try {
            version = getPackageManager()
                    .getPackageInfo(getPackageName(), 0).versionCode;
        } catch (PackageManager.NameNotFoundException e) {
        }
        if (oldVersion < 0 || startPendig) {
            showsDialog=true;
            int title;
            int message;
            if (startPendig) {
                title=R.string.somethingWrong;
                message=R.string.somethingWrongMessage;
            } else {
                handleInitialSettings();
                title=R.string.firstStart;
                message=R.string.firstStartMessage;
            }
            DialogBuilder.alertDialog(this,title,message, new DialogInterface.OnClickListener(){
                @Override
                public void onClick(DialogInterface dialog, int which) {
                        showSettings(false);
                }
            });
            if (startPendig)sharedPrefs.edit().putBoolean(Constants.WAITSTART,false).commit();
        }
        if (showsDialog) return true;
        if (version != 0 ){
            try {
                int lastVersion = sharedPrefs.getInt(Constants.VERSION, 0);
                //TODO: handle other version changes
                if (lastVersion <20210406 ){
                    final int newVersion=version;
                    showsDialog=true;
                    DialogBuilder builder=new DialogBuilder(this,R.layout.dialog_confirm);
                    builder.setTitle(R.string.newVersionTitle);
                    builder.setText(R.id.question,R.string.newVersionMessage);
                    builder.setPositiveButton(android.R.string.ok, new DialogInterface.OnClickListener() {
                        @Override
                        public void onClick(DialogInterface dialog, int which) {
                            sharedPrefs.edit().putInt(Constants.VERSION,newVersion).commit();
                            onResumeInternal();
                        }
                    });
                    builder.setNegativeButton(android.R.string.cancel, new DialogInterface.OnClickListener() {
                        @Override
                        public void onClick(DialogInterface dialog, int which) {
                            endApp();
                        }
                    });
                    builder.show();
                }
            }catch (Exception e){}
        }
        return showsDialog;
    }

    @Override
    protected void onPause() {
        super.onPause();
        AvnLog.d("main: pause");
    }

    private void onResumeInternal(){
        if (!checkSettings(this, false, false)) {
            showSettings(true);
            return;
        }
        updateWorkDir(AvnUtil.getWorkDir(null, this));
        updateWorkDir(sharedPrefs.getString(Constants.CHARTDIR, ""));
        if (gpsService == null) {
            bindAction = new Runnable() {
                @Override
                public void run() {
                    if (! fragmentStarted) {
                        startFragment();
                        fragmentStarted=true;
                    }
                }
            };
            startGpsService();
            return;
        }
        if (serviceNeedsRestart) {
            gpsService.restart();
            serviceNeedsRestart=false;
            AvnLog.d(Constants.LOGPRFX, "MainActivity:onResume serviceRestart");
        }
        if (!fragmentStarted) {
            startFragment();
            fragmentStarted=true;
        } else {
            sendEventToJs(Constants.JS_PROPERTY_CHANGE, 0); //this will some pages cause to reload...
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        AvnLog.d("main: onResume");
        if (! checkForInitialDialogs()){
            onResumeInternal();
        }
    }



    private void startFragment(){
        sharedPrefs.edit().putBoolean(Constants.WAITSTART,true).commit();
        FragmentManager fragmentManager = getFragmentManager();
        FragmentTransaction fragmentTransaction = fragmentManager.beginTransaction();
        Fragment fragment=new WebViewFragment();
        fragmentTransaction.replace(R.id.webmain, fragment);
        fragmentTransaction.commit();
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
        GpsService service=getGpsService();
        return service!=null?service.getRequestHandler():null;
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
