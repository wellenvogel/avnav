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
import de.wellenvogel.avnav.util.DialogBuilder;

import static de.wellenvogel.avnav.main.Constants.MODE_INTERNAL;

/**
 * Created by andreas on 03.09.15.
 */

public class SettingsActivity extends PreferenceActivity {

    private boolean requestGps=false;

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

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestGps=true;
        injectToolbar();
        getToolbar().setOnMenuItemClickListener(this);
        //handleInitialSettings(this, true);
        updateHeaderSummaries(true);
        if (needsInitialSettings(this)){
            handleInitialSettings(this);
        }
        if (checkForInitialDialogs()){
            return;
        }
        checkSettings(this,true,true);
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
        SharedPreferences sharedPrefs=activity.getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        if (! sharedPrefs.getBoolean(Constants.BTNMEA,false) &&
                ! sharedPrefs.getBoolean(Constants.IPNMEA,false) &&
                ! sharedPrefs.getBoolean(Constants.INTERNALGPS,false) &&
                ! sharedPrefs.getBoolean(Constants.USBNMEA,false)){
            if (showToasts) Toast.makeText(activity, R.string.noGpsSelected, Toast.LENGTH_SHORT).show();
            return false;
        }
        if (! checkOrCreateWorkDir(sharedPrefs.getString(Constants.WORKDIR,""))){
            if (showToasts)Toast.makeText(activity, R.string.selectWorkDirWritable, Toast.LENGTH_SHORT).show();
            return false;
        }
        if (needsInitialSettings(activity)) handleInitialSettings(activity);
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

    private static boolean checkOrCreateWorkDir(String workdir) {
        if (workdir.isEmpty()) {
            return false;
        }
        try {
            createWorkingDir(new File(workdir));
        } catch (Exception e) {
            return false;
        }
        return true;
    }

    private static boolean needsInitialSettings(Context context){
        SharedPreferences sharedPrefs = context.getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        String mode=sharedPrefs.getString(Constants.RUNMODE, "");
        String workdir=sharedPrefs.getString(Constants.WORKDIR,"");
        if (!checkOrCreateWorkDir(workdir)) return true;
        return (mode.isEmpty() || mode.equals(Constants.MODE_XWALK) );
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
    public static interface SelectWorkingDir{
        public void directorySelected(File dir);
        public void failed();
        public void cancel();
    }

    //select a valid working directory - or exit
    static boolean selectWorkingDirectory(final Activity activity, final SelectWorkingDir callback, String current, boolean force){
        File currentFile=null;
        if (current != null  && ! current.isEmpty()) {
            currentFile=new File(current);
            if (!currentFile.isDirectory()) {
                //maybe we can just create it...
                try {
                    createWorkingDir(currentFile);
                } catch (Exception e1) {
                    currentFile=null;
                }
            }
        }
        if (currentFile != null && currentFile.canWrite() && ! force){
            return true;
        }
        //seems that either the directory is not writable
        //or not set at all
        final DialogBuilder builder=new DialogBuilder(activity,R.layout.dialog_selectlist);
        final boolean simpleTitle=(current == null || current.isEmpty() && force);
        builder.setTitle(simpleTitle?R.string.selectWorkDirWritable:R.string.selectWorkDir);
        ArrayList<String> selections=new ArrayList<String>();
        selections.add(activity.getString(R.string.internalStorage));
        boolean hasExternal=false;
        String state=Environment.getExternalStorageState();
        if (Environment.MEDIA_MOUNTED.equals(state)) hasExternal=true;
        if (hasExternal) selections.add(activity.getString(R.string.externalStorage));
        selections.add(activity.getString(R.string.selectStorage));
        ArrayAdapter<String> adapter=new ArrayAdapter<String>(activity,R.layout.list_item,selections);
        ListView lv=(ListView)builder.getContentView().findViewById(R.id.list_value);
        lv.setAdapter(adapter);
        lv.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
                final boolean hasExternal=parent.getAdapter().getCount()>2;
                if (position == (parent.getAdapter().getCount() -1)){
                    //last item selected - show file dialog
                    SimpleFileDialog FolderChooseDialog = new SimpleFileDialog(activity, SimpleFileDialog.FolderChoose,
                            new SimpleFileDialog.SimpleFileDialogListener() {
                                @Override
                                public void onChosenDir(File newDir) {
                                    builder.dismiss();
                                    // The code in this function will be executed when the dialog OK button is pushed
                                    try {
                                        createWorkingDir(newDir);
                                    } catch (Exception ex) {
                                        Toast.makeText(activity, ex.getMessage(), Toast.LENGTH_SHORT).show();
                                        return;
                                    }
                                    AvnLog.i(Constants.LOGPRFX, "select work directory " + newDir.getAbsolutePath());
                                }
                                @Override
                                public void onCancel() {
                                    callback.cancel();
                                }

                                @Override
                                public void onDefault() {
                                }
                            });
                    FolderChooseDialog.Default_File_Name="avnav";
                    FolderChooseDialog.dialogTitle=activity.getString(simpleTitle?R.string.selectWorkDir:R.string.selectWorkDirWritable);
                    FolderChooseDialog.newFolderNameText=activity.getString(R.string.newFolderName);
                    FolderChooseDialog.newFolderText=activity.getString(R.string.createFolder);
                    File start=hasExternal?activity.getExternalFilesDir(null):activity.getFilesDir();
                    String startPath="";
                    try {
                        startPath=start.getCanonicalPath();
                        FolderChooseDialog.setStartDir(startPath);
                    } catch (Exception e) {
                        return;
                    }
                    FolderChooseDialog.chooseFile_or_Dir(false);
                    return;
                }
                File newDir=(position == 0)?activity.getFilesDir():activity.getExternalFilesDir(null);
                try{
                    createWorkingDir(newDir);
                }catch (Exception e){
                    builder.dismiss();
                    Toast.makeText(activity, e.getMessage(), Toast.LENGTH_SHORT).show();
                    callback.failed();
                }
                builder.dismiss();
                callback.directorySelected(newDir);
            }
        });
        builder.setNegativeButton(R.string.cancel, new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                callback.cancel();
            }
        });
        builder.show();
        return false;
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
        String chartdir=sharedPrefs.getString(Constants.CHARTDIR, new File(new File(workdir), "charts").getAbsolutePath());
        e.putString(Constants.RUNMODE, mode);
        if (workdir.isEmpty()){
            try {
                workdir=activity.getFilesDir().getCanonicalPath();
            } catch (IOException ex) {
                AvnLog.e("unable to get files path",ex);
            }
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
    public boolean onOptionsItemSelected(MenuItem item) {
        if (item.getItemId() == android.R.id.home){
            checkResult();
            return true;
        }
        if (item.getItemId() == R.id.action_ok){
            checkResult();
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
        if (metrics.widthPixels >= 900) preferMultiPane=true;
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

