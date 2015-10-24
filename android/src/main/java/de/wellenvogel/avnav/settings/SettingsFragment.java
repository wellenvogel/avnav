package de.wellenvogel.avnav.settings;

import android.app.Activity;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.preference.EditTextPreference;
import android.preference.Preference;
import android.preference.PreferenceFragment;
import android.preference.PreferenceGroup;

import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.R;

/**
 * Created by andreas on 24.10.15.
 */
public class SettingsFragment extends PreferenceFragment implements SharedPreferences.OnSharedPreferenceChangeListener {
    @Override
    public void onSharedPreferenceChanged(SharedPreferences sharedPreferences, String key) {
        Preference pref = findPreference(key);
        if (pref != null) {
            if (updatePreferenceSummary(pref)) {
                if (pref instanceof EditTextPreference) {
                    pref.setSummary(((EditTextPreference) pref).getText());
                }
            }
        }
        updateActivity();
    }

    /**
     * override this
     * @param pref
     * @return false if no further handling
     */
    protected boolean updatePreferenceSummary(Preference pref){
        return true;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getPreferenceManager().setSharedPreferencesName(Constants.PREFNAME);
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
