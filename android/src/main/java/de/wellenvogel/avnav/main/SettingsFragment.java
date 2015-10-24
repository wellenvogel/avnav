package de.wellenvogel.avnav.main;

import android.app.Activity;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.preference.EditTextPreference;
import android.preference.Preference;
import android.preference.PreferenceFragment;
import android.preference.PreferenceGroup;

/**
 * Created by andreas on 24.10.15.
 */
public class SettingsFragment extends PreferenceFragment implements SharedPreferences.OnSharedPreferenceChangeListener {
    @Override
    public void onSharedPreferenceChanged(SharedPreferences sharedPreferences, String key) {
        Preference pref = findPreference(key);
        if (pref != null) {
            if (pref instanceof EditTextPreference) {
                pref.setSummary(((EditTextPreference) pref).getText());
            }
        }
        updateActivity();
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Load the preferences from an XML resource
        getPreferenceManager().setSharedPreferencesName(Constants.PREFNAME);
        String settings = getArguments().getString("fragmentName");
        if ("ip".equals(settings)) {
            addPreferencesFromResource(R.xml.ip_preferences);
        } else if ("bluetooth".equals(settings)) {
            addPreferencesFromResource(R.xml.bluetooth_preferences);
        }
        getActivity().getActionBar().setDisplayHomeAsUpEnabled(true);
    }

    public void onResume() {
        super.onResume();
        getPreferenceScreen().getSharedPreferences()
                .registerOnSharedPreferenceChangeListener(this);
        updateTextSummaries(getPreferenceScreen());
        getActivity().getActionBar().setDisplayHomeAsUpEnabled(true);

    }

    private void updateTextSummaries(PreferenceGroup cat) {
        for (int i = 0; i < cat.getPreferenceCount(); i++) {
            Preference pref = cat.getPreference(i);
            if (pref instanceof EditTextPreference) {
                pref.setSummary(((EditTextPreference) pref).getText());
            }
            if (pref instanceof PreferenceGroup) {
                updateTextSummaries((PreferenceGroup) pref);
            }
        }
        updateActivity();
    }

    private void updateActivity(){
        Activity a=getActivity();
        if (a instanceof SettingsActivity){
            ((SettingsActivity)a).updateHeaderSummaries(true);
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        getPreferenceScreen().getSharedPreferences()
                .unregisterOnSharedPreferenceChangeListener(this);
    }


}
