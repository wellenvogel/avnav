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
                                public void onChosenDir(File chosenDir) {
                                    ((EditTextPreference)preference).setText(chosenDir.getAbsolutePath());
                                    anchor.getDialog().dismiss();
                                }

                                @Override
                                public void onCancel() {
                                    anchor.getDialog().dismiss();
                                }

                                @Override
                                public void onDefault() {
                                    ((EditTextPreference)preference).setText(anchor.getDefaultValue());
                                }
                            });
                    FolderChooseDialog.Selected_File_Name=anchor.getText();
                    FolderChooseDialog.dialogTitle=getString(R.string.labelSettingsAnchorAlarm);
                    FolderChooseDialog.newFolderNameText=getString(R.string.newFolderName);
                    FolderChooseDialog.newFolderText=getString(R.string.createFolder);
                    String start = "";
                    try {
                        if (anchor.getText().startsWith("/")) {
                            File current = new File(anchor.getText());
                            start = current.getParentFile().getCanonicalPath();
                            FolderChooseDialog.Selected_File_Name = current.getName();
                        } else {
                            start = getActivity().getFilesDir().getAbsolutePath();
                            FolderChooseDialog.Selected_File_Name = anchor.getText();
                        }
                        FolderChooseDialog.setStartDir(start);
                    } catch (Exception e) {
                        Toast.makeText(getActivity(), e.getMessage(), Toast.LENGTH_SHORT).show();
                        ((EditTextPreference) preference).setText(anchor.getDefaultValue());
                        return false;
                    }
                    FolderChooseDialog.chooseFile_or_Dir(false);
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
