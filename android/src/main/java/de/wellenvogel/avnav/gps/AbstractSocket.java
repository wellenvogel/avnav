package de.wellenvogel.avnav.gps;

import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;

import java.io.IOException;
import java.io.InputStream;
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
        if (ipSocket!=null) ipSocket.close();
        btSocket.close();
    }

    public String getId(){
        if (ipSocket!=null) {
            return ipAddr.toString();
        }
        return btSocket.getRemoteDevice().getName();
    }

    public AbstractSocket(InetSocketAddress addr,Socket socket,int timeout){
        ipSocket=socket;
        ipAddr=addr;
        this.timeout=timeout;
    }

    public static String RFCOMM_UUID="00001101-0000-1000-8000-00805F9B34FB"; //the somehow magic id..
    public AbstractSocket(BluetoothDevice device, int connectTimeout) throws IOException {
        btSocket=device.createRfcommSocketToServiceRecord(UUID.fromString(RFCOMM_UUID));
    }

}
