package de.wellenvogel.avnav.gps;

import android.content.Context;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.util.List;
import java.util.Map;

import de.wellenvogel.avnav.util.AvnLog;

/**
 * Created by andreas on 25.12.14.
 */
public class UsbSerialPositionHandler extends SocketPositionHandler {

    static private class UsbSerialSocket extends AbstractSocket{
        UsbDevice dev;
        String baud;
        final static String PREFIX="AvnUsbSerial";
        UsbSerialSocket(UsbDevice dev,String baud)
        {
            super();
            this.dev=dev;
            this.baud=baud;
        }
        @Override
        public void connect() throws IOException {
            AvnLog.i(PREFIX,"connect to "+dev.getDeviceName());
        }

        @Override
        public InputStream getInputStream() throws IOException {
            return new ByteArrayInputStream(new byte[]{});
        }

        @Override
        public void close() throws IOException {
            AvnLog.i(PREFIX,"close connection to "+dev.getDeviceName());
        }

        @Override
        public String getId() {
            return dev.getDeviceName();
        }
    }

    UsbSerialPositionHandler(Context ctx, UsbDevice device,String baud, Properties prop){
        super("UsbSerialPositionHandler",ctx,new UsbSerialSocket(device,baud),prop);
    }

    public static UsbDevice getDeviceForName(Context ctx,String name){
        UsbManager manager=(UsbManager) ctx.getSystemService(Context.USB_SERVICE);
        Map<String,UsbDevice> devices=manager.getDeviceList();
        return devices.get(name);
    }

    @Override
    public String getName() {
        return "USBSerial";
    }
}
