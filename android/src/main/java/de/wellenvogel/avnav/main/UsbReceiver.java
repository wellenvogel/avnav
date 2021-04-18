package de.wellenvogel.avnav.main;

import android.app.Activity;
import android.content.Intent;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.os.Bundle;
import android.widget.Toast;

import de.wellenvogel.avnav.worker.GpsService;

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
            if (!GpsService.handlesUsbDevice(this,device.getDeviceName())) {
                Toast.makeText(this, "USB attach for " + device.getDeviceName(), Toast.LENGTH_LONG).show();
                Intent notificationIntent = new Intent(this, MainActivity.class);
                notificationIntent.putExtra(Constants.USB_DEVICE_EXTRA, device.getDeviceName());
                startActivity(notificationIntent);
            }

        }
        finish();
    }
}