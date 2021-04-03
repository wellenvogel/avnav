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
public class IpConnection extends AbstractConnection {
    private Socket ipSocket;
    private InetSocketAddress ipAddr;
    /**
     * connect the socket
     * @throws IOException
     */
    public void connect() throws IOException{
        ipSocket.connect(ipAddr,timeout);
    }

    public InputStream getInputStream() throws IOException {
        return ipSocket.getInputStream();
    }

    public OutputStream getOutputStream() throws IOException {
        return ipSocket.getOutputStream();
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
        }
    }

    public String getId(){
        if (ipSocket!=null) {
            return ipAddr.toString();
        }
        return "unknown";
    }

    public IpConnection(InetSocketAddress addr){
        ipSocket=new Socket();
        ipAddr=addr;
    }

}
