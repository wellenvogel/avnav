package de.wellenvogel.avnav.main;

import android.app.Activity;
import android.app.Fragment;
import android.app.FragmentManager;
import android.app.FragmentTransaction;
import android.content.ComponentName;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.location.LocationManager;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.IBinder;
import android.os.Message;
import android.preference.PreferenceManager;
import android.provider.Settings;
import android.util.Log;
import android.view.WindowManager;
import android.widget.Toast;

import org.xwalk.core.XWalkActivity;

import java.io.File;
import java.net.InetSocketAddress;

import de.wellenvogel.avnav.gps.BluetoothPositionHandler;
import de.wellenvogel.avnav.gps.GpsDataProvider;
import de.wellenvogel.avnav.gps.GpsService;
import de.wellenvogel.avnav.gps.UsbSerialPositionHandler;
import de.wellenvogel.avnav.settings.SettingsActivity;
import de.wellenvogel.avnav.util.ActionBarHandler;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.DialogBuilder;

/**
 * Created by andreas on 06.01.15.
 */
public class MainActivity extends XWalkActivity implements IDialogHandler,IMediaUpdater,SharedPreferences.OnSharedPreferenceChangeListener, ICallback {

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
    private IJsEventHandler jsEventHandler;
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

    Handler backHandler=new Handler() {
        @Override
        public void handleMessage(Message msg) {
            super.handleMessage(msg);
            MainActivity.this.goBack();
        }
    };

    //asynchronously trigger a restart
    //used when returning from dialogs
    //msg.what == 1 - force settings again
    private Handler restartHandler=new Handler(){
        @Override
        public void handleMessage(Message msg) {
            super.handleMessage(msg);
            MainActivity.this.handleRestart(msg.what == 1,false);
        }
    };


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
        if (requestCode != Constants.ROUTE_OPEN_REQUEST) return;
        if (resultCode != RESULT_OK) {
            // Exit without doing anything else
            return;
        } else {
            Uri returnUri = data.getData();
            if (requestHandler != null) requestHandler.saveRoute(returnUri);
        }
    }

    private boolean startGpsService(){


        if (! sharedPrefs.getBoolean(Constants.BTNMEA,false) &&
                ! sharedPrefs.getBoolean(Constants.IPNMEA,false) &&
                ! sharedPrefs.getBoolean(Constants.INTERNALGPS,false)){
            Toast.makeText(this, R.string.noGpsSelected, Toast.LENGTH_SHORT).show();
            return false;
        }
        if (sharedPrefs.getBoolean(Constants.IPAIS,false)||sharedPrefs.getBoolean(Constants.IPNMEA, false)) {
            try {
                InetSocketAddress addr = GpsDataProvider.convertAddress(
                        sharedPrefs.getString(Constants.IPADDR, ""),
                        sharedPrefs.getString(Constants.IPPORT, ""));
            } catch (Exception i) {
                Toast.makeText(this, R.string.invalidIp, Toast.LENGTH_SHORT).show();
                return false;
            }
        }
        if (sharedPrefs.getBoolean(Constants.BTAIS,false)||sharedPrefs.getBoolean(Constants.BTNMEA,false)){
            String btdevice=sharedPrefs.getString(Constants.BTDEVICE,"");
            if (BluetoothPositionHandler.getDeviceForName(btdevice) == null){
                Toast.makeText(this, getText(R.string.noSuchBluetoothDevice)+":"+btdevice, Toast.LENGTH_SHORT).show();
                return false;
            }
        }
        if (sharedPrefs.getBoolean(Constants.USBAIS,false)||sharedPrefs.getBoolean(Constants.USBAIS,false)){
            String usbDevice=sharedPrefs.getString(Constants.USBDEVICE,"");
            if (UsbSerialPositionHandler.getDeviceForName(this,usbDevice) == null){
                Toast.makeText(this, getText(R.string.noSuchUsbDevice)+":"+usbDevice, Toast.LENGTH_SHORT).show();
                return false;
            }
        }
        if (sharedPrefs.getBoolean(Constants.INTERNALGPS,false)) {
            LocationManager locationService = (LocationManager) getSystemService(LOCATION_SERVICE);
            boolean enabled = locationService.isProviderEnabled(LocationManager.GPS_PROVIDER);

            // check if enabled and if not send user to the GSP settings
            // Better solution would be to display a dialog and suggesting to
            // go to the settings
            if (!enabled) {
                DialogBuilder.confirmDialog(this, 0, R.string.noLocation, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        if (which == DialogInterface.BUTTON_POSITIVE){
                            Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
                            startActivity(intent);
                        }
                    }
                });
            }
        }
        File trackDir=new File(sharedPrefs.getString(Constants.WORKDIR,""),"tracks");
        Intent intent = new Intent(this, GpsService.class);
        intent.putExtra(GpsService.PROP_TRACKDIR, trackDir.getAbsolutePath());
        //TODO: add other parameters here
        startService(intent);
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
        if (dialogId == XwalkDownloadHandler.DIALOGID){
            sharedPrefs.edit().putString(Constants.RUNMODE,Constants.MODE_NORMAL).commit();
            if (serviceNeedsRestart) {
                stopGpsService(false);
                startGpsService();
            }
            startFragmentOrActivity(false);

        }
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


    void showSettings(){
        serviceNeedsRestart=true;
        Intent sintent= new Intent(this,SettingsActivity.class);
        startActivity(sintent);
    }

    //to be called e.g. from js
    void goBack(){
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
            if (gpsService !=null) gpsService.setMediaUpdater(MainActivity.this);
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
        stopGpsService(true);
        serviceNeedsRestart=true;
        System.exit(0);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.viewcontainer);
        mToolbar=new ActionBarHandler(this,R.menu.main_activity_actions);
        sharedPrefs=getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        PreferenceManager.setDefaultValues(this,Constants.PREFNAME,Context.MODE_PRIVATE, R.xml.expert_preferences, false);
        workdir=sharedPrefs.getString(Constants.WORKDIR, Environment.getExternalStorageDirectory().getAbsolutePath() + "/avnav");
        workBase=new File(workdir);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        assetManager=getAssets();
        serviceNeedsRestart=true;
        if (gpsService == null) {
            Intent intent = new Intent(this, GpsService.class);
            intent.putExtra(GpsService.PROP_CHECKONLY, true);
            startService(intent);
            bindService(intent, mConnection, Context.BIND_AUTO_CREATE);
        }
        requestHandler=new RequestHandler(this);
        sharedPrefs.registerOnSharedPreferenceChangeListener(this);
        updateWorkDir(workBase);
        updateWorkDir(new File(sharedPrefs.getString(Constants.CHARTDIR, "")));
    }
    @Override
    public void onSharedPreferenceChanged(SharedPreferences sharedPreferences, String key) {
        serviceNeedsRestart = true;
        Log.d(Constants.LOGPRFX, "preferences changed");
        if (key.equals(Constants.WORKDIR)){
            updateWorkDir(new File(sharedPreferences.getString(Constants.WORKDIR,"")));
        }
        if (key.equals(Constants.CHARTDIR)){
            updateWorkDir(new File(sharedPreferences.getString(Constants.CHARTDIR,"")));
        }
    }

    private void updateWorkDir(File workDir){
        final File baseDir=workDir;
        if (! baseDir.isDirectory()) return;
        Thread initialUpdater=new Thread(new Runnable() {
            @Override
            public void run() {
                if (baseDir.isDirectory()) return;
                triggerUpdateMtp(baseDir);
                for (File uf: baseDir.listFiles()){
                    if (uf.exists()) triggerUpdateMtp(uf);
                    if (uf.isDirectory()) {
                        for (File df : uf.listFiles()) {
                            triggerUpdateMtp(df);
                        }
                    }
                }
            }
        });
        initialUpdater.start();
    }

    @Override
    protected void onResume() {
        super.onResume();
        int version=0;
        boolean startSomething=true;
        SharedPreferences sharedPrefs = getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        String mode=sharedPrefs.getString(Constants.RUNMODE, "");
        boolean startPendig=sharedPrefs.getBoolean(Constants.WAITSTART, false);
        if (mode.isEmpty() || startPendig) {
            startSomething=false;
            int title;
            int message;
            if (startPendig) {
                title=R.string.somethingWrong;
                message=R.string.somethingWrongMessage;
            } else {
                title=R.string.firstStart;
                message=R.string.firstStartMessage;
            }
            DialogBuilder.alertDialog(this,title,message, new DialogInterface.OnClickListener(){
                @Override
                public void onClick(DialogInterface dialog, int which) {
                    if (which == DialogInterface.BUTTON_POSITIVE){
                        handleRestart(true,false);
                    }
                }
            });
            if (startPendig)sharedPrefs.edit().putBoolean(Constants.WAITSTART,false).commit();
        }
        try {
            version = getPackageManager()
                    .getPackageInfo(getPackageName(), 0).versionCode;
        } catch (PackageManager.NameNotFoundException e) {
        }
        if (! startSomething) return;
        if (version != 0 ){
            try {
                int lastVersion = sharedPrefs.getInt(Constants.VERSION, 0);
                //TODO: handle other version changes
                if (lastVersion == 0 ){
                    sharedPrefs.edit().putInt(Constants.VERSION,version).commit();
                    startSomething=false;
                    DialogBuilder builder=new DialogBuilder(this,R.layout.dialog_confirm);
                    builder.setTitle(R.string.newVersionTitle);
                    builder.setText(R.id.question,R.string.newVersionMessage);
                    builder.setNegativeButton(R.string.settings, new DialogInterface.OnClickListener() {
                        @Override
                        public void onClick(DialogInterface dialog, int which) {
                            handleRestart(true,false);
                        }
                    });
                    builder.setPositiveButton(android.R.string.ok, new DialogInterface.OnClickListener() {
                        @Override
                        public void onClick(DialogInterface dialog, int which) {
                            handleRestart(false,false);
                        }
                    });
                    builder.show();
                }
            }catch (Exception e){}
        }
        if (! startSomething) return;
        handleRestart(false,false);
    }

    private void handleRestart(boolean forceSettings, boolean noSettings){
        if (serviceNeedsRestart) Log.d(Constants.LOGPRFX,"MainActivity:onResume serviceRestart");
        if (serviceNeedsRestart) stopGpsService(false);
        boolean startSomething=true;
        if (! noSettings) startSomething=SettingsActivity.handleInitialSettings(this, this);
        if (serviceNeedsRestart) {
            if (! startGpsService()) forceSettings=true;
        }
        requestHandler.update();
        if (startSomething) startFragmentOrActivity(forceSettings);
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
            jsEventHandler=null;
            showSettings();
            return;
        }
        if (lastStartMode == null || !lastStartMode.equals(mode)){
            sharedPrefs.edit().putBoolean(Constants.WAITSTART,true).commit();
            jsEventHandler=null;
            FragmentManager fragmentManager = getFragmentManager();
            FragmentTransaction fragmentTransaction = fragmentManager.beginTransaction();
            //TODO: select right fragment based on mode
            Fragment fragment=null;
            if (mode.equals(Constants.MODE_XWALK)){
                fragment= new XwalkFragment();
            }
            if (mode.equals(Constants.MODE_SERVER)){
                fragment= new WebServerFragment();
            }
            if (fragment == null) fragment=new WebViewFragment();
            fragmentTransaction.replace(R.id.webmain, fragment);
            fragmentTransaction.commit();
            lastStartMode=mode;
        }
        else{
            sendEventToJs("propertyChange",0); //this will some pages cause to reload...
        }
    }

    @Override
    public void onBackPressed(){
        final int num=goBackSequence+1;
        sendEventToJs("backPressed",num);
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
                    backHandler.sendEmptyMessage(1);
                }
            }
        });
        waiter.start();
    }

    /**
     * @param key
     * @param id
     */
    void sendEventToJs(String key, int id){
        if (jsEventHandler != null) jsEventHandler.sendEventToJs(key,id);
    }

    public void registerJsEventHandler(IJsEventHandler handler){
        jsEventHandler=handler;
    }
    public void deregisterJsEventHandler(IJsEventHandler handler){
        if (jsEventHandler == handler) jsEventHandler=null;
    }

    public void resetMode(){
        //ensure that we start with a settings dialog
        sharedPrefs.edit().putString(Constants.RUNMODE,"").commit();
    }

    RequestHandler getRequestHandler(){
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

    //called back from file dialog in settings
    //1 - force settings again
    //0 - normal
    @Override
    public void callback(int id) {
        restartHandler.sendEmptyMessage(id);
    }
}
