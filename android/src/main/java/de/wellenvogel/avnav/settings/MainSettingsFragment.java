package de.wellenvogel.avnav.settings;

import android.app.Activity;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.storage.StorageManager;
import android.os.storage.StorageVolume;
import android.preference.CheckBoxPreference;
import android.preference.EditTextPreference;
import android.preference.ListPreference;
import android.preference.Preference;
import android.provider.DocumentsContract;
import android.widget.CheckBox;
import android.widget.ListPopupWindow;
import android.widget.Toast;

import java.io.File;
import java.util.List;

import androidx.appcompat.view.menu.ListMenuPresenter;
import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.util.AvnWorkDir;
import de.wellenvogel.avnav.util.DialogBuilder;
import de.wellenvogel.avnav.worker.GpsService;

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
            try {
                startActivityForResult(intent, CHARTDIR_REQUEST);
            }catch (Throwable t){
                Toast.makeText(getActivity(), R.string.noFileManager,Toast.LENGTH_LONG).show();
            }
        }
    }
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        addPreferencesFromResource(R.xml.main_preferences);
        final EditTextPreference myChartPref = (EditTextPreference) findPreference(Constants.CHARTDIR);
        if (myChartPref != null) {
            myChartPref.setOnPreferenceClickListener(new Preference.OnPreferenceClickListener() {
                public boolean onPreferenceClick(final Preference preference) {
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
                    String startDir;
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
        Preference setDefaultPref=getPreferenceScreen().findPreference("prefs.default");
        setDefaultPref.setOnPreferenceClickListener(new Preference.OnPreferenceClickListener() {
            @Override
            public boolean onPreferenceClick(Preference preference) {
                DialogBuilder.confirmDialog(MainSettingsFragment.this.getActivity(), R.string.reset,
                        R.string.reallyResetHandlers, new DialogInterface.OnClickListener() {
                            @Override
                            public void onClick(DialogInterface dialog, int which) {
                                if (which == DialogInterface.BUTTON_POSITIVE){
                                    setDefaults(R.xml.main_preferences,false);
                                    GpsService.resetWorkerConfig(MainSettingsFragment.this.getActivity());
                                }
                            }
                        });
                return false;
            }
        });
        Preference resetChartDir=findPreference(Constants.RESET_CHARTDIR);
        ExternalDialogEditTextPreference chartDir= (ExternalDialogEditTextPreference) findPreference(Constants.CHARTDIR);
        if (resetChartDir != null && chartDir != null){
            resetChartDir.setOnPreferenceClickListener(new Preference.OnPreferenceClickListener() {
                @Override
                public boolean onPreferenceClick(Preference preference) {
                    chartDir.setText("");
                    return true;
                }
            });
        }
        ListPreference wd=(ListPreference)getPreferenceScreen().findPreference(Constants.WORKDIR);
        wd.setOnPreferenceChangeListener(new Preference.OnPreferenceChangeListener() {
            @Override
            public boolean onPreferenceChange(Preference preference, Object newValue) {
                ListPreference lp=(ListPreference)preference;
                String ov=lp.getValue();
                String nv=(String)newValue;
                if (nv != null && nv.equals(ov)) return false;
                DialogBuilder.confirmDialog(MainSettingsFragment.this.getActivity(), R.string.warning, R.string.wdChange, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        if (which == DialogInterface.BUTTON_POSITIVE){
                            lp.setValue(nv);
                        }
                    }
                });
                return false;
            }
        });
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
        if (pref.getKey().equals(Constants.WORKDIR)){
            updateListSummary((ListPreference)pref);
        }
        return true;
    }

    private void fillData() {
        ListPreference wd=(ListPreference)getPreferenceScreen().findPreference(Constants.WORKDIR);
        if (wd != null){
            AvnUtil.WorkDir parser=new AvnUtil.WorkDir(true);
            SharedPreferences prefs = getActivity().getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
            String workdir = prefs.getString(Constants.WORKDIR, Constants.INTERNAL_WORKDIR);
            parser.fill(getActivity());
            List<AvnWorkDir.Entry> entries=parser.getEntries();
            String [] labels=new String[entries.size()];
            String [] values=new String[entries.size()];
            int selected=-1;
            for (int idx=0;idx < entries.size();idx++){
                AvnWorkDir.Entry e=entries.get(idx);
                labels[idx]=e.getTitle();
                values[idx]=e.getConfigName();
                if (e.getConfigName().equals(workdir)) selected=idx;
            }
            wd.setEntryValues(values);
            wd.setEntries(labels);
            if (selected >= 0) wd.setValueIndex(selected);
            updateListSummary(wd);
        }
    }
    private void updateListSummary(ListPreference l){
        l.setSummary(getShortWd(getActivity(),l.getValue()));
    }

    static private String getShortWd(Context ctx,String configName){
        AvnUtil.WorkDir parser=new AvnUtil.WorkDir(false);
        AvnWorkDir.Entry e=parser.getEntryForConfig(ctx,configName);
        if (e == null){
            return "unknown";
        }
        return e.getShortName();
    }

    public static String getSummary(Activity a){
        SharedPreferences prefs = a.getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        String workdir = prefs.getString(Constants.WORKDIR, Constants.INTERNAL_WORKDIR);
        return getShortWd(a,workdir);
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
