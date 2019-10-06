package de.wellenvogel.avnav.settings;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.Resources;
import android.os.Bundle;
import android.preference.EditTextPreference;
import android.preference.ListPreference;
import android.preference.Preference;
import android.widget.Toast;

import java.io.File;
import java.io.IOException;

import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.main.XwalkDownloadHandler;
import de.wellenvogel.avnav.util.AvnLog;

/**
 * Created by andreas on 24.10.15.
 */
public class MainSettingsFragment extends SettingsFragment {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        addPreferencesFromResource(R.xml.main_preferences);
        final EditTextPreference myPref = (EditTextPreference) findPreference(Constants.WORKDIR);
        if (myPref != null) {
            myPref.setOnPreferenceClickListener(new Preference.OnPreferenceClickListener() {
                public boolean onPreferenceClick(final Preference preference) {
                    SettingsActivity.selectWorkingDirectory(getActivity(), new SettingsActivity.SelectWorkingDir() {
                        @Override
                        public void directorySelected(File dir) {
                            try {
                                myPref.setText(dir.getCanonicalPath());
                            } catch (IOException e1) {
                                Toast.makeText(getActivity(), e1.getMessage(), Toast.LENGTH_SHORT).show();
                            }
                        }

                        @Override
                        public void failed() {
                        }

                        @Override
                        public void cancel() {
                        }

                    },myPref.getText(),true);
                    return true;
                }
            });
        }
        final EditTextPreference myChartPref = (EditTextPreference) findPreference(Constants.CHARTDIR);
        if (myChartPref != null) {
            myChartPref.setOnPreferenceClickListener(new Preference.OnPreferenceClickListener() {
                public boolean onPreferenceClick(final Preference preference) {
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
                    if (startDir.isEmpty()){
                        startDir=myPref.getText();
                    }
                    try {
                        FolderChooseDialog.setStartDir(startDir);
                    } catch (Exception e) {
                        e.printStackTrace();
                        myChartPref.setText("");
                        try{
                            FolderChooseDialog.setStartDir(myPref.getText());
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
            //the workdir will potentially be set asynchronously
            EditTextPreference ep=(EditTextPreference)pref;
            String nval=prefs.getString(pref.getKey(),"");
            ep.setText(nval);
            ep.setSummary(nval);
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
}
