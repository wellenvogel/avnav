package de.wellenvogel.avnav.settings;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.preference.*;

import android.provider.Settings;
import android.support.v4.app.ActivityCompat;
import android.support.v4.content.ContextCompat;
import android.util.DisplayMetrics;
import android.view.Menu;
import android.view.MenuInflater;
import android.view.MenuItem;
import android.view.View;
import android.view.ViewGroup;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.Toast;

import java.io.File;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;

import de.wellenvogel.avnav.gps.BluetoothPositionHandler;
import de.wellenvogel.avnav.gps.GpsDataProvider;
import de.wellenvogel.avnav.gps.UsbSerialPositionHandler;
import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.Info;
import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.main.XwalkDownloadHandler;
import de.wellenvogel.avnav.util.ActionBarHandler;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.util.DialogBuilder;

import static de.wellenvogel.avnav.main.Constants.MODE_INTERNAL;
import static de.wellenvogel.avnav.main.Constants.MODE_NORMAL;

/**
 * Created by andreas on 03.09.15.
 */

public class SettingsActivity extends PreferenceActivity {
    public static interface ActivityResultCallback{
        /**
         * called on activity result
         * @param requestCode
         * @param resultCode
         * @param data
         * @return if true - result is handled
         */
        public boolean onActivityResult(int requestCode, int resultCode, Intent data);
    }

    private HashSet<ActivityResultCallback> callbacks=new HashSet<ActivityResultCallback>();

    private List<Header> headers=null;
    private static final int currentapiVersion = android.os.Build.VERSION.SDK_INT;
    private ActionBarHandler mToolbar;


    public ActionBarHandler getToolbar(){
        if (mToolbar != null) return mToolbar;
        View tbv=findViewById(R.id.toolbar);
        mToolbar=new ActionBarHandler(this,R.menu.settings_activity_actions);
        return mToolbar;
    }

    private void injectToolbar(){
        ViewGroup root = (ViewGroup) findViewById(android.R.id.content);
        LinearLayout content = (LinearLayout) root.getChildAt(0);
        LinearLayout toolbarContainer = (LinearLayout) View.inflate(this, R.layout.settings, null);
        root.removeAllViews();
        toolbarContainer.addView(content);
        root.addView(toolbarContainer);
    }
    @Override
    public boolean isValidFragment(String n){
        return true;
    }

    private static void handleMigrations(Activity activity){
        SharedPreferences sharedPrefs=activity.getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor edit=sharedPrefs.edit();
        String mode=sharedPrefs.getString(Constants.RUNMODE,"");
        if (mode.equals(Constants.MODE_XWALK)){
            AvnLog.i("changing xwalk mode to normal");
            edit.putString(Constants.RUNMODE,Constants.MODE_NORMAL).apply();
        }
        String workDir=sharedPrefs.getString(Constants.WORKDIR,"");
        if (! workDir.isEmpty()){
            try {
                String internal = activity.getFilesDir().getCanonicalPath();
                String external = activity.getExternalFilesDir(null).getCanonicalPath();
                if (workDir.equals(internal)){
                    edit.putString(Constants.WORKDIR,Constants.INTERNAL_WORKDIR);
                    AvnLog.i("migrating workdir to internal");
                }
                if (workDir.equals(external)){
                    edit.putString(Constants.WORKDIR,Constants.EXTERNAL_WORKDIR);
                    AvnLog.i("migrating workdir to external");
                }
            }catch(IOException e){
                AvnLog.e("Exception while migrating workdir",e);
            }
        }
        edit.apply();
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        injectToolbar();
        getToolbar().setOnMenuItemClickListener(this);
        //migrate if there was Xwalk
        SharedPreferences sharedPrefs=getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        String mode=sharedPrefs.getString(Constants.RUNMODE,"");
        if (mode.equals(Constants.MODE_XWALK)){
            AvnLog.i("changing xwalk mode to normal");
            sharedPrefs.edit().putString(Constants.RUNMODE,Constants.MODE_NORMAL).apply();
        }
        updateHeaderSummaries(true);
        if (checkForInitialDialogs()){
            return;
        }
        checkSettings(this,true,true);
    }

    public static boolean checkStoragePermission(final Activity activity,boolean doRequest, boolean showToasts){
        if (Build.VERSION.SDK_INT < 23) return true;
        if (ContextCompat.checkSelfPermission(activity, Manifest.permission.READ_EXTERNAL_STORAGE) !=
                PackageManager.PERMISSION_GRANTED) {
            SharedPreferences prefs = activity.getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
            boolean alreadyAsked=prefs.getBoolean(Constants.STORAGE_PERMISSION_REQUESTED,false);
            if ((! alreadyAsked || ActivityCompat.shouldShowRequestPermissionRationale(activity,Manifest.permission.READ_EXTERNAL_STORAGE) )&& doRequest)
            {
                prefs.edit().putBoolean(Constants.STORAGE_PERMISSION_REQUESTED,true).apply();
                activity.requestPermissions(new String[]{Manifest.permission.READ_EXTERNAL_STORAGE}, 99);
                return false;
            }
            if (showToasts)Toast.makeText(activity,R.string.needsStoragePermisssions,Toast.LENGTH_LONG).show();
            return false;

        }
        return true;
    }

    public static boolean checkGpsEnabled(final Activity activity, boolean force,boolean doRequest,boolean showToasts) {
        SharedPreferences prefs = activity.getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        if (! force) {
            String nmeaMode = NmeaSettingsFragment.getNmeaMode(prefs);
            if (!nmeaMode.equals(MODE_INTERNAL)) return true;
        }
        LocationManager locationService = (LocationManager) activity.getSystemService(activity.LOCATION_SERVICE);
        boolean enabled = locationService.isProviderEnabled(LocationManager.GPS_PROVIDER);
        if (Build.VERSION.SDK_INT >= 23) {
            if (ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION) !=
                    PackageManager.PERMISSION_GRANTED) {
                boolean alreadyAsked=prefs.getBoolean(Constants.GPS_PERMISSION_REQUESTED,false);
                if ((! alreadyAsked || ActivityCompat.shouldShowRequestPermissionRationale(activity,Manifest.permission.ACCESS_FINE_LOCATION) )&& doRequest)
                {
                    prefs.edit().putBoolean(Constants.GPS_PERMISSION_REQUESTED,true).apply();
                    activity.requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION}, 99);
                    return false;
                }
                if (showToasts)Toast.makeText(activity,R.string.needsGpsPermisssions,Toast.LENGTH_LONG).show();
                return false;

            }
        }
        // check if enabled and if not send user to the GSP settings
        // Better solution would be to display a dialog and suggesting to
        // go to the settings
        if (!enabled && doRequest) {
            DialogBuilder.confirmDialog(activity, 0, R.string.noLocation, new DialogInterface.OnClickListener() {
                @Override
                public void onClick(DialogInterface dialog, int which) {
                    if (which == DialogInterface.BUTTON_POSITIVE){
                        Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
                        activity.startActivity(intent);
                    }
                }
            });
            return false;
        }
        return true;
    }
    /**
     * check if all settings are correct
     * @param activity
     * @param startDialogs if this is set, start permission or other dialogs, otherwise check only
     * @return true if settings are ok
     */
    public static boolean checkSettings(Activity activity, boolean startDialogs, boolean showToasts){
        handleMigrations(activity);
        SharedPreferences sharedPrefs=activity.getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        if (! sharedPrefs.getBoolean(Constants.BTNMEA,false) &&
                ! sharedPrefs.getBoolean(Constants.IPNMEA,false) &&
                ! sharedPrefs.getBoolean(Constants.INTERNALGPS,false) &&
                ! sharedPrefs.getBoolean(Constants.USBNMEA,false)){
            if (showToasts) Toast.makeText(activity, R.string.noGpsSelected, Toast.LENGTH_SHORT).show();
            return false;
        }
        if (! checkOrCreateWorkDir(AvnUtil.getWorkDir(sharedPrefs,activity))){
            if (showToasts)Toast.makeText(activity, R.string.selectWorkDirWritable, Toast.LENGTH_SHORT).show();
            return false;
        }
        String chartDir=sharedPrefs.getString(Constants.CHARTDIR,"");
        if (! chartDir.isEmpty()){
            //no permissions if below our app dirs
            boolean checkPermissions=true;
            if (chartDir.startsWith(AvnUtil.workdirStringToFile(Constants.INTERNAL_WORKDIR,activity).getAbsolutePath())) checkPermissions=false;
            if (chartDir.startsWith(AvnUtil.workdirStringToFile(Constants.EXTERNAL_WORKDIR,activity).getAbsolutePath())) checkPermissions=false;
            if (checkPermissions){
                if (! checkStoragePermission(activity,startDialogs,showToasts)){
                    return false;
                }
            }
        }
        if (sharedPrefs.getBoolean(Constants.IPAIS,false)||sharedPrefs.getBoolean(Constants.IPNMEA, false)) {
            try {
                InetSocketAddress addr = GpsDataProvider.convertAddress(
                        sharedPrefs.getString(Constants.IPADDR, ""),
                        sharedPrefs.getString(Constants.IPPORT, ""));
            } catch (Exception i) {
                if (showToasts)Toast.makeText(activity, R.string.invalidIp, Toast.LENGTH_SHORT).show();
                return false;
            }
        }
        if (sharedPrefs.getBoolean(Constants.BTAIS,false)||sharedPrefs.getBoolean(Constants.BTNMEA,false)){
            String btdevice=sharedPrefs.getString(Constants.BTDEVICE,"");
            if (BluetoothPositionHandler.getDeviceForName(btdevice) == null){
                if (showToasts)Toast.makeText(activity, activity.getText(R.string.noSuchBluetoothDevice)+":"+btdevice, Toast.LENGTH_SHORT).show();
                return false;
            }
        }
        if (sharedPrefs.getBoolean(Constants.USBNMEA,false)||sharedPrefs.getBoolean(Constants.USBAIS,false)){
            String usbDevice=sharedPrefs.getString(Constants.USBDEVICE,"");
            if (UsbSerialPositionHandler.getDeviceForName(activity,usbDevice) == null){
                if (showToasts)Toast.makeText(activity, activity.getText(R.string.noSuchUsbDevice)+":"+usbDevice, Toast.LENGTH_SHORT).show();
                return false;
            }
        }
        if (! checkGpsEnabled(activity,false,startDialogs,showToasts)) return false;
        return true;
    }

    private static boolean checkOrCreateWorkDir(File workdir) {
        if (workdir.equals(new File(""))) return false;
        try {
            createWorkingDir(workdir);
        } catch (Exception e) {
            return false;
        }
        return true;
    }


    private boolean checkForInitialDialogs(){
        boolean showsDialog=false;
        SharedPreferences sharedPrefs = getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        String mode=sharedPrefs.getString(Constants.RUNMODE, "");
        boolean startPendig=sharedPrefs.getBoolean(Constants.WAITSTART, false);
        if (mode.isEmpty() || startPendig) {
            showsDialog=true;
            int title;
            int message;
            if (startPendig) {
                title=R.string.somethingWrong;
                message=R.string.somethingWrongMessage;
            } else {
                handleInitialSettings(this);
                title=R.string.firstStart;
                message=R.string.firstStartMessage;
            }
            DialogBuilder.alertDialog(this,title,message, new DialogInterface.OnClickListener(){
                @Override
                public void onClick(DialogInterface dialog, int which) {
                    checkSettings(SettingsActivity.this,true,true);
                }
            });
            if (startPendig)sharedPrefs.edit().putBoolean(Constants.WAITSTART,false).commit();
        }
        int version=0;
        try {
            version = getPackageManager()
                    .getPackageInfo(getPackageName(), 0).versionCode;
        } catch (PackageManager.NameNotFoundException e) {
        }
        if (showsDialog) return true;
        if (version != 0 ){
            try {
                int lastVersion = sharedPrefs.getInt(Constants.VERSION, 0);
                //TODO: handle other version changes
                if (lastVersion == 0 ){
                    sharedPrefs.edit().putInt(Constants.VERSION,version).commit();
                    showsDialog=true;
                    DialogBuilder builder=new DialogBuilder(this,R.layout.dialog_confirm);
                    builder.setTitle(R.string.newVersionTitle);
                    builder.setText(R.id.question,R.string.newVersionMessage);
                    builder.setNegativeButton(R.string.settings, new DialogInterface.OnClickListener() {
                        @Override
                        public void onClick(DialogInterface dialog, int which) {
                            resultNok();
                        }
                    });
                    builder.setPositiveButton(android.R.string.ok, new DialogInterface.OnClickListener() {
                        @Override
                        public void onClick(DialogInterface dialog, int which) {
                            checkResult();
                        }
                    });
                    builder.show();
                }
            }catch (Exception e){}
        }
        return showsDialog;
    }

    private static void createWorkingDir(File workdir) throws Exception{
        if (! workdir.isDirectory()){
            workdir.mkdirs();
        }
        if (! workdir.isDirectory()) throw new Exception("unable to create "+workdir.getAbsolutePath());
        final String subdirs[]=new String[]{"charts","tracks","routes"};
        for (String s: subdirs){
            File sub=new File(workdir,s);
            if (! sub.isDirectory()){
                AvnLog.d(Constants.LOGPRFX, "creating subdir " + sub.getAbsolutePath());
                if (! sub.mkdirs()) throw new Exception("unable to create directory "+sub.getAbsolutePath());
            }
        }
    }

    static public boolean externalStorageAvailable(){
        String state=Environment.getExternalStorageState();
        return (Environment.MEDIA_MOUNTED.equals(state));
    }



    /**
     * check the current settings
     * @return false when a new dialog had been opened
     */
    private static void handleInitialSettings(Activity activity){
        PreferenceManager.setDefaultValues(activity,Constants.PREFNAME,Context.MODE_PRIVATE,R.xml.expert_preferences,true);
        PreferenceManager.setDefaultValues(activity,Constants.PREFNAME,Context.MODE_PRIVATE,R.xml.nmea_preferences,true);
        final SharedPreferences sharedPrefs = activity.getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        final SharedPreferences.Editor e=sharedPrefs.edit();
        if (! sharedPrefs.contains(Constants.ALARMSOUNDS)){
            e.putBoolean(Constants.ALARMSOUNDS,true);
        }
        String mode=sharedPrefs.getString(Constants.RUNMODE,"");
        if (mode.equals("")){
            e.putBoolean(Constants.SHOWDEMO,true);
            e.putString(Constants.IPADDR, "192.168.20.10");
            e.putString(Constants.IPPORT,"34567");
            e.putBoolean(Constants.INTERNALGPS,true);
            mode=Constants.MODE_NORMAL;
        }
        else {
            if (mode.equals(Constants.MODE_XWALK)){
                mode= Constants.MODE_NORMAL;
            }
        }
        String workdir=sharedPrefs.getString(Constants.WORKDIR, "");
        String chartdir=sharedPrefs.getString(Constants.CHARTDIR, "");
        e.putString(Constants.RUNMODE, mode);
        if (workdir.isEmpty()){
            workdir=Constants.INTERNAL_WORKDIR;
        }
        e.putString(Constants.WORKDIR, workdir);
        e.putString(Constants.CHARTDIR, chartdir);
        e.apply();
        //for robustness update all modes matching the current settings and version
        String nmeaMode=NmeaSettingsFragment.getNmeaMode(sharedPrefs);
        NmeaSettingsFragment.updateNmeaMode(sharedPrefs,nmeaMode);
        String aisMode=NmeaSettingsFragment.getAisMode(sharedPrefs);
        NmeaSettingsFragment.updateAisMode(sharedPrefs,aisMode);
        try {
            int version = activity.getPackageManager()
                    .getPackageInfo(activity.getPackageName(), 0).versionCode;
            if (sharedPrefs.getInt(Constants.VERSION,-1)!= version){
                e.putInt(Constants.VERSION,version);
            }
        } catch (Exception ex) {
        }
        e.commit();
    }

    @Override
    public void onBackPressed(){
        if (!isMultiPane() && ! hasHeaders()){
            super.onBackPressed();
            return;
        }
        checkResult();
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        if (item.getItemId() == android.R.id.home){
            onBackPressed();
            return true;
        }
        if (item.getItemId() == R.id.action_ok){
            onBackPressed();
            return true;
        }
        if (item.getItemId()== R.id.action_about) {
            Intent intent = new Intent(this, Info.class);
            startActivity(intent);
            return true;
        }
        return super.onOptionsItemSelected(item);
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {

        // Inflate the menu items for use in the action bar
        MenuInflater inflater = getMenuInflater();
        inflater.inflate(R.menu.settings_activity_actions, menu);
        return super.onCreateOptionsMenu(menu);

    }

    @Override
    public void onBuildHeaders(List<Header> target) {
        super.onBuildHeaders(target);
        headers=target;
        loadHeadersFromResource(R.xml.preference_headers, target);
        updateHeaderSummaries(false);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }
    private void checkResult(){
        if (! checkSettings(this,true,true)) return;
        Intent result=new Intent();
        setResult(Activity.RESULT_OK,result);
        finish();
    }
    private void resultNok(){
        Intent result=new Intent();
        setResult(Activity.RESULT_CANCELED,result);
        finish();
    }
    @Override
    protected void onResume() {
        View toolbar=findViewById(R.id.toolbar);
        if (toolbar == null) injectToolbar();
        getToolbar().setOnMenuItemClickListener(this);
        super.onResume();
        updateHeaderSummaries(true);
    }
    @Override
    public boolean onIsMultiPane() {

        DisplayMetrics metrics = new DisplayMetrics();
        getWindowManager().getDefaultDisplay().getMetrics(metrics);
        boolean preferMultiPane=false;
        float scaledWidth=metrics.widthPixels/metrics.density;
        if (scaledWidth >= 480) preferMultiPane=true;
        return preferMultiPane;
    }

    public void updateHeaderSummaries(boolean allowInvalidate){

        if (headers == null) return;
        SharedPreferences prefs=getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        boolean hasChanged=false;
        for (Header h: headers){
            String newSummary=null;
            if (h == null || h.fragment == null) continue;
            if (h.fragment.equals(NmeaSettingsFragment.class.getName())){
                newSummary= NmeaSettingsFragment.getSummary(this);
            }
            if (h.fragment.equals(MainSettingsFragment.class.getName())){
                newSummary= MainSettingsFragment.getSummary(this);
            }
            if (newSummary != null && newSummary != h.summary){
                h.summary=newSummary;
                hasChanged=true;
            }
        }
        if (hasChanged && allowInvalidate) invalidateHeaders();
    }

    @Override
    protected void onTitleChanged(CharSequence title, int color) {
        super.onTitleChanged(title, color);
        if (!onIsHidingHeaders()) {
            if (mToolbar != null) mToolbar.setTitle(R.string.androidSettings);
        }
        else {
            if (mToolbar != null) mToolbar.setTitle(title);
        }
    }

    @Override
    public void showBreadCrumbs(CharSequence title, CharSequence shortTitle) {
        super.showBreadCrumbs(title,shortTitle);
        setTitle(title);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        callbacks.clear();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        for (ActivityResultCallback cb:callbacks){
            boolean handled=cb.onActivityResult(requestCode,resultCode,data);
            if (handled) break;
        }



    }

    public void registerActivityResultCallback(ActivityResultCallback cb){
        callbacks.add(cb);
    }
    public void deRegisterActivityResultCallback(ActivityResultCallback cb){
        callbacks.remove(cb);
    }
}

