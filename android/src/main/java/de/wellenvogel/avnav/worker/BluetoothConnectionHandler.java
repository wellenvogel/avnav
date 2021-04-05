package de.wellenvogel.avnav.worker;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.content.Context;

import org.json.JSONException;

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
    private static final String CLAIM="bluetooth";
    private EditableParameter.StringListParameter deviceSelect=new EditableParameter.StringListParameter(
            "device",
            R.string.labelSettingsBtDevice
    );
    private BluetoothConnectionHandler(String name,Context ctx, NmeaQueue queue) throws IOException, JSONException {
        super(name,ctx,queue);
        deviceSelect.listBuilder=new EditableParameter.ListBuilder<String>() {
            @Override
            public List<String> buildList(EditableParameter.StringListParameter param) {
                return filterByClaims(CLAIM,getBluetoothDevices(),false);
            }
        };
        parameterDescriptions.add(deviceSelect);
    }
    public static void register(WorkerFactory factory,String name) {
        factory.registerCreator(new WorkerCreator(name) {
            @Override
            Worker create(Context ctx, NmeaQueue queue) throws JSONException, IOException {
                return new BluetoothConnectionHandler(typeName, ctx, queue);
            }

            @Override
            boolean canAdd(Context ctx) {
                BluetoothAdapter adapter=BluetoothAdapter.getDefaultAdapter();
                if (adapter == null) return false;
                return adapter.isEnabled();
            }
        });
    }
    @Override
    public void run(int startSequence) throws JSONException, IOException {
        String deviceName=deviceSelect.fromJson(parameters);
        addClaim(CLAIM,deviceName,true);
        BluetoothDevice device=null;
        while (device == null && ! shouldStop(startSequence)){
            BluetoothAdapter adapter=BluetoothAdapter.getDefaultAdapter();
            String error=null;
            if (adapter == null) error="no bluetooth available";
            else {
                if (!adapter.isEnabled()) error = "bluetooth disabled";
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
