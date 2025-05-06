package de.wellenvogel.avnav.main;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.os.Bundle;
import android.widget.Toast;

import com.felhr.usbserial.UsbSerialDevice;

import de.wellenvogel.avnav.worker.GpsService;
import de.wellenvogel.avnav.worker.UsbConnectionHandler;

/**
 * Created by andreas on 09.01.15.
 * USB attach handling
 * https://stackoverflow.com/questions/40075128/android-usb-device-attached-persistent-permission
 */
public class UsbReceiver extends Activity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Intent intent=getIntent();
        UsbDevice device = (UsbDevice) intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
        if (device != null) {
            String key=UsbConnectionHandler.getDeviceKey(device);
            if (!GpsService.handlesUsbDevice(this, key)) {
                if (UsbSerialDevice.isSupported(device)) {
                    SharedPreferences pref=getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
                    if (pref.getBoolean(Constants.AUTOUSB,false)) {
                        Toast.makeText(this, "USB attach for " + key, Toast.LENGTH_LONG).show();
                        Intent notificationIntent = new Intent(this, MainActivity.class);
                        notificationIntent.putExtra(Constants.USB_DEVICE_EXTRA, key);
                        startActivity(notificationIntent);
                    }
                }
            }

        }
        finish();
    }
}