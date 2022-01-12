package de.wellenvogel.avnav.settings;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.PowerManager;
import android.preference.*;

import android.provider.Settings;
import android.support.annotation.NonNull;
import android.support.v4.app.ActivityCompat;
import android.support.v4.content.ContextCompat;
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
import java.util.Set;

import de.wellenvogel.avnav.worker.BluetoothConnectionHandler;
import de.wellenvogel.avnav.worker.UsbConnectionHandler;
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
        if (b != null){
            checkInitially=b.getBoolean(Constants.EXTRA_INITIAL,false);
        }
        if (checkInitially) {
            if (!checkSettings(this,true)){
                Toast.makeText(this,R.string.requiredSettings,Toast.LENGTH_LONG).show();
                runPermissionDialogs(true);
            }
        }
    }

    private void runPermissionDialogs(boolean initial){
        SharedPreferences sharedPrefs=getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        if (!checkGpsPermission(this)){
            int request=getNextPermissionRequestCode();
            openRequests.add(new DialogRequest(request, new Runnable() {
                @Override
                public void run() {
                    requestPermission(Manifest.permission.ACCESS_FINE_LOCATION, new PermissionResult() {
                        @Override
                        public void result(String[] permissions, int[] grantResults) {
                            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED){
                            }
                            else{
                                if (! initial) Toast.makeText(SettingsActivity.this,R.string.noGpsSelected,Toast.LENGTH_LONG).show();
                            }
                            if (!runNextDialog() && ! initial) resultOk();
                        }
                    });
                }
            }));
        }
        if (! checkGpsEnabled(this)){
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
                                    if (! initial) resultOk();
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
                            openRequests.clear();
                        }
                    });
                }
            }));
        }
        if (! checkPowerSavingMode(this)){
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
                                resultOk();
                            }
                        }
                    });
                }
            }));
        }
        if (! runNextDialog() && !initial) resultOk();
    }

    public interface PermissionResult{
        void result(String[] permissions, int[] grantResults);
    }

    public int requestPermission(String permission,PermissionResult result){
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return -1;
        int request=getNextPermissionRequestCode();
        if (result != null){
            resultHandler.put(request,result);
        }
        requestPermissions(new String[]{permission}, request);
        return request;
    }


    public static boolean checkGpsEnabled(final Activity activity) {
        LocationManager locationService = (LocationManager) activity.getSystemService(activity.LOCATION_SERVICE);
        return locationService.isProviderEnabled(LocationManager.GPS_PROVIDER);
    }
    public static boolean checkGpsPermission(final Activity activity) {
        if (Build.VERSION.SDK_INT >= 23) {
            if (ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION) !=
                    PackageManager.PERMISSION_GRANTED)
                return false;
        }
        return true;
    }

    public static boolean checkPowerSavingMode(final Context context){
        PowerManager pm= (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
            int mode=pm.getLocationPowerSaveMode();
            if (mode != PowerManager.LOCATION_MODE_NO_CHANGE) return false;
        }
        return true;
    }



    /**
     * check if all settings are correct
     * @param activity
     * @return true if settings are ok
     */
    public static boolean checkSettings(Activity activity, boolean checkGps){
        handleMigrations(activity);
        SharedPreferences sharedPrefs=activity.getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        if (! checkOrCreateWorkDir(AvnUtil.getWorkDir(sharedPrefs,activity))){
            return false;
        }
        if (! checkGps) return true;
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
            runPermissionDialogs(false);
            return;
        }
        resultOk();
    }
    private void resultOk(){
        Intent result=new Intent();
        setResult(Activity.RESULT_OK,result);
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

