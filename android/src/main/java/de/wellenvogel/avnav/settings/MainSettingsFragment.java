package de.wellenvogel.avnav.settings;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.preference.Preference;

import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.R;

/**
 * Created by andreas on 24.10.15.
 */
public class MainSettingsFragment extends SettingsFragment {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        addPreferencesFromResource(R.xml.main_preferences);
        Preference myPref = (Preference) findPreference(Constants.WORKDIR);
        myPref.setOnPreferenceClickListener(new Preference.OnPreferenceClickListener() {
            public boolean onPreferenceClick(Preference preference) {
                //open browser or intent here
                return true;
            }
        });
    }
    public static String getSummary(Activity a){
        SharedPreferences prefs = a.getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        String workdir = prefs.getString(Constants.WORKDIR, "");
        return workdir;
    }
}
