package de.wellenvogel.avnav.worker;

import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.UUID;

/**
 * Created by andreas on 12.03.15.
 * a class to unify Bluetooth sockets and IP sockets
 */
public class BluetoothConnection extends AbstractConnection {
    private BluetoothSocket btSocket;
    private BluetoothDevice btDevice;

    /**
     * connect the socket
     * @throws IOException
     */
    public void connectImpl() throws IOException{
        btSocket.connect();
    }

    public InputStream getInputStreamImpl() throws IOException {
        return btSocket.getInputStream();
    }

    public OutputStream getOutputStreamImpl() throws IOException {
        return btSocket.getOutputStream();
    }

    public void closeImpl() throws IOException {
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

    @Override
    public boolean shouldFail() {
        return true; //we do the retry loop by our own
    }

    public static String RFCOMM_UUID="00001101-0000-1000-8000-00805F9B34FB"; //the somehow magic id..
    public BluetoothConnection(BluetoothDevice device) throws IOException {
        btDevice=device;
        createBtSocket();
    }

    private void createBtSocket() throws IOException {
        btSocket = btDevice.createRfcommSocketToServiceRecord(UUID.fromString(RFCOMM_UUID));
    }

}
