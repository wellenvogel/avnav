package de.wellenvogel.avnav.gps;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;

import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.UUID;

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

    public void close() throws IOException {
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

    public static String RFCOMM_UUID="00001101-0000-1000-8000-00805F9B34FB"; //the somehow magic id..
    public AbstractSocket(BluetoothDevice device, int connectTimeout) throws IOException {
        btDevice=device;
        createBtSocket();
    }

    private void createBtSocket() throws IOException {
        btSocket = btDevice.createRfcommSocketToServiceRecord(UUID.fromString(RFCOMM_UUID));
    }

}
