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
public abstract class AbstractConnection {
    protected long lastWrite=0;
    protected int timeout=0;
    public static long WRITE_TIMEOUT=5000; //5 seconds

    /**
     * connect the socket
     * @throws IOException
     */
    abstract public void connect() throws IOException;

    abstract public InputStream getInputStream() throws IOException;

    abstract public OutputStream getOutputStream() throws IOException;

    public void startWrite(){
        lastWrite=System.currentTimeMillis();
    }
    public void finishWrite(){
        lastWrite=0;
    }
    public void setTimeout(int to){
        timeout=to;
    }

    /**
     * give the abstract connection a chance to let the retry connect loop finally fail
     * @return true if no connect retries any more
     */
    public boolean shouldFail(){return false;}
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

    abstract public void close() throws IOException;

    abstract public String getId();


}
