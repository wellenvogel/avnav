package de.wellenvogel.avnav.worker;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;

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
    @Override
    public void connect() throws IOException{
        if (ipSocket != null){
            try{
                ipSocket.close();
            }catch (Throwable t){}
            ipSocket=null;
        }
        ipSocket=new Socket();
        ipSocket.connect(ipAddr,properties.connectTimeout);
    }
    @Override
    public InputStream getInputStreamImpl() throws IOException {
        return ipSocket.getInputStream();
    }

    public OutputStream getOutputStreamImpl() throws IOException {
        return ipSocket.getOutputStream();
    }

    public void closeImpl() throws IOException {
        if (ipSocket!=null) {
            try {
                ipSocket.close();
            }catch (IOException e){
                ipSocket=new Socket();
                throw e;
            }
            ipSocket=null;
        }
    }

    public String getId(){
        if (ipSocket!=null) {
            return ipAddr.toString();
        }
        return "unknown";
    }

    public IpConnection(InetSocketAddress addr){
        ipAddr=addr;
    }

}
