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



    }

    @Override
    public void onResume() {

        super.onResume();
        //setPreferenceScreen(null);
        //addPreferencesFromResource(R.xml.expert_preferences);
    }

}
