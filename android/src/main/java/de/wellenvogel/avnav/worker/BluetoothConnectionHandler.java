package de.wellenvogel.avnav.worker;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.content.pm.PackageManager;
import android.os.Build;

import org.json.JSONException;
import org.json.JSONObject;

import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.NmeaQueue;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Created by andreas on 25.12.14.
 */
public class BluetoothConnectionHandler extends SingleConnectionHandler {
    private EditableParameter.StringListParameter deviceSelect=new EditableParameter.StringListParameter(
            "device",
            R.string.labelSettingsBtDevice
    );
    private boolean isBluetoothAllowed(){
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return (BluetoothConnectionHandler.this.gpsService.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED);
        }
        return true;
    }
    private BluetoothConnectionHandler(String name,GpsService ctx, NmeaQueue queue) throws IOException, JSONException {
        super(name,ctx,queue);
        deviceSelect.listBuilder=new EditableParameter.ListBuilder<String>() {
            @Override
            public List<String> buildList(EditableParameter.StringListParameter param) {
                if (! isBluetoothAllowed()){
                    return new ArrayList<String>();
                }
                return filterByClaims(CLAIM_BLUETOOTH,getBluetoothDevices(),false);
            }
        };
        parameterDescriptions.add(deviceSelect);
    }
    public static class Creator extends WorkerFactory.Creator{

        @Override
        ChannelWorker create(String name, GpsService ctx, NmeaQueue queue) throws JSONException, IOException {
            if (queue == null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (ctx.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED){
                    final GpsService.MainActivityActions actions=ctx.getMainActions();
                    //only request permissions when we are in getAddable...
                    if (actions != null ) {
                        actions.showPermissionRequest(new String[]{Manifest.permission.BLUETOOTH_CONNECT}, false);
                    }
                    throw new IOException("needs bluetooth");
                }
            }
            return new BluetoothConnectionHandler(name, ctx, queue);
        }
        @Override
        boolean canAdd(GpsService ctx) {
            BluetoothAdapter adapter=BluetoothAdapter.getDefaultAdapter();
            if (adapter == null) return false;
            return adapter.isEnabled();
        }
    }

    @Override
    protected void checkParameters(JSONObject newParam) throws JSONException, IOException {
        super.checkParameters(newParam);
        String deviceName=deviceSelect.fromJson(newParam);
        checkClaim(CLAIM_BLUETOOTH,deviceName,true);
    }

    @Override
    public void run(int startSequence) throws JSONException, IOException {
        String deviceName=deviceSelect.fromJson(parameters);
        addClaim(CLAIM_BLUETOOTH,deviceName,true);
        BluetoothDevice device=null;
        while (! shouldStop(startSequence)){
            BluetoothAdapter adapter=BluetoothAdapter.getDefaultAdapter();
            String error=null;
            if (adapter == null) error="no bluetooth available";
            else {
                if (!adapter.isEnabled()) error = "bluetooth disabled";
            }
            if (error == null){
                if (! isBluetoothAllowed()){
                    error="bluetooth permission not granted";
                }
            }
            if (error == null) {
                device = getDeviceForName(deviceName);
                if (device == null) error = "device " + deviceName + " not available";
            }
            if (error != null){
                setStatus(WorkerStatus.Status.ERROR,error);
                sleep(2000);
            }
            else{
                runInternal(new BluetoothConnection(device),startSequence);
                device=null;
            }
        }

    }

    @Override
    NeededPermissions needsPermissions() {
        NeededPermissions rt=new NeededPermissions();
        rt.bluetooth= isEnabled()?NeededPermissions.Mode.NEEDED: NeededPermissions.Mode.NOT_NEEDED;
        return rt;
    }

    /**
     * get the device for a given name
     * return if no device with this name found
     * @param name
     * @return
     */
    public static BluetoothDevice getDeviceForName(String name){
        if (name == null || name.isEmpty()) return null;
        BluetoothAdapter adapter=BluetoothAdapter.getDefaultAdapter();
        if (adapter == null){
            AvnLog.i("no bluetooth adapter found");
            return null;
        }
        Set<BluetoothDevice> devices=adapter.getBondedDevices();
        for (BluetoothDevice d: devices){
            if (d.getName().equals(name)){
                AvnLog.i("found bluetooth device "+d.getAddress()+" for "+name);
                return d;
            }
        }
        AvnLog.i("no connected bluetooth device found for "+name);
        return null;
    }

    private static List<String> getBluetoothDevices(){
        ArrayList<String> rt=new ArrayList<String>();
        BluetoothAdapter adapter=BluetoothAdapter.getDefaultAdapter();
        if (adapter == null){
            AvnLog.i("no bluetooth adapter found");
            return rt;
        }
        Set<BluetoothDevice> devices=adapter.getBondedDevices();
        for (BluetoothDevice d: devices){
            rt.add(d.getName());
        }
        return rt;
    }

}
