package de.wellenvogel.avnav.worker;

import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.util.Log;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.UUID;

import de.wellenvogel.avnav.util.AvnLog;

/**
 * Created by andreas on 12.03.15.
 * a class to unify Bluetooth sockets and IP sockets
 */
public class BluetoothConnection extends AbstractConnection {
    private int timeout;
    private BluetoothSocket btSocket;
    private BluetoothDevice btDevice;

    /**
     * connect the socket
     * @throws IOException
     */
    public void connect() throws IOException{
        btSocket.connect();
    }

    public InputStream getInputStream() throws IOException {
        return btSocket.getInputStream();
    }

    public OutputStream getOutputStream() throws IOException {
        return btSocket.getOutputStream();
    }

    public void close() throws IOException {
        lastWrite=0;
        try {
            btSocket.close();
        }catch (IOException e){
            createBtSocket();
            throw e;
        }
        createBtSocket();
    }

    public String getId(){
        return btDevice.getName();
    }


    public static String RFCOMM_UUID="00001101-0000-1000-8000-00805F9B34FB"; //the somehow magic id..
    public BluetoothConnection(BluetoothDevice device, int connectTimeout) throws IOException {
        btDevice=device;
        createBtSocket();
    }

    private void createBtSocket() throws IOException {
        btSocket = btDevice.createRfcommSocketToServiceRecord(UUID.fromString(RFCOMM_UUID));
    }

}
