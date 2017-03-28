package de.wellenvogel.avnav.settings;

import android.app.Activity;
import android.app.PendingIntent;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.res.Resources;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.preference.EditTextPreference;
import android.preference.ListPreference;
import android.preference.Preference;
import android.provider.Settings;
import android.util.Log;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.ListView;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Map;
import java.util.Set;

import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.DialogBuilder;
import de.wellenvogel.avnav.main.Constants;

import static de.wellenvogel.avnav.main.Constants.MODE_BLUETOOTH;
import static de.wellenvogel.avnav.main.Constants.MODE_INTERNAL;
import static de.wellenvogel.avnav.main.Constants.MODE_IP;
import static de.wellenvogel.avnav.main.Constants.MODE_NONE;
import static de.wellenvogel.avnav.main.Constants.MODE_USB;

/**
 * Created by andreas on 24.10.15.
 */
public class NmeaSettingsFragment extends SettingsFragment {
    private ListPreference nmeaSelector;
    private ListPreference aisSelector;
    private EditTextPreference blueToothDevice;
    private EditTextPreference usbDevice;
    //list pref values
    private BluetoothAdapter bluetoothAdapter;
    private UsbManager usbManager;
    private PendingIntent mPermissionIntent;
    private static final String ACTION_USB_PERMISSION =
            "de.wellenvogel.avnav.USB_PERMISSION";
    private final BroadcastReceiver mUsbReceiver = new BroadcastReceiver() {

        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            if (ACTION_USB_PERMISSION.equals(action)) {
                synchronized (this) {
                    UsbDevice device = (UsbDevice)intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);

                    if (intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)) {
                        if(device != null){
                            usbDevice.setText(device.getDeviceName());
                        }
                    }
                    else {
                        AvnLog.i(AvnLog.LOGPREFIX, "permission denied for device " + device);
                    }
                }
            }
        }
    };
    private ListPreference usbBaudSelector;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        mPermissionIntent = PendingIntent.getBroadcast(this.getActivity(), 0, new Intent(ACTION_USB_PERMISSION), 0);
        IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);
        getActivity().registerReceiver(mUsbReceiver, filter);
        bluetoothAdapter=BluetoothAdapter.getDefaultAdapter();
        usbManager=(UsbManager) getActivity().getSystemService(Context.USB_SERVICE);
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
        p=getPreferenceScreen().findPreference(Constants.USBBAUD);
        if (p != null) usbBaudSelector=(ListPreference)p;
        if (usbBaudSelector != null){
            usbBaudSelector.setOnPreferenceChangeListener(new Preference.OnPreferenceChangeListener() {
                @Override
                public boolean onPreferenceChange(Preference preference, Object newValue) {
                    String nval=(String)newValue;
                    ((ListPreference)preference).setSummary(nval);
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
                        if (bluetoothAdapter != null && ! bluetoothAdapter.isEnabled()){
                            Intent enableBtIntent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
                            startActivityForResult(enableBtIntent, 1);
                            return false;
                        }
                        final DialogBuilder builder=new DialogBuilder(getActivity(),R.layout.dialog_selectlist);
                        builder.setTitle(R.string.selectBlueTooth);
                        final ArrayList<String> items=getBlueToothDevices();
                        ArrayAdapter<String> adapter=new ArrayAdapter<String>(getActivity(),R.layout.list_item,items);
                        ListView lv=(ListView)builder.getContentView().findViewById(R.id.list_value);
                        lv.setAdapter(adapter);
                        String current=blueToothDevice.getText();
                        if (current != null && ! current.isEmpty()){
                            for (int i=0;i<items.size();i++){
                                if (items.get(i).equals(current)){
                                    lv.setItemChecked(i,true);
                                    break;
                                }
                            }
                        }
                        lv.setOnItemClickListener(new AdapterView.OnItemClickListener() {
                            @Override
                            public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
                                String name=items.get(position);
                                blueToothDevice.setText(name);
                                builder.dismiss();
                            }
                        });
                        builder.setNegativeButton(R.string.cancel, new DialogInterface.OnClickListener() {
                            @Override
                            public void onClick(DialogInterface dialog, int which) {

                            }
                        });
                        builder.show();
                        return false;
                    }
                });
            }
        }
        usbDevice=(EditTextPreference) findPreference(Constants.USBDEVICE);
        if (usbDevice != null){
            if (usbManager==null) {
                getPreferenceScreen().removePreference(usbDevice);
                usbDevice=null;
            }
            else {
                usbDevice.setOnPreferenceClickListener(new Preference.OnPreferenceClickListener() {
                    @Override
                    public boolean onPreferenceClick(Preference preference) {
                        final DialogBuilder builder=new DialogBuilder(getActivity(),R.layout.dialog_selectlist);
                        builder.setTitle(R.string.selectUsb);
                        final ArrayList<UsbDeviceForList> items=getUsbDevices();
                        ArrayAdapter<UsbDeviceForList> adapter=new ArrayAdapter<UsbDeviceForList>(getActivity(),R.layout.list_item,items);
                        ListView lv=(ListView)builder.getContentView().findViewById(R.id.list_value);
                        lv.setAdapter(adapter);
                        String current=usbDevice.getText();
                        if (current != null && ! current.isEmpty()){
                            for (int i=0;i<items.size();i++){
                                if (items.get(i).getDev().getDeviceName().equals(current)){
                                    lv.setItemChecked(i,true);
                                    break;
                                }
                            }
                        }
                        lv.setOnItemClickListener(new AdapterView.OnItemClickListener() {
                            @Override
                            public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
                                UsbDeviceForList dev=items.get(position);
                                if (usbManager == null) return;
                                usbManager.requestPermission(dev.getDev(),mPermissionIntent);
                                builder.dismiss();
                            }
                        });
                        builder.setNegativeButton(R.string.cancel, new DialogInterface.OnClickListener() {
                            @Override
                            public void onClick(DialogInterface dialog, int which) {

                            }
                        });
                        builder.show();
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

    @Override
    public void onDestroy() {
        super.onDestroy();
        getActivity().unregisterReceiver(mUsbReceiver);
    }

    public static void checkGpsEnabled(final Activity activity, boolean force) {
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
            DialogBuilder.confirmDialog(activity, 0, R.string.noLocation, new DialogInterface.OnClickListener() {
                @Override
                public void onClick(DialogInterface dialog, int which) {
                    if (which == DialogInterface.BUTTON_POSITIVE){
                        Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
                        activity.startActivity(intent);
                    }
                }
            });
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

    private static class UsbDeviceForList{
        private UsbDevice dev;
        UsbDeviceForList(UsbDevice dev){
            this.dev=dev;
        }
        @Override
        public String toString(){
            String rt=this.dev.getDeviceName();
            if (Build.VERSION.SDK_INT >= 16){
                try {
                    Method m=UsbDevice.class.getDeclaredMethod("getProductName");
                    m.setAccessible(true);
                    rt+=":"+(String)m.invoke(this.dev);
                } catch (Exception e) {
                }
            }
            return rt;
        }
        public UsbDevice getDev(){
            return dev;
        }
    }
    private ArrayList<UsbDeviceForList> getUsbDevices(){
        ArrayList<UsbDeviceForList> rt=new ArrayList<UsbDeviceForList>();
        if (usbManager == null) return rt;
        Map<String,UsbDevice> devices = usbManager.getDeviceList();
        for (String d: devices.keySet()){
            UsbDevice dev=devices.get(d);
            //from the example at: https://github.com/felHR85/SerialPortExample/blob/master/example/src/main/java/com/felhr/serialportexample/UsbService.java
            //classes seem to be incorrect...
            int deviceVID = dev.getVendorId();
            int devicePID = dev.getProductId();
            AvnLog.d("found USB device " + d + ",class=" + dev.getDeviceClass());
            if (deviceVID != 0x1d6b && (devicePID != 0x0001 || devicePID != 0x0002 || devicePID != 0x0003)) {
                rt.add(new UsbDeviceForList(dev));
            }
        }
        return rt;
    }



    private void fillData(Activity a){
        SharedPreferences prefs=a.getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        Resources res=a.getResources();
        nmeaSelector.setEntries(new String[]{getModeEntrieNmea(res,MODE_NONE),getModeEntrieNmea(res,MODE_INTERNAL),getModeEntrieNmea(res,MODE_IP),getModeEntrieNmea(res,MODE_BLUETOOTH)});
        if (bluetoothAdapter == null) {
            nmeaSelector.setEntryValues(new String[]{MODE_NONE, MODE_INTERNAL, MODE_IP,MODE_USB});
            aisSelector.setEntryValues(new String[]{MODE_NONE,MODE_IP,MODE_USB});
        }
        else {
            nmeaSelector.setEntryValues(new String[]{MODE_NONE, MODE_INTERNAL, MODE_IP, MODE_BLUETOOTH,MODE_USB});
            aisSelector.setEntryValues(new String[]{MODE_NONE,MODE_IP,MODE_BLUETOOTH,MODE_USB});
        }
        String [] bauds=new String[]{"1200","2400","4800","9600","14400","19200","28800","38400","57600","115200","230400"};
        if (usbBaudSelector != null){
            usbBaudSelector.setEntryValues(bauds);
            usbBaudSelector.setEntries(bauds);
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
        if (mode.equals(MODE_USB)) return res.getString(R.string.usbLabel);
        return "";
    }
    private static String getModeEntrieNmea(Resources res,CharSequence mode){
        if (mode.equals(MODE_NONE)) return res.getString(R.string.labelSettingsNone);
        if (mode.equals(MODE_INTERNAL)) return res.getString(R.string.labelInternalGps);
        if (mode.equals(MODE_IP)) return res.getString(R.string.externalGps);
        if (mode.equals(MODE_BLUETOOTH)) return res.getString(R.string.bluetoothLabel);
        if (mode.equals(MODE_USB)) return res.getString(R.string.usbLabel);
        return "";
    }

    static public String getNmeaMode(SharedPreferences prefs){
        if (prefs.getBoolean(Constants.INTERNALGPS,false)) return MODE_INTERNAL;
        if (prefs.getBoolean(Constants.IPNMEA,false)) return MODE_IP;
        if (prefs.getBoolean(Constants.BTNMEA,false)) return MODE_BLUETOOTH;
        if (prefs.getBoolean(Constants.USBNMEA,false)) return MODE_USB;
        return MODE_NONE;
    }
    static public String getAisMode(SharedPreferences prefs){
        if (prefs.getBoolean(Constants.IPAIS,false)) return MODE_IP;
        if (prefs.getBoolean(Constants.BTAIS,false)) return MODE_BLUETOOTH;
        if (prefs.getBoolean(Constants.USBAIS,false)) return MODE_USB;
        return MODE_NONE;
    }
    static void updateNmeaMode(SharedPreferences prefs,String mode){
        SharedPreferences.Editor e=prefs.edit();
        if (mode.equals(MODE_USB)){
            e.putBoolean(Constants.USBNMEA,true);
            e.putBoolean(Constants.BTNMEA,false);
            e.putBoolean(Constants.IPNMEA,false);
            e.putBoolean(Constants.INTERNALGPS,false);
        }
        else if (mode.equals(MODE_BLUETOOTH)){
            e.putBoolean(Constants.USBNMEA,false);
            e.putBoolean(Constants.BTNMEA,true);
            e.putBoolean(Constants.IPNMEA,false);
            e.putBoolean(Constants.INTERNALGPS,false);
        }
        else if (mode.equals(MODE_IP)){
            e.putBoolean(Constants.USBNMEA,false);
            e.putBoolean(Constants.BTNMEA,false);
            e.putBoolean(Constants.IPNMEA,true);
            e.putBoolean(Constants.INTERNALGPS,false);
        }
        else if (mode.equals(MODE_INTERNAL)){
            e.putBoolean(Constants.USBNMEA,false);
            e.putBoolean(Constants.BTNMEA,false);
            e.putBoolean(Constants.IPNMEA,false);
            e.putBoolean(Constants.INTERNALGPS,true);
        }
        else {
            e.putBoolean(Constants.USBNMEA,false);
            e.putBoolean(Constants.BTNMEA, false);
            e.putBoolean(Constants.IPNMEA, false);
            e.putBoolean(Constants.INTERNALGPS, false);
        }
        e.apply();
    }

    static void updateAisMode(SharedPreferences prefs,String mode){
        SharedPreferences.Editor e=prefs.edit();
        if (mode.equals(MODE_USB)){
            e.putBoolean(Constants.USBAIS,true);
            e.putBoolean(Constants.BTAIS,false);
            e.putBoolean(Constants.IPAIS,false);
        }
        else if (mode.equals(MODE_BLUETOOTH)){
            e.putBoolean(Constants.USBAIS,false);
            e.putBoolean(Constants.BTAIS,true);
            e.putBoolean(Constants.IPAIS,false);
        }
        else if (mode.equals(MODE_IP)){
            e.putBoolean(Constants.USBAIS,false);
            e.putBoolean(Constants.BTAIS,false);
            e.putBoolean(Constants.IPAIS,true);
        }
        else {
            e.putBoolean(Constants.USBAIS,false);
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
