package de.wellenvogel.avnav.settings;

import android.os.Bundle;

import de.wellenvogel.avnav.main.R;

/**
 * Created by andreas on 24.10.15.
 */
public class BluetoothSettingsFragment extends SettingsFragment {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        addPreferencesFromResource(R.xml.bluetooth_preferences);
    }
}
