package de.wellenvogel.avnav.settings;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Environment;
import android.preference.*;
import android.util.DisplayMetrics;
import android.view.Menu;
import android.view.MenuInflater;
import android.view.MenuItem;
import android.widget.Toast;

import java.io.File;
import java.util.List;

import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.Info;
import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.main.SimpleFileDialog;
import de.wellenvogel.avnav.main.XwalkDownloadHandler;
import de.wellenvogel.avnav.util.AvnLog;

/**
 * Created by andreas on 03.09.15.
 */

public class SettingsActivity extends PreferenceActivity {
    private List<Header> headers=null;
    private static final int currentapiVersion = android.os.Build.VERSION.SDK_INT;



    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getActionBar().setDisplayHomeAsUpEnabled(true);
        handleInitialSettings(this);
        updateHeaderSummaries(true);


    }
    public static boolean isXwalRuntimeInstalled(Context ctx){
        return isAppInstalled(ctx, Constants.XWALKAPP, Constants.XWALKVERSION);
    }
    public static boolean isAppInstalled(Context ctx,String packageName, String version) {
        PackageManager pm = ctx.getPackageManager();
        boolean installed = false;
        try {
            PackageInfo pi=pm.getPackageInfo(packageName, PackageManager.GET_ACTIVITIES);
            if (pi.versionName.equals(version)) installed = true;
        } catch (PackageManager.NameNotFoundException e) {
            installed = false;
        }
        return installed;
    }

    public static void createWorkingDir(Activity activity,File workdir) throws Exception{
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

    /**
     * check the current settings
     * @param activity
     * @return false when a new dialog had been opened
     */
    public static boolean handleInitialSettings(final Activity activity){
        boolean rt=true;
        final SharedPreferences sharedPrefs = activity.getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor e=sharedPrefs.edit();
        String mode=sharedPrefs.getString(Constants.RUNMODE,"");
        if (mode.equals("")) {
            e.putBoolean(Constants.SHOWDEMO,true);
            e.putString(Constants.IPADDR, "192.168.20.10");
            e.putString(Constants.IPPORT,"34567");
            e.putBoolean(Constants.INTERNALGPS,true);
            //never set before
            if (currentapiVersion < Constants.OSVERSION_XWALK ) {
                if (! isXwalRuntimeInstalled(activity)){
                    (new XwalkDownloadHandler(activity)).showDownloadDialog(activity.getString(R.string.xwalkNotFoundTitle),
                            activity.getString(R.string.xwalkShouldUse) + Constants.XWALKVERSION, false);
                    rt=false;
                }
                else {
                    mode=Constants.MODE_XWALK;
                }
            }
        }
        else {
            if (mode.equals(Constants.MODE_XWALK)){
                if (! isXwalRuntimeInstalled(activity) ){
                    if (currentapiVersion < Constants.OSVERSION_XWALK) {
                        (new XwalkDownloadHandler(activity)).showDownloadDialog(activity.getString(R.string.xwalkNotFoundTitle),
                                activity.getString(R.string.xwalkNotFoundText) + Constants.XWALKVERSION, false);
                        rt=false;
                    }
                    else {
                        mode= Constants.MODE_NORMAL;
                    }
                }
            }
        }
        String workdir=sharedPrefs.getString(Constants.WORKDIR, "");
        if (workdir.isEmpty()){
            File wdf=new File(Environment.getExternalStorageDirectory(),"avnav");
            try {
                createWorkingDir(activity,wdf);
            } catch (Exception ex) {
            }
            workdir=wdf.getAbsolutePath();
        }
        //TODO: handle unwritable workdir
        String chartdir=sharedPrefs.getString(Constants.CHARTDIR, new File(new File(workdir), "charts").getAbsolutePath());
        e.putString(Constants.RUNMODE, mode);
        e.putString(Constants.WORKDIR, workdir);
        e.putString(Constants.CHARTDIR, chartdir);
        e.apply();
        final String oldWorkdir=workdir;
        if (!(new File(workdir)).canWrite()){
            SimpleFileDialog FolderChooseDialog = new SimpleFileDialog(activity, SimpleFileDialog.FolderChoose,
                    new SimpleFileDialog.SimpleFileDialogListener() {
                        @Override
                        public void onChosenDir(String chosenDir) {
                            // The code in this function will be executed when the dialog OK button is pushed
                            SharedPreferences.Editor e=sharedPrefs.edit();
                            e.putString(Constants.WORKDIR,chosenDir);
                            e.apply();
                            try {
                                createWorkingDir(activity, new File(chosenDir));
                            } catch (Exception ex) {
                                Toast.makeText(activity, ex.getMessage(), Toast.LENGTH_SHORT).show();
                            }
                            //TODO: copy files
                            AvnLog.i(Constants.LOGPRFX, "select work directory " + chosenDir);
                        }
                    });
            FolderChooseDialog.Default_File_Name="avnav";
            FolderChooseDialog.dialogTitle=activity.getString(R.string.selectWorkDirWritable);
            FolderChooseDialog.okButtonText=activity.getString(R.string.ok);
            FolderChooseDialog.cancelButtonText=activity.getString(R.string.cancel);
            FolderChooseDialog.newFolderNameText=activity.getString(R.string.newFolderName);
            FolderChooseDialog.newFolderText=activity.getString(R.string.createFolder);
            File wdf=new File(Environment.getExternalStorageDirectory(),"avnav");
            if (! wdf.isDirectory()){
                wdf.mkdirs();
            }
            FolderChooseDialog.chooseFile_or_Dir(wdf.getAbsolutePath());
            rt=false;
        }
        if (sharedPrefs.getBoolean(Constants.INTERNALGPS,false)==false &&
                sharedPrefs.getBoolean(Constants.IPNMEA,false)==false &&
                sharedPrefs.getBoolean(Constants.BTNMEA,false)==false){
            e.putBoolean(Constants.INTERNALGPS,true);
        }
        e.commit();
        NmeaSettingsFragment.checkGpsEnabled(activity, false);
        return rt;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        if (item.getItemId() == android.R.id.home){
            finish();
            return true;
        }
        if (item.getItemId() == R.id.action_ok){
            finish();
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
    protected void onResume() {
        updateHeaderSummaries(true);
        super.onResume();
        SharedPreferences sharedPrefs = getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        String mode=sharedPrefs.getString(Constants.RUNMODE, "");
        boolean startPendig=sharedPrefs.getBoolean(Constants.WAITSTART, false);
        if (mode.isEmpty() || startPendig) {
            //TODO: the dialogs must be handled by the settings activity
            AlertDialog.Builder builder = new AlertDialog.Builder(this);
            builder.setPositiveButton(android.R.string.ok,
                    new DialogInterface.OnClickListener() {
                        public void onClick(DialogInterface dialog, int id) {

                        }
                    });

            if (startPendig) {
                builder.setTitle(R.string.somethingWrong).setMessage(R.string.somethingWrongMessage);
            } else {
                builder.setTitle(R.string.firstStart).setMessage(R.string.firstStartMessage);
            }
            AlertDialog alertDialog = builder.create();
            alertDialog.show();
            if (startPendig)sharedPrefs.edit().putBoolean(Constants.WAITSTART,false).commit();
        }

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
}

