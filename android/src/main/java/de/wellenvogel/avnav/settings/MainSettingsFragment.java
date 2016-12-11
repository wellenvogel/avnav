package de.wellenvogel.avnav.settings;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.Resources;
import android.os.Bundle;
import android.preference.DialogPreference;
import android.preference.EditTextPreference;
import android.preference.ListPreference;
import android.preference.Preference;

import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.main.SimpleFileDialog;
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
                    //open browser or intent here
                    SimpleFileDialog FolderChooseDialog = new SimpleFileDialog(getActivity(), SimpleFileDialog.FolderChooseWrite,
                            new SimpleFileDialog.SimpleFileDialogListener() {
                                @Override
                                public void onChosenDir(String chosenDir) {
                                    // The code in this function will be executed when the dialog OK button is pushed
                                    ((EditTextPreference)preference).setText(chosenDir);
                                    AvnLog.i(Constants.LOGPRFX, "select work directory " + chosenDir);
                                }

                                @Override
                                public void onCancel() {

                                }
                            });
                    FolderChooseDialog.Default_File_Name="avnav";
                    FolderChooseDialog.dialogTitle=getString(R.string.selectWorkDir);
                    FolderChooseDialog.okButtonText=getString(R.string.ok);
                    FolderChooseDialog.cancelButtonText=getString(R.string.cancel);
                    FolderChooseDialog.newFolderNameText=getString(R.string.newFolderName);
                    FolderChooseDialog.newFolderText=getString(R.string.createFolder);
                    FolderChooseDialog.chooseFile_or_Dir(myPref.getText());
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
                                public void onChosenDir(String chosenDir) {
                                    // The code in this function will be executed when the dialog OK button is pushed
                                    ((EditTextPreference)preference).setText(chosenDir);
                                    AvnLog.i(Constants.LOGPRFX, "select chart directory " + chosenDir);
                                }

                                @Override
                                public void onCancel() {

                                }
                            });
                    FolderChooseDialog.Default_File_Name="avnav";
                    FolderChooseDialog.dialogTitle=getString(R.string.selectChartDir);
                    FolderChooseDialog.okButtonText=getString(R.string.ok);
                    FolderChooseDialog.cancelButtonText=getString(R.string.cancel);
                    FolderChooseDialog.newFolderNameText=getString(R.string.newFolderName);
                    FolderChooseDialog.newFolderText=getString(R.string.createFolder);
                    FolderChooseDialog.chooseFile_or_Dir(myChartPref.getText());
                    return true;
                }
            });
        }
        final ListPreference modeSelector=(ListPreference) findPreference(Constants.RUNMODE);
        if (modeSelector != null){
            modeSelector.setOnPreferenceChangeListener(new Preference.OnPreferenceChangeListener() {
                @Override
                public boolean onPreferenceChange(Preference preference, Object newValue) {
                    String nval=(String)newValue;
                    if (nval.equals(Constants.MODE_XWALK)){
                        if (! SettingsActivity.isXwalRuntimeInstalled(getActivity())) {
                            (new XwalkDownloadHandler(getActivity())).showDownloadDialog(getActivity().getString(R.string.xwalkNotFoundTitle),
                                    getActivity().getString(R.string.xwalkNotFoundText) + Constants.XWALKVERSION, false);
                            return false;
                        }
                    }
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
            if (SettingsActivity.isXwalRuntimeInstalled(getActivity()) || android.os.Build.VERSION.SDK_INT < Constants.OSVERSION_XWALK) {
                l.setEntryValues(new String[]{Constants.MODE_NORMAL, Constants.MODE_XWALK, Constants.MODE_SERVER});
            }
            else {
                l.setEntryValues(new String[]{Constants.MODE_NORMAL,  Constants.MODE_SERVER});
            }
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
        if (mode.equals(Constants.MODE_XWALK)) return r.getString(R.string.runCrosswalk);
        if (mode.equals(Constants.MODE_SERVER)) return r.getString(R.string.useExtBrowser);
        return "";
    }

    public static String getSummary(Activity a){
        SharedPreferences prefs = a.getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        String runMode = prefs.getString(Constants.RUNMODE, Constants.MODE_NORMAL);
        return a.getResources().getString(R.string.runMode)+":"+modeToLabel(a,runMode);
    }
}
