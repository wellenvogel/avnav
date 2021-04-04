package de.wellenvogel.avnav.worker;

import android.content.Context;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbManager;

import com.felhr.usbserial.UsbSerialDevice;
import com.felhr.usbserial.UsbSerialInterface;

import org.json.JSONException;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.NmeaQueue;

/**
 * Created by andreas on 25.12.14.
 */
public class UsbConnectionHandler extends SingleConnectionHandler {
    private Context ctx;
    void deviceDetach(UsbDevice dev) {
        UsbSerialConnection usb=(UsbSerialConnection) connection;
        if (usb != null && usb.dev.equals(dev)){
            AvnLog.i(UsbSerialConnection.PREFIX,"device "+usb.getId()+" detached, closing");
            try {
                usb.close();
            } catch (IOException e) {
            }
        }
    }

    static private class UsbSerialConnection extends AbstractConnection {
        UsbDevice dev;
        UsbDeviceConnection connection;
        String baud;
        UsbSerialDevice serialPort;
        ArrayList<Byte> buffer=new ArrayList<Byte>();
        final Object bufferLock=new Object();

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
        UsbSerialConnection(Context ctx, UsbDevice dev, String baud)
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
        public OutputStream getOutputStream() throws IOException {
            return new OutputStream() {
                @Override
                public void write(int b) throws IOException {
                    byte [] buffer=new byte[1];
                    buffer[0]=(byte)b;
                    serialPort.write(buffer);
                }
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


    }
    EditableParameter.StringListParameter deviceSelect=
            new EditableParameter.StringListParameter("device","usb device");
    private UsbConnectionHandler(String name, Context ctx, NmeaQueue queue) throws JSONException {
        super(name,ctx,queue);
        parameterDescriptions.add(BAUDRATE_PARAMETER);
        deviceSelect.listBuilder=new EditableParameter.ListBuilder<String>() {
            @Override
            public List<String> buildList(EditableParameter.StringListParameter param) {
                UsbManager manager=(UsbManager) ctx.getSystemService(Context.USB_SERVICE);
                Map<String,UsbDevice> devices=manager.getDeviceList();
                ArrayList<String> rt = new ArrayList<String>(devices.keySet());
                return rt;
            }
        };
        parameterDescriptions.add(deviceSelect);
        this.ctx=ctx;
    }


    @Override
    public void run(int startSequence) throws JSONException, IOException {
        String deviceName=deviceSelect.fromJson(parameters);
        UsbDevice device=null;
        while (device == null && ! shouldStop(startSequence)){
            device=getDeviceForName(ctx,deviceName);
            if (device == null){
                setStatus(WorkerStatus.Status.ERROR,"device "+deviceName+" not available");
                sleep(2000);
            }
            else{
                setStatus(WorkerStatus.Status.STARTED,"connecting to "+deviceName);
                runInternal(new UsbSerialConnection(ctx,device,BAUDRATE_PARAMETER.fromJson(parameters)),startSequence);
                device=null;
            }
        }
    }

    public static UsbDevice getDeviceForName(Context ctx,String name){
        UsbManager manager=(UsbManager) ctx.getSystemService(Context.USB_SERVICE);
        Map<String,UsbDevice> devices=manager.getDeviceList();
        return devices.get(name);
    }

    public static void register(WorkerFactory factory,String name){
        factory.registerCreator(new WorkerCreator(name) {
            @Override
            Worker create(Context ctx, NmeaQueue queue) throws JSONException {
                return new UsbConnectionHandler(typeName,ctx,queue);
            }
        });
    }


}
