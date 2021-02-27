package de.wellenvogel.avnav.worker;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.content.Context;
import de.wellenvogel.avnav.util.AvnLog;

import java.io.IOException;
import java.util.Set;

/**
 * Created by andreas on 25.12.14.
 */
public class BluetoothPositionHandler extends SocketPositionHandler {

    BluetoothPositionHandler(Context ctx, BluetoothDevice device, Properties prop) throws IOException {
        super("BluetoothPositionHandler",ctx,new AbstractSocket(device,prop.connectTimeout),prop);
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

    @Override
    public String getName() {
        return "Bluetooth";
    }
}
