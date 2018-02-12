package de.wellenvogel.avnav.settings;

import android.app.Activity;
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
import android.view.View;
import android.view.ViewGroup;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.Toast;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;

import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.Info;
import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.main.XwalkDownloadHandler;
import de.wellenvogel.avnav.util.ActionBarHandler;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.DialogBuilder;

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

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        injectToolbar();
        getToolbar().setOnMenuItemClickListener(this);
        //handleInitialSettings(this, true);
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

    public static boolean needsInitialSettings(Context context){
        SharedPreferences sharedPrefs = context.getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        String mode=sharedPrefs.getString(Constants.RUNMODE, "");
        boolean startPendig=sharedPrefs.getBoolean(Constants.WAITSTART, false);
        String workdir=sharedPrefs.getString(Constants.WORKDIR,"");
        boolean workDirOk=true;
        if (workdir.isEmpty()){
            workDirOk=false;
        }
        else{
            try{
                createWorkingDir(new File(workdir));
            }catch (Exception e){
                workDirOk=false;
            }
        }
        return (mode.isEmpty() || startPendig|| workdir.isEmpty());
    }

    private boolean checkForInitialDialogs(){
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
                    handleInitialSettings();
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
        if (! startSomething) return false;
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
                            resultNok();
                        }
                    });
                    builder.setPositiveButton(android.R.string.ok, new DialogInterface.OnClickListener() {
                        @Override
                        public void onClick(DialogInterface dialog, int which) {
                            if (needsInitialSettings(SettingsActivity.this)){
                                handleInitialSettings();
                            }
                        }
                    });
                    builder.show();
                }
            }catch (Exception e){}
        }
        return startSomething;
    }

    public static void createWorkingDir(File workdir) throws Exception{
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
    private boolean handleInitialSettings(){
        boolean rt=true;
        PreferenceManager.setDefaultValues(this,Constants.PREFNAME,Context.MODE_PRIVATE,R.xml.expert_preferences,true);
        PreferenceManager.setDefaultValues(this,Constants.PREFNAME,Context.MODE_PRIVATE,R.xml.nmea_preferences,true);
        final SharedPreferences sharedPrefs = this.getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        final SharedPreferences.Editor e=sharedPrefs.edit();
        if (! sharedPrefs.contains(Constants.ALARMSOUNDS)){
            e.putBoolean(Constants.ALARMSOUNDS,true);
        }
        String mode=sharedPrefs.getString(Constants.RUNMODE,"");
        if (mode.equals("")) {
            e.putBoolean(Constants.SHOWDEMO,true);
            e.putString(Constants.IPADDR, "192.168.20.10");
            e.putString(Constants.IPPORT,"34567");
            e.putBoolean(Constants.INTERNALGPS,true);
            //never set before
            if (currentapiVersion < Constants.OSVERSION_XWALK ) {
                if (! isXwalRuntimeInstalled(this)){
                    (new XwalkDownloadHandler(this)).showDownloadDialog(this.getString(R.string.xwalkNotFoundTitle),
                            this.getString(R.string.xwalkShouldUse) + Constants.XWALKVERSION, false);
                    rt=false;
                }
                else {
                    mode=Constants.MODE_XWALK;
                }
            }
        }
        else {
            if (mode.equals(Constants.MODE_XWALK)){
                if (! isXwalRuntimeInstalled(this) ){
                    if (currentapiVersion < Constants.OSVERSION_XWALK) {
                        (new XwalkDownloadHandler(this)).showDownloadDialog(this.getString(R.string.xwalkNotFoundTitle),
                                this.getString(R.string.xwalkNotFoundText) + Constants.XWALKVERSION, false);
                        rt=false;
                    }
                    else {
                        mode= Constants.MODE_NORMAL;
                    }
                }
            }
        }
        String workdir=sharedPrefs.getString(Constants.WORKDIR, "");
        String chartdir=sharedPrefs.getString(Constants.CHARTDIR, new File(new File(workdir), "charts").getAbsolutePath());
        if (mode.isEmpty()) mode=Constants.MODE_NORMAL;
        e.putString(Constants.RUNMODE, mode);
        e.putString(Constants.WORKDIR, workdir);
        e.putString(Constants.CHARTDIR, chartdir);
        e.apply();
        rt=selectWorkingDirectory(SettingsActivity.this,new SelectWorkingDir() {
            @Override
            public void directorySelected(File dir) {
                try {
                    SharedPreferences.Editor e=sharedPrefs.edit();
                    e.putString(Constants.WORKDIR,dir.getCanonicalPath());
                    e.apply();
                } catch (IOException e1) {
                    Toast.makeText(SettingsActivity.this, e1.getMessage(), Toast.LENGTH_SHORT).show();
                }
                resultOk();
            }

            @Override
            public void failed() {
            }

            @Override
            public void cancel() {
                resultNok();
            }

        },workdir,false);
        //for robustness update all modes matching the current settings and version
        String nmeaMode=NmeaSettingsFragment.getNmeaMode(sharedPrefs);
        NmeaSettingsFragment.updateNmeaMode(sharedPrefs,nmeaMode);
        String aisMode=NmeaSettingsFragment.getAisMode(sharedPrefs);
        NmeaSettingsFragment.updateAisMode(sharedPrefs,aisMode);
        try {
            int version = this.getPackageManager()
                    .getPackageInfo(this.getPackageName(), 0).versionCode;
            if (sharedPrefs.getInt(Constants.VERSION,-1)!= version){
                e.putInt(Constants.VERSION,version);
            }
        } catch (Exception ex) {
        }
        e.commit();
        NmeaSettingsFragment.checkGpsEnabled(this, false);
        return rt;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        if (item.getItemId() == android.R.id.home){
            resultOk();
            return true;
        }
        if (item.getItemId() == R.id.action_ok){
            resultOk();
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
    private void resultOk(){
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
        if (getIntent().getBooleanExtra(Constants.EXTRA_INITIAL,false)){
            if (checkForInitialDialogs()){
                handleInitialSettings();
            }
            AvnLog.i("initial settings call");

        }
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

