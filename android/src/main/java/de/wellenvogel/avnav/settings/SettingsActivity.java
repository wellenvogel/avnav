package de.wellenvogel.avnav.settings;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.PowerManager;
import android.preference.*;

import android.provider.Settings;
import androidx.annotation.NonNull;

import android.util.DisplayMetrics;
import android.view.Menu;
import android.view.MenuInflater;
import android.view.MenuItem;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.Toast;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;

import de.wellenvogel.avnav.worker.GpsService;
import de.wellenvogel.avnav.worker.NeededPermissions;
import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.Info;
import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.util.ActionBarHandler;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.util.DialogBuilder;

/**
 * Created by andreas on 03.09.15.
 */

public class SettingsActivity extends PreferenceActivity {
    private static int PERMSSION_REQUEST_CODE=1000;

    private static synchronized int getNextPermissionRequestCode(){
        PERMSSION_REQUEST_CODE++;
        return PERMSSION_REQUEST_CODE;
    }
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

    private static class DialogRequest{
        int requestCode;
        Runnable callback;
        public boolean exitOnCancel=false;
        DialogRequest(int requestCode,Runnable callback){
            this.requestCode=requestCode;
            this.callback=callback;
        }
    }

    private ArrayList<DialogRequest> openRequests=new ArrayList<DialogRequest>();

    private List<Header> headers=null;
    private ActionBarHandler mToolbar;
    private HashMap<Integer,PermissionResult> resultHandler=new HashMap<>();


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
    private boolean runNextDialog(){
        if (openRequests.size() < 1) return false;
        DialogRequest rq=openRequests.remove(0);
        rq.callback.run();
        return true;
    }
    @Override
    public boolean isValidFragment(String n){
        return true;
    }

    private static void handleMigrations(Activity activity){
        PreferenceManager.setDefaultValues(activity,Constants.PREFNAME,Context.MODE_PRIVATE,R.xml.sound_preferences,true);
        final SharedPreferences sharedPrefs=activity.getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        final SharedPreferences.Editor edit=sharedPrefs.edit();
        //set default values for settings
        final Map<String,?> currentValues=sharedPrefs.getAll();
        String workDir=sharedPrefs.getString(Constants.WORKDIR,"");
        if (! workDir.isEmpty()){
            try {
                String internal = activity.getFilesDir().getCanonicalPath();
                String external = (activity.getExternalFilesDir(null)!=null)?activity.getExternalFilesDir(null).getCanonicalPath():null;
                if (workDir.equals(internal)){
                    edit.putString(Constants.WORKDIR,Constants.INTERNAL_WORKDIR);
                    AvnLog.i("migrating workdir to internal");
                }
                if (workDir.equals(external)){
                    edit.putString(Constants.WORKDIR,Constants.EXTERNAL_WORKDIR);
                    AvnLog.i("migrating workdir to external");
                }
                else{
                    if (workDir.equals(Constants.EXTERNAL_WORKDIR) && external == null){
                        AvnLog.i("external workdir not available, change to internal");
                        edit.putString(Constants.WORKDIR,Constants.INTERNAL_WORKDIR);
                    }
                }
            }catch(IOException e){
                AvnLog.e("Exception while migrating workdir",e);
            }
        }
        edit.apply();
    }

    static private int permissionToText(String [] permissions){
        for (String s : permissions){
            if (s.equals(Manifest.permission.ACCESS_FINE_LOCATION)){
                return R.string.needGps;
            }
            if (s.equals(Manifest.permission.BLUETOOTH_CONNECT)){
                return R.string.needsBluetoothCon;
            }
            if (s.equals(Manifest.permission.POST_NOTIFICATIONS)){
                return R.string.permissionNotification;
            }
        }
        return 0;
    }
    static class PermissionRequestDialog extends DialogRequest{
        PermissionRequestDialog(SettingsActivity activity, int requestCode, boolean doRestart, String [] permissions, boolean exitOnCancel) {
            super(requestCode, new Runnable() {
                @Override
                public void run() {
                    activity.requestPermission(permissions, new PermissionResult() {
                        @Override
                        public void result(String[] permissions, int[] grantResults) {
                            boolean grantOk=true;
                            for (int i=0;i< permissions.length;i++){
                                if (i >= grantResults.length || grantResults[i]!= PackageManager.PERMISSION_GRANTED){
                                    grantOk=false;
                                }
                            }
                            int permissionInfo=permissionToText(permissions);
                            boolean showDialog=false;
                            if (! grantOk) {
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                                    for (String perm : permissions) {
                                            if (!activity.shouldShowRequestPermissionRationale(perm))
                                                showDialog = true;
                                    }
                                }
                                showDialog=showDialog && permissionInfo != 0;
                                if (! showDialog) {
                                    if (permissionInfo != 0){
                                        Toast.makeText(activity,activity.getText(permissionInfo)+" "+activity.getText(R.string.notGranted), Toast.LENGTH_SHORT).show();
                                    }
                                    else {
                                        Toast.makeText(activity, R.string.notGranted, Toast.LENGTH_SHORT).show();
                                    }
                                }
                            }
                            if (! showDialog) {
                                if (!activity.runNextDialog()) {
                                    if (doRestart)
                                        activity.resultOk();
                                    else
                                        activity.resultNoRestart();
                                }
                                return;
                            }
                            DialogBuilder.confirmDialog(activity, permissionInfo, R.string.grantQuestion, new DialogInterface.OnClickListener() {
                                @Override
                                public void onClick(DialogInterface dialogInterface, int i) {
                                    if (i == DialogInterface.BUTTON_POSITIVE){
                                        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                                        Uri uri = Uri.fromParts("package", activity.getPackageName(), null);
                                        intent.setData(uri);
                                        activity.startActivity(intent);
                                    }
                                    if (i == DialogInterface.BUTTON_NEGATIVE && exitOnCancel){
                                        activity.resultNok();
                                    }
                                    if (!activity.runNextDialog() ) {
                                        if(doRestart)
                                            activity.resultOk();
                                        else
                                            activity.resultNoRestart();
                                    }
                                }
                            });
                        }
                    });
                }
            });
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        openRequests.clear();
        resultHandler.clear();
        injectToolbar();
        getToolbar().setOnMenuItemClickListener(this);
        updateHeaderSummaries(true);
        boolean checkInitially=false;
        Bundle b=getIntent() != null?getIntent().getExtras():null;
        String [] permissionRequests=null;
        boolean exitOnCancel=false;
        if (b != null){
            checkInitially=b.getBoolean(Constants.EXTRA_INITIAL,false);
            if (b.containsKey(Constants.EXTRA_PERMSSIONS)) {
                permissionRequests = b.getStringArray(Constants.EXTRA_PERMSSIONS);
            }
            if (b.containsKey(Constants.EXTRA_PERMSSIONEXITCANCEL)){
                exitOnCancel=b.getBoolean(Constants.EXTRA_PERMSSIONEXITCANCEL);
            }
        }
        if (checkInitially) {
            if (!checkSettings(this,true)){
                //Toast.makeText(this,R.string.requiredSettings,Toast.LENGTH_LONG).show();
                runPermissionDialogs();
            }
        }
        else if (permissionRequests != null && permissionRequests.length != 0){
            openRequests.add(new PermissionRequestDialog(this,getNextPermissionRequestCode(),false,permissionRequests, exitOnCancel));
            if (! runNextDialog()){
                resultNoRestart();
            }
        }
    }

    private void runPermissionDialogs(){
        SharedPreferences sharedPrefs=getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        NeededPermissions perm=GpsService.getNeededPermissions(this);
        if (perm.gps && !checkGpsPermission(this)) {
            int request = getNextPermissionRequestCode();
            openRequests.add(new PermissionRequestDialog(this, request, true, new String[]{Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION}, false));
        }
        if (perm.gps && ! checkGpsEnabled(this)){
            int request=getNextPermissionRequestCode();
            openRequests.add(new DialogRequest(request, new Runnable() {
                @Override
                public void run() {
                        DialogBuilder.confirmDialog(SettingsActivity.this, 0, R.string.noLocation, new DialogInterface.OnClickListener() {
                            @Override
                            public void onClick(DialogInterface dialog, int which) {
                                if (which == DialogInterface.BUTTON_POSITIVE){
                                    Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
                                    startActivity(intent);
                                    openRequests.clear();
                                }
                                else{
                                    if (!runNextDialog()) resultOk();
                                }
                            }
                        });
                }
            }));
        }
        if (!checkOrCreateWorkDir(AvnUtil.getWorkDir(sharedPrefs, this))) {
            int request = getNextPermissionRequestCode();
            openRequests.add(new DialogRequest(request, new Runnable() {
                @Override
                public void run() {
                    DialogBuilder.confirmDialog(SettingsActivity.this, 0, R.string.selectWorkDirWritable, new DialogInterface.OnClickListener() {
                        @Override
                        public void onClick(DialogInterface dialog, int which) {
                            if (which == DialogInterface.BUTTON_NEGATIVE) {
                                resultNok();
                            }
                            if (!runNextDialog()) resultOk();
                        }
                    });
                }
            }));
        }
        if (perm.gps && ! checkPowerSavingMode(this)){
            int request = getNextPermissionRequestCode();
            openRequests.add(new DialogRequest(request, new Runnable() {
                @Override
                public void run() {
                    DialogBuilder.confirmDialog(SettingsActivity.this, 0, R.string.powerSafer, new DialogInterface.OnClickListener() {
                        @Override
                        public void onClick(DialogInterface dialogInterface, int i) {
                            openRequests.clear();
                            if (i == DialogInterface.BUTTON_POSITIVE) {
                                startActivity(new Intent(Settings.ACTION_SETTINGS));
                            }
                            else {
                                if (!runNextDialog()) resultOk();
                            }
                        }
                    });
                }
            }));
        }
        if (! checkNotificationPermission(this)){
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                openRequests.add(new PermissionRequestDialog(
                        this,
                        getNextPermissionRequestCode(),
                        true,
                        new String[]{Manifest.permission.POST_NOTIFICATIONS}, false));
            }

        }
        if (perm.bluetooth && ! checkBluetooth(this)){
            if (Build.VERSION.SDK_INT >= 31) {
                openRequests.add(new PermissionRequestDialog(
                        this,
                        getNextPermissionRequestCode(),
                        true,
                        new String[]{Manifest.permission.BLUETOOTH_CONNECT}, false));
            }
        }
        if (! runNextDialog()) resultOk();
    }

    public interface PermissionResult{
        void result(String[] permissions, int[] grantResults);
    }

    public int requestPermission(String[] permission,PermissionResult result){
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return -1;
        int request=getNextPermissionRequestCode();
        if (result != null){
            resultHandler.put(request,result);
        }
        requestPermissions(permission, request);
        return request;
    }


    public static boolean checkGpsEnabled(final Context activity) {
        LocationManager locationService = (LocationManager) activity.getSystemService(activity.LOCATION_SERVICE);
        return locationService.isProviderEnabled(LocationManager.GPS_PROVIDER);
    }
    public static boolean checkGpsPermission(final Context ctx) {
        if (Build.VERSION.SDK_INT >= 23) {
            if (ctx.checkSelfPermission( Manifest.permission.ACCESS_FINE_LOCATION) !=
                    PackageManager.PERMISSION_GRANTED)
                return false;
        }
        return true;
    }
    public static boolean checkBluetooth(final Context ctx){
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        return ctx.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
    }

    public static boolean checkPowerSavingMode(final Context context){
        PowerManager pm= (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
            int mode=pm.getLocationPowerSaveMode();
            if (mode != PowerManager.LOCATION_MODE_NO_CHANGE) return false;
        }
        return true;
    }

    public static boolean checkNotificationPermission(final Context ctx){
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU){
            return true;
        }
        return ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }



    /**
     * check if all settings are correct
     * @param activity
     * @return true if settings are ok
     */
    public static boolean checkSettings(Activity activity, boolean checkPermissions){
        handleMigrations(activity);
        SharedPreferences sharedPrefs=activity.getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        if (! checkOrCreateWorkDir(AvnUtil.getWorkDir(sharedPrefs,activity))){
            return false;
        }
        if (! checkNotificationPermission(activity)) return false;
        if (! checkPermissions) return true;
        NeededPermissions perm=GpsService.getNeededPermissions(activity);
        if (perm.bluetooth && ! checkBluetooth(activity)) return false;
        if (! perm.gps) return true;
        if (! checkGpsEnabled(activity)) return false;
        if (! checkGpsPermission(activity)) return false;
        if (! checkPowerSavingMode(activity)) return false;
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



    private static void createWorkingDir(File workdir) throws Exception{
        if (! workdir.isDirectory()){
            workdir.mkdirs();
        }
        if (! workdir.isDirectory()) throw new Exception("unable to create "+workdir.getAbsolutePath());
        final String subdirs[]=new String[]{"charts","tracks","routes","user"};
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
        if (! checkSettings(this,true)) {
            runPermissionDialogs();
            return;
        }
        resultOk();
    }
    private void resultOk(){
        Intent result=new Intent();
        setResult(Activity.RESULT_OK,result);
        finish();
    }
    private void resultNoRestart(){
        Intent result=new Intent();
        setResult(Constants.RESULT_NO_RESTART,result);
        finish();
    }
    private void resultNok(){
        Intent result=new Intent();
        setResult(Activity.RESULT_FIRST_USER,result);
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
        resultHandler.clear();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        for (ActivityResultCallback cb:callbacks){
            boolean handled=cb.onActivityResult(requestCode,resultCode,data);
            if (handled) break;
        }



    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        PermissionResult rs=resultHandler.get(requestCode);
        if (rs != null){
            resultHandler.remove(requestCode);
            rs.result(permissions,grantResults);
        }
    }

    public void registerActivityResultCallback(ActivityResultCallback cb){
        callbacks.add(cb);
    }
    public void deRegisterActivityResultCallback(ActivityResultCallback cb){
        callbacks.remove(cb);
    }
}

