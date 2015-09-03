package de.wellenvogel.avnav.main;

import android.content.SharedPreferences;
import android.os.Bundle;
import android.preference.*;
import android.view.Menu;
import android.view.MenuItem;

import java.util.Map;

/**
 * Created by andreas on 03.09.15.
 */

public class SettingsActivity extends PreferenceActivity implements SharedPreferences.OnSharedPreferenceChangeListener{
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getPreferenceManager().setSharedPreferencesName(AvNav.PREFNAME);
        addPreferencesFromResource(R.xml.preferences);
        getActionBar().setDisplayHomeAsUpEnabled(true);
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        if (item.getItemId() == android.R.id.home){
            finish();
        }
        return super.onOptionsItemSelected(item);
    }
    @Override
    public boolean onCreateOptionsMenu(Menu menu){
        return true;
    }
    @Override
    protected void onResume() {
        super.onResume();
        getPreferenceScreen().getSharedPreferences()
                .registerOnSharedPreferenceChangeListener(this);
        updateTextSummaries(getPreferenceScreen());

    }

    private void updateTextSummaries(PreferenceGroup cat){
        for (int i=0;i<cat.getPreferenceCount();i++){
            Preference pref=cat.getPreference(i);
            if (pref instanceof EditTextPreference){
                pref.setSummary(((EditTextPreference) pref).getText());
            }
            if (pref instanceof PreferenceGroup){
                updateTextSummaries((PreferenceGroup) pref);
            }
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        getPreferenceScreen().getSharedPreferences()
                .unregisterOnSharedPreferenceChangeListener(this);
    }

    @Override
    public void onSharedPreferenceChanged(SharedPreferences sharedPreferences, String key) {
        Preference pref=findPreference(key);
        if (pref != null){
            if (pref instanceof EditTextPreference){
                pref.setSummary(((EditTextPreference) pref).getText());
            }
        }
    }
}

