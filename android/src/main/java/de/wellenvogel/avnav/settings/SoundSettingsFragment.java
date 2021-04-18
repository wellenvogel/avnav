package de.wellenvogel.avnav.settings;

import android.os.Bundle;
import android.preference.Preference;

import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.R;

/**
 * Created by andreas on 24.10.15.
 */
public class SoundSettingsFragment extends SettingsFragment {

    private Preference setDefaultPref;


    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        addPreferencesFromResource(R.xml.sound_preferences);
        setDefaultPref=getPreferenceScreen().findPreference("prefs.default");
        setDefaultPref.setOnPreferenceClickListener(new Preference.OnPreferenceClickListener() {
            @Override
            public boolean onPreferenceClick(Preference preference) {
                setDefaults(R.xml.sound_preferences);
                return false;
            }
        });
        setDefaults(R.xml.sound_preferences,true);
    }

}
