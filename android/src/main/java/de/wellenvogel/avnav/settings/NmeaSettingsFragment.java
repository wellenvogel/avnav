package de.wellenvogel.avnav.settings;

import android.app.Activity;
import android.app.AlertDialog;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Resources;
import android.location.LocationManager;
import android.os.Bundle;
import android.preference.EditTextPreference;
import android.preference.ListPreference;
import android.preference.Preference;
import android.provider.Settings;
import android.view.View;
import android.widget.ArrayAdapter;

import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.util.ArrayList;
import java.util.Set;

import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.util.AvnLog;

/**
 * Created by andreas on 24.10.15.
 */
public class NmeaSettingsFragment extends SettingsFragment {
    private ListPreference nmeaSelector;
    private ListPreference aisSelector;
    private EditTextPreference blueToothDevice;
    //list pref values
    private static final String MODE_INTERNAL="internal";
    private static final String MODE_IP="ip";
    private static final String MODE_BLUETOOTH="bluetooth";
    private static final String MODE_NONE="none";
    private BluetoothAdapter bluetoothAdapter;
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        bluetoothAdapter=BluetoothAdapter.getDefaultAdapter();
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
        blueToothDevice=(EditTextPreference) findPreference(Constants.BTDEVICE);
        if (blueToothDevice != null){
            if (bluetoothAdapter==null) {
                getPreferenceScreen().removePreference(blueToothDevice);
                blueToothDevice=null;
            }
            else {
                blueToothDevice.setOnPreferenceClickListener(new Preference.OnPreferenceClickListener() {
                    @Override
                    public boolean onPreferenceClick(Preference preference) {
                        blueToothDevice.getDialog().dismiss();
                        if (bluetoothAdapter != null && ! bluetoothAdapter.isEnabled()){
                            Intent enableBtIntent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
                            startActivityForResult(enableBtIntent, 1);
                            return false;
                        }
                        AlertDialog.Builder builder = new AlertDialog.Builder(getActivity());
                        builder.setTitle(R.string.selectBlueTooth);
                        final ArrayList<String> items=getBlueToothDevices();
                        ArrayAdapter<String> adapter=new ArrayAdapter<String>(getActivity(),android.R.layout.simple_list_item_1,items);
                        builder.setAdapter(adapter, new DialogInterface.OnClickListener() {
                            @Override
                            public void onClick(DialogInterface dialog, int which) {
                                String name=items.get(which);
                                blueToothDevice.setText(name);
                            }
                        });
                        builder.setNegativeButton(R.string.cancel, new DialogInterface.OnClickListener() {
                            @Override
                            public void onClick(DialogInterface dialog, int which) {
                                dialog.cancel();
                            }
                        });
                        builder.create().show();
                        return false;
                    }
                });
            }
        }
        Preference ipPort=findPreference(Constants.IPPORT);
        if (ipPort != null){
            ((CheckEditTextPreference)ipPort).setChecker(new ISettingsChecker() {
                @Override
                public String checkValue(String newValue) {
                    return checkNumberRange(newValue,0,1<<17-1);
                }
            });
        }
        setDefaults(R.xml.nmea_preferences,true);

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

    private ArrayList<String> getBlueToothDevices(){
        ArrayList<String> rt=new ArrayList<String>();
        if (bluetoothAdapter == null) return rt;
        if (! bluetoothAdapter.isEnabled()) return rt;
        Set<BluetoothDevice> pairedDevices = bluetoothAdapter.getBondedDevices();
        for (BluetoothDevice d: pairedDevices){
            AvnLog.d("found bluetooth device " + d.getName() + ",class=" + d.getBluetoothClass().toString());
            rt.add(d.getName());
        }
        return rt;
    }

    private void fillData(Activity a){
        SharedPreferences prefs=a.getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        Resources res=a.getResources();
        nmeaSelector.setEntries(new String[]{getModeEntrieNmea(res,MODE_NONE),getModeEntrieNmea(res,MODE_INTERNAL),getModeEntrieNmea(res,MODE_IP),getModeEntrieNmea(res,MODE_BLUETOOTH)});
        if (bluetoothAdapter == null) {
            nmeaSelector.setEntryValues(new String[]{MODE_NONE, MODE_INTERNAL, MODE_IP});
            aisSelector.setEntryValues(new String[]{MODE_NONE,MODE_IP});
        }
        else {
            nmeaSelector.setEntryValues(new String[]{MODE_NONE, MODE_INTERNAL, MODE_IP, MODE_BLUETOOTH});
            aisSelector.setEntryValues(new String[]{MODE_NONE,MODE_IP,MODE_BLUETOOTH});
        }
        String e[]=new String[nmeaSelector.getEntryValues().length];
        for (int i=0;i<nmeaSelector.getEntryValues().length;i++){
            e[i]=getModeEntrieNmea(res,nmeaSelector.getEntryValues()[i]);
        }
        nmeaSelector.setEntries(e);
        int nmeasel=nmeaSelector.findIndexOfValue(getNmeaMode(prefs));
        if (nmeasel<0) nmeasel=0;
        nmeaSelector.setValueIndex(nmeasel);
        nmeaSelector.setSummary(nmeaSelector.getEntry());
        e=new String[aisSelector.getEntryValues().length];
        for (int i=0;i<aisSelector.getEntryValues().length;i++){
            e[i]=getModeEntrieAis(res,aisSelector.getEntryValues()[i]);
        }
        aisSelector.setEntries(e);
        int aissel=aisSelector.findIndexOfValue(getAisMode(prefs));
        if (aissel<0) aissel=0;
        aisSelector.setValueIndex(aissel);
        aisSelector.setSummary(aisSelector.getEntry());
    }

    private static String getModeEntrieAis(Resources res,CharSequence mode){
        if (mode.equals(MODE_NONE)) return res.getString(R.string.labelSettingsNone);
        if (mode.equals(MODE_IP)) return res.getString(R.string.externalGps);
        if (mode.equals(MODE_BLUETOOTH)) return res.getString(R.string.bluetoothLabel);
        return "";
    }
    private static String getModeEntrieNmea(Resources res,CharSequence mode){
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
