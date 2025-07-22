package de.wellenvogel.avnav.worker;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbManager;
import android.os.Build;

import com.felhr.usbserial.UsbSerialDevice;
import com.felhr.usbserial.UsbSerialInterface;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import de.wellenvogel.avnav.main.BuildConfig;
import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.util.NmeaQueue;

/**
 * Created by andreas on 25.12.14.
 */
public class UsbConnectionHandler extends SingleConnectionHandler {
    static final String IF_STATUS ="device";
    static final String DEVICE_STATUS ="name";
    private Context ctx;
    private boolean permissionRequested=false;
    private static final String ACTION_USB_PERMISSION =
            "com.android.example.USB_PERMISSION";
    static AvnUtil.KeyValueMap<Integer> FLOW_CONTROLS=
            new AvnUtil.KeyValueMap<Integer>(
                    new AvnUtil.KeyValue<Integer>("none",UsbSerialInterface.FLOW_CONTROL_OFF),
                    new AvnUtil.KeyValue<Integer>("xon/xoff",UsbSerialInterface.FLOW_CONTROL_XON_XOFF),
                    new AvnUtil.KeyValue<Integer>("rts/cts",UsbSerialInterface.FLOW_CONTROL_RTS_CTS)
            );
    static EditableParameter.StringListParameter FLOW_CONTROL=
            new EditableParameter.StringListParameter("flowControl",R.string.labelSettingsFlowControl,"none",
                    FLOW_CONTROLS.keySet() );

    public static String getDeviceKey(UsbDevice device){
        if (device == null) return null;
        return device.getDeviceName();
    }
    public static String getDeviceName(UsbDevice device){
        if (device == null) return null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            StringBuilder dn=new StringBuilder();
            dn.append(device.getProductName()).append("-").append(device.getSerialNumber());
            return dn.toString();
        }
        else{
            return device.getDeviceName();
        }
    }

    static UsbDevice getDeviceByKey(Context ctx, String key){
        if (key == null) return null;
        UsbManager manager=(UsbManager) ctx.getSystemService(Context.USB_SERVICE);
        Map<String,UsbDevice> devices=manager.getDeviceList();
        for (UsbDevice d:devices.values()){
            try {
                if (key.equals(getDeviceKey(d))) {
                    return d;
                }
            }catch (Throwable t){
                AvnLog.e("unable to obtain device key for "+d.getDeviceName(),t);
            }
        }
        return null;
    }

    void deviceDetach(UsbDevice dev) {
        UsbSerialConnection usb=(UsbSerialConnection) connection;
        if (usb != null && usb.dev.equals(dev)){
            AvnLog.i(UsbSerialConnection.PREFIX,"device "+usb.getId()+" detached, closing");
            try {
                usb.close();
            } catch (IOException e) {
            }
            permissionRequested=false;
        }
    }

    static private class UsbSerialConnection extends AbstractConnection {
        UsbDevice dev;
        int MAXBUFFER=20000;
        UsbDeviceConnection connection;
        String baud;
        UsbSerialDevice serialPort;
        int flowControl;
        ArrayList<Byte> buffer=new ArrayList<Byte>();
        final Object bufferLock=new Object();

        String id;

        private void notifyWaiters(){
            synchronized (bufferLock){
                bufferLock.notifyAll();
            }
        }

        final UsbSerialInterface.UsbReadCallback callback=new UsbSerialInterface.UsbReadCallback() {
            @Override
            public void onReceivedData(byte[] bytes) {
                int dropCount=0;
                synchronized (bufferLock) {
                    for (byte b : bytes) {
                        buffer.add(b);
                        if (buffer.size() > MAXBUFFER){
                            buffer.remove(0);
                            dropCount++;
                        }
                    }
                    bufferLock.notifyAll();
                }
                if (dropCount > 0){
                    AvnLog.dfs("UsbSerial: buffer overflow, dropped %d bytes",dropCount);
                }
            }
        };
        final static String PREFIX="AvnUsbSerial";
        UsbSerialConnection(Context ctx, UsbDevice dev, String baud,int flowControl) throws Exception {
            super();
            this.dev=dev;
            this.baud=baud;
            this.flowControl=flowControl;
            id=UsbConnectionHandler.getDeviceKey(dev);
            UsbManager manager=(UsbManager) ctx.getSystemService(Context.USB_SERVICE);
            connection=manager.openDevice(dev);
            if (connection == null) throw new Exception("no connection to "+id);
            //TODO: handle open connection error
        }
        @Override
        public void connectImpl() throws IOException {
            buffer.clear();
            notifyWaiters();
            AvnLog.i(PREFIX,"connect to "+id);
            serialPort = UsbSerialDevice.createUsbSerialDevice(dev, connection);
            if (serialPort != null) {
                if (serialPort.open()) {
                    serialPort.setBaudRate(Integer.parseInt(baud));
                    serialPort.setDataBits(UsbSerialInterface.DATA_BITS_8);
                    serialPort.setStopBits(UsbSerialInterface.STOP_BITS_1);
                    serialPort.setParity(UsbSerialInterface.PARITY_NONE);
                    serialPort.setFlowControl(flowControl);
                    serialPort.read(callback);
                    serialPort.debug(BuildConfig.DEBUG);
                } else {
                    throw new IOException(PREFIX + ": unable to open serial device " + id);
                }
            }
            else{
                throw new IOException(PREFIX + ": unable to open serial device " + id);
            }
        }

        @Override
        public boolean shouldFail() {
            return true;
        }

        @Override
        public InputStream getInputStreamImpl() throws IOException {
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
        public OutputStream getOutputStreamImpl() throws IOException {
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
        public void closeImpl() throws IOException {
            AvnLog.i(PREFIX,"close connection to "+id);
            if (serialPort == null) return;
            try {
                serialPort.close();
            }catch (Throwable t){
                AvnLog.e("error closing usb connection",t);
            }
            serialPort=null;
            notifyWaiters();
        }

        @Override
        public String getId() {
            return id;
        }


    }
    public static EditableParameter.StringListParameter DEVICE_SELECT=
            new EditableParameter.StringListParameter("device", R.string.labelSettingsUsbDevice);
    private EditableParameter.StringListParameter deviceSelect;
    private UsbConnectionHandler(String name, GpsService ctx, NmeaQueue queue) throws JSONException {
        super(name,ctx,queue);
        deviceSelect=new EditableParameter.StringListParameter(DEVICE_SELECT);
        deviceSelect.listBuilder=new EditableParameter.ListBuilder<String>() {
            @Override
            public List<String> buildList(EditableParameter.StringListParameter param) {
                List<String> rt = Creator.getAvailableUsbDevices(ctx);
                return filterByClaims(CLAIM_USB,rt,true);
            }
        };
        parameterDescriptions.insertParams(deviceSelect,BAUDRATE_PARAMETER,FLOW_CONTROL);
        this.ctx=ctx;
    }

    @Override
    protected void checkParameters(JSONObject newParam) throws JSONException, IOException {
        super.checkParameters(newParam);
        String deviceName=deviceSelect.fromJson(newParam);
        checkClaim(CLAIM_USB,deviceName,true);
    }

    @Override
    public void run(int startSequence) throws JSONException, IOException {
        String deviceName=deviceSelect.fromJson(parameters);
        addClaim(CLAIM_USB,deviceName,true);
        Integer flowControl=UsbSerialInterface.FLOW_CONTROL_OFF;
        String fcValue=FLOW_CONTROL.fromJson(parameters);
        flowControl=FLOW_CONTROLS.get(fcValue);
        if (flowControl == null){
            throw new JSONException("invalid flowControl "+fcValue);
        }
        UsbManager manager=(UsbManager) ctx.getSystemService(Context.USB_SERVICE);
        while (! shouldStop(startSequence)){
            UsbDevice device= getDeviceByKey(gpsService,deviceName);
            WorkerStatus.Status ns=WorkerStatus.Status.NMEA;
            if (device == null) {
                ns=WorkerStatus.Status.STARTED;
            }
            status.setChildStatus(IF_STATUS,ns,deviceName);
            if (device == null){
                status.unsetChildStatus(DEVICE_STATUS);
                setStatus(WorkerStatus.Status.ERROR,"device not available");
                sleep(2000);
            }
            else{
                String devName=null;
                if (manager.hasPermission(device)) devName=getDeviceName(device);
                if (!deviceName.equals(devName) && devName != null){
                    status.setChildStatus(DEVICE_STATUS, WorkerStatus.Status.NMEA, devName);
                }
                else{
                    status.unsetChildStatus(DEVICE_STATUS);
                }
                if (! manager.hasPermission(device)){
                    if (! permissionRequested){
                        setStatus(WorkerStatus.Status.ERROR,"requested permissions");
                        PendingIntent permissionIntent = PendingIntent.getBroadcast(ctx, 0, new Intent(ACTION_USB_PERMISSION), AvnUtil.buildPiFlags(0,true));
                        manager.requestPermission(device,permissionIntent);
                        permissionRequested=true;

                    }
                    else {
                        setStatus(WorkerStatus.Status.ERROR, "no permission for device");
                    }
                    sleep(3000);
                    continue;
                }
                setStatus(WorkerStatus.Status.STARTED,"connecting");
                try {
                    runInternal(new UsbSerialConnection(ctx, device, BAUDRATE_PARAMETER.fromJson(parameters),flowControl), startSequence);
                }catch(Throwable t){
                    setStatus(WorkerStatus.Status.ERROR,"unable to open device:"+t.getMessage());
                    AvnLog.e("error opening usb device",t);
                    sleep(5000);
                }
            }
        }
        status.unsetChildStatus(IF_STATUS);
        status.unsetChildStatus(DEVICE_STATUS);
    }


    static class Creator extends WorkerFactory.Creator{
        @Override
        ChannelWorker create(String name, GpsService ctx, NmeaQueue queue) throws JSONException {
            return new UsbConnectionHandler(name,ctx,queue);
        }
        @Override
        boolean canAdd(GpsService ctx) {
            return getAvailableUsbDevices(ctx).size() > 0;

        }
        static List<String> getAvailableUsbDevices(Context ctx){
            ArrayList<String> rt=new ArrayList<>();
            if (! ctx.getPackageManager().hasSystemFeature(PackageManager.FEATURE_USB_HOST)) return rt;
            UsbManager manager=(UsbManager) ctx.getSystemService(Context.USB_SERVICE);
            if (manager == null) return rt;
            Map<String,UsbDevice> devices=manager.getDeviceList();
            for (UsbDevice usbDevice:devices.values()){
                if (UsbSerialDevice.isSupported(usbDevice)){
                    try {
                        rt.add(getDeviceKey(usbDevice));
                    }catch (Throwable t){
                        AvnLog.d("unable to get usb device info for "+usbDevice.getDeviceName()+": "+t);
                    }
                }
            }
            return rt;
        }
    }

    /**
     * fill in initial parameters that we would use if android has detected
     * a device we still do not know
     * @param deviceName
     * @return
     * @throws JSONException
     */
    public static JSONObject getInitialParameters(String deviceName) throws JSONException {
        JSONObject rt=new JSONObject();
        DEVICE_SELECT.write(rt,deviceName);
        return rt;
    }

}
