package de.wellenvogel.avnav.settings;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.Resources;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.preference.EditTextPreference;
import android.preference.ListPreference;
import android.preference.Preference;
import android.provider.DocumentsContract;

import java.io.File;

import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;

/**
 * Created by andreas on 24.10.15.
 */
public class MainSettingsFragment extends SettingsFragment {
    private static final int CHARTDIR_REQUEST=99;

    private void runCharDirRequest(EditTextPreference myChartPref){
        if (Build.VERSION.SDK_INT >= 21) {
            String current=myChartPref.getText();
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
            if (Build.VERSION.SDK_INT >= 26) {
                try {
                    Uri oldUri = Uri.parse(current);
                    intent.putExtra(DocumentsContract.EXTRA_INITIAL_URI, oldUri);
                } catch (Throwable t) {
                    AvnLog.e("unable to set old storage root: " + t);
                }
            }
            startActivityForResult(intent, CHARTDIR_REQUEST);
        }
    }
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        addPreferencesFromResource(R.xml.main_preferences);
        final ListPreference myPref = (ListPreference) findPreference(Constants.WORKDIR);
        final EditTextPreference myChartPref = (EditTextPreference) findPreference(Constants.CHARTDIR);
        if (myChartPref != null) {
            myChartPref.setOnPreferenceClickListener(new Preference.OnPreferenceClickListener() {
                public boolean onPreferenceClick(final Preference preference) {
                    if (! ((SettingsActivity)getActivity()).checkStoragePermssionWitResult(true,true, new SettingsActivity.PermissionResult() {
                        @Override
                        public void result(String[] permissions, int[] grantResults) {
                            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED)
                                runCharDirRequest(myChartPref);
                        }
                    }))
                    {
                        return true;
                    }
                    if (Build.VERSION.SDK_INT >= 21) {
                        runCharDirRequest(myChartPref);
                        return true;
                    }
                    //open browser or intent here
                    SimpleFileDialog FolderChooseDialog = new SimpleFileDialog(getActivity(), SimpleFileDialog.FolderChoose,
                            new SimpleFileDialog.SimpleFileDialogListener() {
                                @Override
                                public void onChosenDir(File chosenDir) {
                                    // The code in this function will be executed when the dialog OK button is pushed
                                    ((EditTextPreference)preference).setText(chosenDir.getAbsolutePath());
                                    AvnLog.i(Constants.LOGPRFX, "select chart directory " + chosenDir);
                                }

                                @Override
                                public void onCancel() {

                                }

                                @Override
                                public void onDefault() {

                                }
                            });
                    FolderChooseDialog.Default_File_Name="avnav";
                    FolderChooseDialog.dialogTitle=getString(R.string.selectChartDir);
                    FolderChooseDialog.newFolderNameText=getString(R.string.newFolderName);
                    FolderChooseDialog.newFolderText=getString(R.string.createFolder);
                    String startDir=myChartPref.getText();
                    File workDir= AvnUtil.getWorkDir(null,getActivity());
                    try{

                            if (SettingsActivity.externalStorageAvailable()){
                                File extDir=Environment.getExternalStorageDirectory();
                                if (extDir.getParentFile() != null) extDir=extDir.getParentFile();
                                startDir=extDir.getAbsolutePath();
                            }
                            else {
                                startDir = workDir.getAbsolutePath();
                            }

                        FolderChooseDialog.setStartDir(startDir);
                    } catch (Exception e) {
                        e.printStackTrace();
                        myChartPref.setText("");
                        try{
                            FolderChooseDialog.setStartDir(workDir.getAbsolutePath());
                        }catch (Exception e1){}
                        return true;
                    }
                    FolderChooseDialog.chooseFile_or_Dir(false);
                    return true;
                }
            });
        }
        setDefaults(R.xml.main_preferences,true);
    }


    @Override
    public void onResume() {
        super.onResume();
        fillData();
        SharedPreferences prefs = getActivity().getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        prefs.registerOnSharedPreferenceChangeListener(this);
    }

    @Override
    public void onPause() {
        super.onPause();
        SharedPreferences prefs = getActivity().getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        prefs.unregisterOnSharedPreferenceChangeListener(this);
    }



    @Override
    protected boolean updatePreferenceSummary(Preference pref, SharedPreferences prefs) {
        if (pref instanceof ListPreference && pref.getKey().equals(Constants.RUNMODE)){
            updateListSummary((ListPreference)pref);
            return false;
        }
        if (pref.getKey().equals(Constants.WORKDIR)){
            updateListSummary((ListPreference)pref);
        }
        return true;
    }

    private ListPreference getRunMode(){
        Preference p = getPreferenceScreen().findPreference(Constants.RUNMODE);
        if (p != null) return (ListPreference)p;
        return null;
    }


    private void fillData() {
        ListPreference l = getRunMode();
        if (l != null) {
            Resources r = getResources();
            l.setEntryValues(new String[]{Constants.MODE_NORMAL,  Constants.MODE_SERVER});
            String e[]=new String[l.getEntryValues().length];
            int index=0;
            SharedPreferences prefs = getActivity().getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
            String runMode = prefs.getString(Constants.RUNMODE, Constants.MODE_NORMAL);
            for (int i=0;i<l.getEntryValues().length;i++){
                e[i]=modeToLabel(getActivity(),l.getEntryValues()[i]);
                if (l.getEntryValues()[i].equals(runMode)) index=i;
            }
            l.setEntries(e);
            l.setValueIndex(index);
            updateListSummary(l);
        }
        ListPreference wd=(ListPreference)getPreferenceScreen().findPreference(Constants.WORKDIR);
        if (wd != null){
            wd.setEntryValues(new String[]{Constants.INTERNAL_WORKDIR,Constants.EXTERNAL_WORKDIR});
            SharedPreferences prefs = getActivity().getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
            String workdir = prefs.getString(Constants.WORKDIR, Constants.INTERNAL_WORKDIR);
            wd.setEntries(new String[]{
                    getResources().getString(R.string.internalStorage),
                    getResources().getString(R.string.externalStorage)
            });
            if (workdir.equals(Constants.INTERNAL_WORKDIR)) wd.setValueIndex(0);
            if (workdir.equals(Constants.EXTERNAL_WORKDIR)) wd.setValueIndex(1);
            updateListSummary(wd);
        }
    }
    private void updateListSummary(ListPreference l){
        l.setSummary(l.getEntry());
    }
    private static String modeToLabel(Activity a,CharSequence mode){
        if (mode == null) return "";
        Resources r=a.getResources();
        if (mode.equals(Constants.MODE_NORMAL)) return r.getString(R.string.runNormal);
        if (mode.equals(Constants.MODE_SERVER)) return r.getString(R.string.useExtBrowser);
        return "";
    }

    public static String getSummary(Activity a){
        SharedPreferences prefs = a.getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        String runMode = prefs.getString(Constants.RUNMODE, Constants.MODE_NORMAL);
        return a.getResources().getString(R.string.runMode)+":"+modeToLabel(a,runMode);
    }
    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == CHARTDIR_REQUEST && resultCode == Activity.RESULT_OK){
            getActivity().getContentResolver().takePersistableUriPermission(data.getData(),
                    Intent.FLAG_GRANT_READ_URI_PERMISSION);
            EditTextPreference myChartPref = (EditTextPreference) findPreference(Constants.CHARTDIR);
            if (myChartPref != null){
                myChartPref.setText(data.getDataString());
            }
        }

    }
}
