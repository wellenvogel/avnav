package de.wellenvogel.avnav.worker;

import android.content.Context;

import org.json.JSONException;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.HashMap;

import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.NmeaQueue;

/**
 * Created by andreas on 25.12.14.
 */
public class SocketWriter extends ChannelWorker {
    static class Creator extends WorkerFactory.Creator{
        @Override
        ChannelWorker create(String name, Context ctx, NmeaQueue queue) throws JSONException {
            return new SocketWriter(name,ctx,queue);
        }
    }

    static class ClientConnection extends AbstractConnection{
        private Socket socket;
        String statusKey;
        ClientConnection(Socket socket,String statusKey){
            this.socket=socket;
            this.statusKey=statusKey;
        }

        /**
         * connect the socket
         * @throws IOException
         */
        @Override
        public void connectImpl() throws IOException{
        }
        @Override
        public InputStream getInputStreamImpl() throws IOException {
            return socket.getInputStream();
        }

        public OutputStream getOutputStreamImpl() throws IOException {
            return socket.getOutputStream();
        }

        public void closeImpl() throws IOException {
            socket.close();
        }

        public String getId(){
            return statusKey;
        }
        @Override
        public boolean shouldFail() {
            return true;
        }
    }
    static EditableParameter.IntegerParameter PORT_PARAMETER=
            new EditableParameter.IntegerParameter("port", R.string.labelSettingsBindPort,null);
    static EditableParameter.BooleanParameter EXTERNAL_ACCESS=
            new EditableParameter.BooleanParameter("externalAccess",R.string.labelSettingsExternalAccess,false);

    private SocketWriter(String name, Context ctx, NmeaQueue queue) throws JSONException {
        super(name,ctx,queue);
        parameterDescriptions.addParams(PORT_PARAMETER,
                EXTERNAL_ACCESS,
                WRITE_TIMEOUT_PARAMETER,
                SEND_FILTER_PARAM,
                READ_DATA_PARAMETER,
                FILTER_PARAM
                );
    }
    private InetAddress getLocalHost() throws UnknownHostException {
        InetAddress local=null;
        try {
            local = InetAddress.getByName("localhost");
        }catch(Exception ex){
            AvnLog.e("Exception getting localhost: "+ex);
        }
        if (local == null) local=InetAddress.getLocalHost();
        return local;
    }
    private ServerSocket serversocket;
    private class Client{
        ConnectionReaderWriter handler;
        Thread thread;
        ClientConnection connection;
        Client(ClientConnection connection){
            handler=new ConnectionReaderWriter(connection,getSourceName(),queue);
            this.connection=connection;
            this.thread=new Thread(new Runnable() {
                @Override
                public void run() {
                    try{
                        status.setChildStatus(connection.getId(), WorkerStatus.Status.NMEA,"connected");
                        handler.run();
                        status.unsetChildStatus(connection.getId());
                    }catch (Throwable t){
                        status.setChildStatus(connection.getId(), WorkerStatus.Status.ERROR,"stoppped with exception "+t.getMessage());
                    }
                }
            });
            this.thread.setDaemon(true);
            this.thread.start();
        }
        boolean isAlive(){
            return this.thread.isAlive();
        }
        boolean check(){
            if (! isAlive()) return true;
            return connection.check();
        }
        void stop(){
            handler.stop();
            thread.interrupt();
            status.unsetChildStatus(connection.getId());
        }
    }
    private HashMap<String,Client> clients=new HashMap<String,Client>();

    private void stopClients(){
        for (Client cl:clients.values()){
            try {
                cl.stop();
            }catch(Throwable t){
                AvnLog.e("error stopping client ",t);
            }
        }
        clients.clear();
        status.removeChildren();
    }
    @Override
    public void run(int startSequence) throws JSONException, IOException {
        stopClients();
        int port = PORT_PARAMETER.fromJson(parameters);
        boolean allowExternal=EXTERNAL_ACCESS.fromJson(parameters);
        if (serversocket != null){
            try{
                serversocket.close();
            }catch(Throwable t){}
        }
        serversocket=new ServerSocket();
        serversocket.setReuseAddress(true);
        if (allowExternal) serversocket.bind(new InetSocketAddress(port));
        else {
            InetAddress local=getLocalHost();
            serversocket.bind(new InetSocketAddress(local.getHostAddress(),port));
        }
        setStatus(WorkerStatus.Status.NMEA,"listening on "+port+", external access "+allowExternal);
        while (! shouldStop(startSequence)){
            try{
                Socket client=serversocket.accept();
                String remote=client.getRemoteSocketAddress().toString();
                AvnLog.i("new client connected: "+remote);
                ClientConnection connection=new ClientConnection(client,remote);
                ConnectionReaderWriter.ConnectionProperties properties=getConnectionProperties();
                properties.readData=READ_DATA_PARAMETER.fromJson(parameters);
                properties.writeData=true;
                connection.setProperties(properties);
                synchronized (this) {
                    clients.put(remote, new Client(connection));
                }
            }catch (Throwable t){
                AvnLog.e("error in accept",t);
            }
        }
        stopClients();
        setStatus(WorkerStatus.Status.INACTIVE,"stopped");
    }

    @Override
    public void check() throws JSONException {
        super.check();
        ArrayList<String> removes=new ArrayList<>();
        synchronized (this) {
            for (Client cl : clients.values()) {
                if (!cl.isAlive()) {
                    removes.add(cl.connection.getId());
                }
                else{
                    if (cl.check()){
                        AvnLog.i("closing connection "+cl.connection.getId()+" in check");
                        cl.stop();
                        removes.add(cl.connection.getId());
                    }
                }
            }
        }
        synchronized (this) {
            for (String rm : removes) {
                clients.remove(rm);
                status.unsetChildStatus(rm);
            }
        }
    }
}
