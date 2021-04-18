package de.wellenvogel.avnav.worker;

import android.content.Context;
import android.net.Network;
import android.os.Build;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;

import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;

/**
 * Created by andreas on 12.03.15.
 * a class to unify Bluetooth sockets and IP sockets
 */
public class IpConnection extends AbstractConnection {
    private final Context ctx;
    private Socket ipSocket;
    private InetSocketAddress ipAddr;
    /**
     * connect the socket
     * @throws IOException
     */
    @Override
    public void connectImpl() throws IOException{
        if (ipSocket != null){
            try{
                closeImpl();
            }catch (Throwable t){}
            ipSocket=null;
        }
        ipSocket=new Socket();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            try {
                Network network = AvnUtil.getNetworkForRemote(ipAddr.getAddress(), ctx);
                if (network != null) {
                    AvnLog.i("found network " + network + " for remote " + ipAddr);
                    network.bindSocket(ipSocket);
                }
            } catch (Throwable t) {
                AvnLog.e("unable to get network for remote " + ipAddr);
            }
        }
        ipSocket.connect(ipAddr,properties.connectTimeout*1000);
    }
    @Override
    public InputStream getInputStreamImpl() throws IOException {
        Socket socket=ipSocket;
        if (socket == null) throw new IOException("connection closed");
        return socket.getInputStream();
    }

    public OutputStream getOutputStreamImpl() throws IOException {
        Socket socket=ipSocket;
        if (socket == null) throw new IOException("connection closed");
        return socket.getOutputStream();
    }

    public void closeImpl() throws IOException {
        if (ipSocket!=null) {
            try {
                ipSocket.close();
            }catch (IOException e){
                ipSocket=null;
                throw e;
            }
            ipSocket=null;
        }
    }

    public String getId(){
        return ipAddr.toString();

    }

    public IpConnection(InetSocketAddress addr, Context ctx){
        ipAddr=addr;
        this.ctx=ctx;
    }

    @Override
    public boolean shouldFail() {
        return true;
    }
}
