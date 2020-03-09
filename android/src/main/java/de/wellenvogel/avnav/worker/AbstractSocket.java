package de.wellenvogel.avnav.worker;

import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.util.Log;

import java.io.IOException;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.UUID;

import de.wellenvogel.avnav.util.AvnLog;

/**
 * Created by andreas on 12.03.15.
 * a class to unify Bluetooth sockets and IP sockets
 */
public class AbstractSocket {
    private Socket ipSocket;
    private InetSocketAddress ipAddr;
    private int timeout;
    private BluetoothSocket btSocket;
    private BluetoothDevice btDevice;
    protected long lastWrite=0;
    public static long WRITE_TIMEOUT=5000; //5 seconds

    /**
     * connect the socket
     * @throws IOException
     */
    public void connect() throws IOException{
        if (ipSocket != null){
            ipSocket.connect(ipAddr,timeout);
            return;
        }

        btSocket.connect();
    }

    public InputStream getInputStream() throws IOException {
        if (ipSocket != null) return ipSocket.getInputStream();
        return btSocket.getInputStream();
    }

    public void sendData(String data) throws IOException {
        if (lastWrite != 0){
            close();
            return;
        }
        lastWrite= System.currentTimeMillis();
        if (ipSocket != null || btSocket != null) AvnLog.i("writing position "+data);
        if (ipSocket != null) ipSocket.getOutputStream().write(data.getBytes());
        if (btSocket != null) btSocket.getOutputStream().write(data.getBytes());
        lastWrite=0;
    }

    /**
     * write timeout check
     * closes the socket on timeout
     * @return true if closed
     */
    public boolean check(){
        if (lastWrite == 0) return false;
        long now=System.currentTimeMillis();
        if (now > (lastWrite+WRITE_TIMEOUT)){
            Log.e("abstract socket","closing due to write timeout");
            try {
                close();
            } catch (IOException e) {
            }
            return true;
        }
        return false;
    }

    public void close() throws IOException {
        lastWrite=0;
        if (ipSocket!=null) {
            try {
                ipSocket.close();
            }catch (IOException e){
                ipSocket=new Socket();
                throw e;
            }
            ipSocket=new Socket();
            return;
        }
        try {
            btSocket.close();
        }catch (IOException e){
            createBtSocket();
            throw e;
        }
        createBtSocket();
    }

    public String getId(){
        if (ipSocket!=null) {
            return ipAddr.toString();
        }
        return btDevice.getName();
    }

    public AbstractSocket(InetSocketAddress addr,int timeout){
        ipSocket=new Socket();
        ipAddr=addr;
        this.timeout=timeout;
    }

    public AbstractSocket(){
        
    }

    public static String RFCOMM_UUID="00001101-0000-1000-8000-00805F9B34FB"; //the somehow magic id..
    public AbstractSocket(BluetoothDevice device, int connectTimeout) throws IOException {
        btDevice=device;
        createBtSocket();
    }

    private void createBtSocket() throws IOException {
        btSocket = btDevice.createRfcommSocketToServiceRecord(UUID.fromString(RFCOMM_UUID));
    }

}
