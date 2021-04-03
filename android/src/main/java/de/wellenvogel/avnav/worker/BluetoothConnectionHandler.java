package de.wellenvogel.avnav.worker;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.content.Context;

import org.json.JSONException;

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
            "bluetooth device"
    );
    private BluetoothConnectionHandler(String name,Context ctx, NmeaQueue queue) throws IOException, JSONException {
        super(name,ctx,queue);
        deviceSelect.listBuilder=new EditableParameter.ListBuilder<String>() {
            @Override
            public List<String> buildList(EditableParameter.StringListParameter param) {
                return getBluetoothDevices();
            }
        };
        parameterDescriptions.add(deviceSelect);
    }

    public static void register(WorkerFactory factory,String name) {
        factory.registerCreator(new WorkerCreator(name) {
            @Override
            Worker create(Context ctx, NmeaQueue queue) throws JSONException, IOException {
                return new BluetoothConnectionHandler(name, ctx, queue);
            }
        });
    }
    @Override
    public void run() throws JSONException, IOException {
        String deviceName=deviceSelect.fromJson(parameters);
        runInternal(new BluetoothConnection(getDeviceForName(deviceName)));
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
