package de.wellenvogel.avnav.main;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.Fragment;
import android.app.FragmentManager;
import android.app.FragmentTransaction;
import android.content.*;
import android.content.res.AssetManager;
import android.content.res.Resources;
import android.location.LocationManager;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.util.Log;
import android.view.WindowManager;
import android.webkit.*;
import android.widget.Toast;

import de.wellenvogel.avnav.gps.BluetoothPositionHandler;
import de.wellenvogel.avnav.gps.GpsDataProvider;
import de.wellenvogel.avnav.gps.GpsService;
import de.wellenvogel.avnav.gps.RouteHandler;
import de.wellenvogel.avnav.settings.SettingsActivity;
import de.wellenvogel.avnav.util.AvnLog;

import org.xwalk.core.XWalkActivity;

import java.io.*;
import java.net.InetSocketAddress;
import java.text.SimpleDateFormat;
import java.util.HashMap;

/**
 * Created by andreas on 06.01.15.
 */
public class MainActivity extends XWalkActivity implements IDialogHandler,IMediaUpdater{

    private String lastStartMode=null; //The last mode we used to select the fragment
    SharedPreferences sharedPrefs;
    protected final Activity activity=this;
    AssetManager assetManager;
    private String workdir;
    private File workBase;
    GpsService gpsService=null;
    int goBackSequence;
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

    private void startGpsService(){


        if (! sharedPrefs.getBoolean(Constants.BTNMEA,false) &&
                ! sharedPrefs.getBoolean(Constants.IPNMEA,false) &&
                ! sharedPrefs.getBoolean(Constants.INTERNALGPS,false)){
            Toast.makeText(this, R.string.noGpsSelected, Toast.LENGTH_SHORT).show();
            return;
        }
        if (sharedPrefs.getBoolean(Constants.IPAIS,false)||sharedPrefs.getBoolean(Constants.IPNMEA, false)) {
            try {
                InetSocketAddress addr = GpsDataProvider.convertAddress(
                        sharedPrefs.getString(Constants.IPADDR, ""),
                        sharedPrefs.getString(Constants.IPPORT, ""));
            } catch (Exception i) {
                Toast.makeText(this, R.string.invalidIp, Toast.LENGTH_SHORT).show();
                return;
            }
        }
        if (sharedPrefs.getBoolean(Constants.BTAIS,false)||sharedPrefs.getBoolean(Constants.BTNMEA,false)){
            String btdevice=sharedPrefs.getString(Constants.BTDEVICE,"");
            if (BluetoothPositionHandler.getDeviceForName(btdevice) == null){
                Toast.makeText(this, getText(R.string.noSuchBluetoothDevice)+":"+btdevice, Toast.LENGTH_SHORT).show();
                return;
            }
        }
        if (sharedPrefs.getBoolean(Constants.INTERNALGPS,false)) {
            LocationManager locationService = (LocationManager) getSystemService(LOCATION_SERVICE);
            boolean enabled = locationService.isProviderEnabled(LocationManager.GPS_PROVIDER);

            // check if enabled and if not send user to the GSP settings
            // Better solution would be to display a dialog and suggesting to
            // go to the settings
            if (!enabled) {
                AlertDialog.Builder builder = new AlertDialog.Builder(this);
                builder.setMessage(R.string.noLocation);
                builder.setPositiveButton(R.string.ok, new DialogInterface.OnClickListener() {
                    public void onClick(DialogInterface dialog, int id) {
                        // User clicked OK button
                        Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
                        startActivity(intent);
                    }
                });
                builder.setNegativeButton(R.string.cancel, new DialogInterface.OnClickListener() {
                    public void onClick(DialogInterface dialog, int id) {
                        // User cancelled the dialog
                    }
                });
                AlertDialog dialog = builder.create();
                dialog.show();

            }
        }
        File trackDir=new File(sharedPrefs.getString(Constants.WORKDIR,""),"tracks");
        Intent intent = new Intent(this, GpsService.class);
        intent.putExtra(GpsService.PROP_TRACKDIR, trackDir.getAbsolutePath());
        //TODO: add other parameters here
        startService(intent);
        serviceNeedsRestart=false;
    }

    private void stopGpsService(boolean unbind){
        if (gpsService !=null){
            gpsService.stopMe();
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
            //TODO: add dialog
            AlertDialog.Builder builder = new AlertDialog.Builder(this);
            builder.setPositiveButton(android.R.string.ok,
                    new DialogInterface.OnClickListener() {
                        public void onClick(DialogInterface dialog, int id) {
                            MainActivity.this.endApp();
                        }
                    });
            builder.setNegativeButton(android.R.string.cancel,null);
            builder.setMessage(R.string.endApplication);
            AlertDialog alertDialog = builder.create();
            alertDialog.show();
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
        sharedPrefs=getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
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
        sharedPrefs.registerOnSharedPreferenceChangeListener(new SharedPreferences.OnSharedPreferenceChangeListener() {
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
        });
        updateWorkDir(workBase);
        updateWorkDir(new File(sharedPrefs.getString(Constants.CHARTDIR,"")));
    }

    private void updateWorkDir(File workDir){
        final File baseDir=workDir;
        if (! baseDir.isDirectory()) return;
        Thread initialUpdater=new Thread(new Runnable() {
            @Override
            public void run() {
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
        if (serviceNeedsRestart) Log.d(Constants.LOGPRFX,"MainActivity:onResume serviceRestart");
        if (serviceNeedsRestart) stopGpsService(false);
        boolean startSomething=SettingsActivity.handleInitialSettings(this);
        if (serviceNeedsRestart) startGpsService();
        requestHandler.update();
        if (startSomething) startFragmentOrActivity();
    }

    /**
     * when the activity becomes visible (onResume) we either
     * start a fragment or we go to a new activity (like settings)
     */
    void startFragmentOrActivity(){
        String mode=sharedPrefs.getString(Constants.RUNMODE, "");
        boolean startPendig=sharedPrefs.getBoolean(Constants.WAITSTART, false);
        if (mode.isEmpty() || startPendig){
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
}
