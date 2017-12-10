package de.wellenvogel.avnav.settings;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.preference.EditTextPreference;
import android.preference.Preference;
import android.widget.Toast;

import java.io.File;

import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.main.SimpleFileDialog;
import de.wellenvogel.avnav.util.AvnLog;

/**
 * Created by andreas on 24.10.15.
 */
public class ExpertSettingsFragment extends SettingsFragment {

    private Preference setDefaultPref;


    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        addPreferencesFromResource(R.xml.expert_preferences);
        final SharedPreferences prefs=getActivity().getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        setDefaultPref=getPreferenceScreen().findPreference("prefs.default");
        setDefaultPref.setOnPreferenceClickListener(new Preference.OnPreferenceClickListener() {
            @Override
            public boolean onPreferenceClick(Preference preference) {
                setDefaults(R.xml.expert_preferences);
                return false;
            }
        });
        setDefaults(R.xml.expert_preferences,true);
        Preference ipPort=findPreference(Constants.WEBSERVERPORT);
        if (ipPort != null){
            ((CheckEditTextPreference)ipPort).setChecker(new ISettingsChecker() {
                @Override
                public String checkValue(String newValue) {
                    return checkNumberRange(newValue,0,1<<17-1);
                }
            });
        }

        final DefaultsEditTextPreference anchor=(DefaultsEditTextPreference) findPreference(Constants.ANCHORALARM);
        if (anchor != null){
            anchor.setOnPreferenceClickListener(new Preference.OnPreferenceClickListener() {
                public boolean onPreferenceClick(final Preference preference) {
                    //open browser or intent here
                    SimpleFileDialog FolderChooseDialog = new SimpleFileDialog(getActivity(), SimpleFileDialog.FileOpenDefault,
                            new SimpleFileDialog.SimpleFileDialogListener() {
                                @Override
                                public void onChosenDir(String chosenDir) {
                                    // The code in this function will be executed when the dialog OK button is pushed
                                    ((EditTextPreference)preference).setText(chosenDir);
                                    anchor.getDialog().dismiss();
                                }

                                @Override
                                public void onCancel() {
                                    anchor.getDialog().dismiss();
                                }
                            });
                    FolderChooseDialog.Default_File_Name=anchor.getDefaultValue();
                    FolderChooseDialog.Selected_File_Name=anchor.getText();
                    FolderChooseDialog.dialogTitle=getString(R.string.labelSettingsAnchorAlarm);
                    FolderChooseDialog.newFolderNameText=getString(R.string.newFolderName);
                    FolderChooseDialog.newFolderText=getString(R.string.createFolder);
                    String start="";
                    if (anchor.getText().startsWith("/")){
                        try{
                            File current=new File(anchor.getText());
                            start = current.getParentFile().getCanonicalPath();
                            FolderChooseDialog.Selected_File_Name=current.getName();
                        }catch (Exception e){}
                    }
                    FolderChooseDialog.chooseFile_or_Dir(start);
                    return true;
                }
            });
        }


    }

    @Override
    public void onResume() {
        super.onResume();
    }

}
