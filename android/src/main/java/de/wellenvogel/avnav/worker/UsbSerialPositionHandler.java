package de.wellenvogel.avnav.worker;

import android.content.Context;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbManager;
import android.location.Location;
import android.util.Log;

import com.felhr.usbserial.UsbSerialDevice;
import com.felhr.usbserial.UsbSerialInterface;

import net.sf.marineapi.nmea.sentence.RMCSentence;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Map;

import de.wellenvogel.avnav.util.AvnLog;

/**
 * Created by andreas on 25.12.14.
 */
public class UsbSerialPositionHandler extends SocketPositionHandler {

    void deviceDetach(UsbDevice dev) {
        UsbSerialSocket usb=(UsbSerialSocket)socket;
        if (usb != null && usb.dev.equals(dev)){
            AvnLog.i(UsbSerialSocket.PREFIX,"device "+usb.getId()+" detached, closing");
            try {
                usb.close();
            } catch (IOException e) {
            }
        }
    }

    static private class UsbSerialSocket extends AbstractSocket{
        UsbDevice dev;
        UsbDeviceConnection connection;
        String baud;
        UsbSerialDevice serialPort;
        ArrayList<Byte> buffer=new ArrayList<Byte>();
        Object bufferLock=new Object();

        private void notifyWaiters(){
            synchronized (bufferLock){
                bufferLock.notifyAll();
            }
        }
        final UsbSerialInterface.UsbReadCallback callback=new UsbSerialInterface.UsbReadCallback() {
            @Override
            public void onReceivedData(byte[] bytes) {
                synchronized (bufferLock) {
                    for (byte b : bytes) {
                        buffer.add(b);
                    }
                    bufferLock.notifyAll();
                }
            }
        };
        final static String PREFIX="AvnUsbSerial";
        UsbSerialSocket(Context ctx,UsbDevice dev,String baud)
        {
            super();
            this.dev=dev;
            this.baud=baud;
            UsbManager manager=(UsbManager) ctx.getSystemService(Context.USB_SERVICE);
            connection=manager.openDevice(dev);
            //TODO: handle open connection error
        }
        @Override
        public void connect() throws IOException {
            buffer.clear();
            notifyWaiters();
            AvnLog.i(PREFIX,"connect to "+dev.getDeviceName());
            serialPort = UsbSerialDevice.createUsbSerialDevice(dev, connection);
            if (serialPort != null) {
                if (serialPort.open()) {
                    serialPort.setBaudRate(Integer.parseInt(baud));
                    serialPort.setDataBits(UsbSerialInterface.DATA_BITS_8);
                    serialPort.setStopBits(UsbSerialInterface.STOP_BITS_1);
                    serialPort.setParity(UsbSerialInterface.PARITY_NONE);
                    serialPort.setFlowControl(UsbSerialInterface.FLOW_CONTROL_OFF);
                    serialPort.read(callback);
                } else {
                    throw new IOException(PREFIX + ": unable to open serial device " + dev.getDeviceName());
                }
            }
            else{
                throw new IOException(PREFIX + ": unable to open serial device " + dev.getDeviceName());
            }
        }

        @Override
        public InputStream getInputStream() throws IOException {
            return new InputStream() {
                @Override
                public int read() throws IOException {
                    while (true) {
                        if (serialPort == null) return -1;
                        synchronized (bufferLock) {
                            if (buffer.size() > 0) return (int) buffer.remove(0);
                            if (serialPort == null) return -1;
                            try {
                                bufferLock.wait();
                            } catch (InterruptedException e) {
                            }
                        }
                    }
                }
                @Override
                public int read(byte[] obuffer, int byteOffset, int byteCount){
                    while (true) {
                        synchronized (bufferLock) {
                            if (buffer.size() > 0) {
                                int rt = 0;
                                while (rt < byteCount && buffer.size() > 0) {
                                    obuffer[byteOffset + rt] = buffer.remove(0);
                                    rt += 1;
                                }
                                return rt;
                            }
                            if (serialPort == null) return -1;
                            try {
                                bufferLock.wait();
                            } catch (InterruptedException e) {
                            }
                        }
                    }
                };
            };
        }

        @Override
        public void close() throws IOException {
            AvnLog.i(PREFIX,"close connection to "+dev.getDeviceName());
            if (serialPort == null) return;
            serialPort.close();
            serialPort=null;
            notifyWaiters();
        }

        @Override
        public String getId() {
            return dev.getDeviceName();
        }

        @Override
        public void sendData(String data) throws IOException {
            if (serialPort == null) return;
            serialPort.write(data.getBytes());
        }
    }

    UsbSerialPositionHandler(Context ctx, UsbDevice device,String baud, Properties prop){
        super("UsbSerialPositionHandler",ctx,new UsbSerialSocket(ctx,device,baud),prop);
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
    @Override
    public void sendPosition(Location curLoc) {
        if (! properties.sendPosition) return;
        if (curLoc == null) return;
        RMCSentence out= positionToRmc(curLoc);
        try {
            socket.sendData(out.toSentence()+"\r\n");
        } catch (IOException e) {
            Log.e(LOGPRFX,"unable to send position",e);
        }
    }


}
