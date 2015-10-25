package de.wellenvogel.avnav.settings;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Resources;
import android.location.LocationManager;
import android.os.Bundle;
import android.preference.ListPreference;
import android.preference.Preference;
import android.provider.Settings;

import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.R;

/**
 * Created by andreas on 24.10.15.
 */
public class NmeaSettingsFragment extends SettingsFragment {
    private ListPreference nmeaSelector;
    private ListPreference aisSelector;
    //list pref values
    private static final String MODE_INTERNAL="internal";
    private static final String MODE_IP="ip";
    private static final String MODE_BLUETOOTH="bluetooth";
    private static final String MODE_NONE="none";
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        addPreferencesFromResource(R.xml.nmea_preferences);
        final SharedPreferences prefs=getActivity().getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        Preference p=getPreferenceScreen().findPreference("nmeaInput");
        if (p != null) nmeaSelector=(ListPreference)p;
        if (nmeaSelector != null){
            nmeaSelector.setOnPreferenceChangeListener(new Preference.OnPreferenceChangeListener() {
                @Override
                public boolean onPreferenceChange(Preference preference, Object newValue) {
                    String nval=(String)newValue;
                    updateNmeaMode(prefs, nval);
                    ((ListPreference)preference).setSummary(getModeEntrieNmea(getActivity().getResources(),nval));
                    if (nval.equals(MODE_INTERNAL)) checkGpsEnabled(getActivity(),true);
                    return true;
                }
            });
        }
        p=getPreferenceScreen().findPreference("aisInput");
        if (p != null) aisSelector=(ListPreference)p;
        if (aisSelector != null){
            aisSelector.setOnPreferenceChangeListener(new Preference.OnPreferenceChangeListener() {
                @Override
                public boolean onPreferenceChange(Preference preference, Object newValue) {
                    String nval=(String)newValue;
                    updateAisMode(prefs,nval);
                    ((ListPreference)preference).setSummary(getModeEntrieAis(getActivity().getResources(), nval));
                    return true;
                }
            });
        }

    }

    @Override
    public void onResume() {
        super.onResume();
        fillData(getActivity());
        checkGpsEnabled(getActivity(),false);
    }

    public static void checkGpsEnabled(Activity activity,boolean force) {
        if (! force) {
            SharedPreferences prefs = activity.getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
            String nmeaMode = getNmeaMode(prefs);
            if (!nmeaMode.equals(MODE_INTERNAL)) return;
        }
        LocationManager locationService = (LocationManager) activity.getSystemService(activity.LOCATION_SERVICE);
        boolean enabled = locationService.isProviderEnabled(LocationManager.GPS_PROVIDER);
        // check if enabled and if not send user to the GSP settings
        // Better solution would be to display a dialog and suggesting to
        // go to the settings
        if (!enabled) {
            final AlertDialog.Builder builder = new AlertDialog.Builder(activity);
            builder.setMessage(R.string.noLocation);
            builder.setPositiveButton(R.string.ok, new DialogInterface.OnClickListener() {
                public void onClick(DialogInterface dialog, int id) {
                    // User clicked OK button
                    Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
                    builder.getContext().startActivity(intent);
                }
            });
            builder.setNegativeButton(R.string.cancel, new DialogInterface.OnClickListener() {
                public void onClick(DialogInterface dialog, int id) {
                    // User cancelled the dialog
                }
            });
            AlertDialog dialog = builder.create();
            dialog.show();

        }
    }

    private void fillData(Activity a){
        SharedPreferences prefs=a.getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        Resources res=a.getResources();
        nmeaSelector.setEntries(new String[]{getModeEntrieNmea(res,MODE_NONE),getModeEntrieNmea(res,MODE_INTERNAL),getModeEntrieNmea(res,MODE_IP),getModeEntrieNmea(res,MODE_BLUETOOTH)});
        nmeaSelector.setEntryValues(new String[]{MODE_NONE,MODE_INTERNAL,MODE_IP,MODE_BLUETOOTH});
        int nmeasel=nmeaSelector.findIndexOfValue(getNmeaMode(prefs));
        if (nmeasel<0) nmeasel=0;
        nmeaSelector.setValueIndex(nmeasel);
        nmeaSelector.setSummary(nmeaSelector.getEntry());
        aisSelector.setEntries(new String[]{getModeEntrieAis(res,MODE_NONE),getModeEntrieAis(res,MODE_IP),getModeEntrieAis(res,MODE_BLUETOOTH)});
        aisSelector.setEntryValues(new String[]{MODE_NONE,MODE_IP,MODE_BLUETOOTH});
        int aissel=aisSelector.findIndexOfValue(getAisMode(prefs));
        if (aissel<0) aissel=0;
        aisSelector.setValueIndex(aissel);
        aisSelector.setSummary(aisSelector.getEntry());
    }

    private static String getModeEntrieAis(Resources res,String mode){
        if (mode.equals(MODE_NONE)) return res.getString(R.string.labelSettingsNone);
        if (mode.equals(MODE_IP)) return res.getString(R.string.externalGps);
        if (mode.equals(MODE_BLUETOOTH)) return res.getString(R.string.bluetoothLabel);
        return "";
    }
    private static String getModeEntrieNmea(Resources res,String mode){
        if (mode.equals(MODE_NONE)) return res.getString(R.string.labelSettingsNone);
        if (mode.equals(MODE_INTERNAL)) return res.getString(R.string.labelInternalGps);
        if (mode.equals(MODE_IP)) return res.getString(R.string.externalGps);
        if (mode.equals(MODE_BLUETOOTH)) return res.getString(R.string.bluetoothLabel);
        return "";
    }

    private static String getNmeaMode(SharedPreferences prefs){
        if (prefs.getBoolean(Constants.INTERNALGPS,false)) return MODE_INTERNAL;
        if (prefs.getBoolean(Constants.IPNMEA,false)) return MODE_IP;
        if (prefs.getBoolean(Constants.BTNMEA,false)) return MODE_BLUETOOTH;
        return MODE_NONE;
    }
    private static String getAisMode(SharedPreferences prefs){
        if (prefs.getBoolean(Constants.IPAIS,false)) return MODE_IP;
        if (prefs.getBoolean(Constants.BTAIS,false)) return MODE_BLUETOOTH;
        return MODE_NONE;
    }
    private void updateNmeaMode(SharedPreferences prefs,String mode){
        SharedPreferences.Editor e=prefs.edit();
        if (mode.equals(MODE_BLUETOOTH)){
            e.putBoolean(Constants.BTNMEA,true);
            e.putBoolean(Constants.IPNMEA,false);
            e.putBoolean(Constants.INTERNALGPS,false);
        }
        else if (mode.equals(MODE_IP)){
            e.putBoolean(Constants.BTNMEA,false);
            e.putBoolean(Constants.IPNMEA,true);
            e.putBoolean(Constants.INTERNALGPS,false);
        }
        else if (mode.equals(MODE_INTERNAL)){
            e.putBoolean(Constants.BTNMEA,false);
            e.putBoolean(Constants.IPNMEA,false);
            e.putBoolean(Constants.INTERNALGPS,true);
        }
        else {
            e.putBoolean(Constants.BTNMEA, false);
            e.putBoolean(Constants.IPNMEA, false);
            e.putBoolean(Constants.INTERNALGPS, false);
        }
        e.apply();
    }

    private void updateAisMode(SharedPreferences prefs,String mode){
        SharedPreferences.Editor e=prefs.edit();
        if (mode.equals(MODE_BLUETOOTH)){
            e.putBoolean(Constants.BTAIS,true);
            e.putBoolean(Constants.IPAIS,false);
        }
        else if (mode.equals(MODE_IP)){
            e.putBoolean(Constants.BTAIS,false);
            e.putBoolean(Constants.IPAIS,true);
        }
        else {
            e.putBoolean(Constants.BTAIS, false);
            e.putBoolean(Constants.IPAIS, false);
        }
        e.apply();
    }

    public static String getSummary(Activity a){
        String rt="";
        SharedPreferences prefs=a.getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        Resources res=a.getResources();
        String aisMode=getAisMode(prefs);
        String nmeaMode=getNmeaMode(prefs);
        if (aisMode.equals(nmeaMode)){
            rt=res.getString(R.string.labelSettingsAisInput)+","+res.getString(R.string.labelSettingsNmeaInput)+": "+getModeEntrieNmea(res, nmeaMode);
        }
        else {
            rt = res.getString(R.string.labelSettingsNmeaInput)+": "+getModeEntrieNmea(res,nmeaMode)+", "+res.getString(R.string.labelSettingsAisInput)+": "+getModeEntrieAis(res,aisMode);
        }
        return rt;
    }
}
