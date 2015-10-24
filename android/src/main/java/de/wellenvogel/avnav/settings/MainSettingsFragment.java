package de.wellenvogel.avnav.settings;

import android.os.Bundle;

import de.wellenvogel.avnav.main.R;

/**
 * Created by andreas on 24.10.15.
 */
public class MainSettingsFragment extends SettingsFragment {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        addPreferencesFromResource(R.xml.main_preferences);
    }
}
