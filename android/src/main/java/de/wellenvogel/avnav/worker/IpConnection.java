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
    public void connectImpl() throws IOException{
        if (ipSocket != null){
            try{
                closeImpl();
            }catch (Throwable t){}
            ipSocket=null;
        }
        ipSocket=new Socket();
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

    public IpConnection(InetSocketAddress addr){
        ipAddr=addr;
    }

}
