package de.wellenvogel.avnav.worker;

import android.net.nsd.NsdServiceInfo;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.ArrayList;
import java.util.HashMap;

import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.util.NmeaQueue;

/**
 * Created by andreas on 25.12.14.
 */
public class SocketWriter extends ChannelWorker {
    private final EditableParameter.StringParameter mdnsNameParameter;
    private final EditableParameter.BooleanParameter mdnsEnableParameter;

    static class Creator extends WorkerFactory.Creator{
        @Override
        ChannelWorker create(String name, GpsService ctx, NmeaQueue queue) throws JSONException {
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

    private SocketWriter(String name, GpsService ctx, NmeaQueue queue) throws JSONException {
        super(name,ctx,queue);
        EditableParameter.StringParameter filter=FILTER_PARAM.clone("");
        filter.setConditions(new AvnUtil.KeyValue<Boolean>(READ_DATA_PARAMETER.name,true));
        mdnsNameParameter=MDNS_NAME.clone("avnav-android");
        mdnsEnableParameter =MDNS_ENABLED.clone(false);
        parameterDescriptions.addParams(
                PORT_PARAMETER,
                ENABLED_PARAMETER,
                SOURCENAME_PARAMETER,
                EXTERNAL_ACCESS,
                WRITE_TIMEOUT_PARAMETER,
                SEND_FILTER_PARAM,
                BLACKLIST_PARAMETER,
                READ_DATA_PARAMETER,
                filter,
                mdnsEnableParameter,
                mdnsNameParameter
                );
        status.canEdit=true;
        status.canDelete=true;
    }

    private ServerSocket serversocket;
    private class Client{
        ConnectionReaderWriter handler;
        Thread thread;
        ClientConnection connection;
        Client(ClientConnection connection) throws JSONException {
            handler=new ConnectionReaderWriter(connection, getSourceName(), getPriority(null), queue, QUEUE_AGE_PARAMETER.fromJson(parameters), new ConnectionReaderWriter.StatusUpdater() {
                @Override
                public void update(WorkerStatus.Status st, String info) {
                    status.setChildStatus(connection.getId(),st,info);
                }
            });
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
    protected void checkParameters(JSONObject newParam) throws JSONException, IOException {
        Integer port=PORT_PARAMETER.fromJson(newParam);
        checkClaim(CLAIM_TCPPORT,port.toString(),true);
        if ((newParam.has(mdnsEnableParameter.name) && mdnsEnableParameter.fromJson(newParam))
        || (!newParam.has(mdnsEnableParameter.name) && mdnsEnableParameter.fromJson(parameters))){
            String mdnsName=null;
            if (newParam.has(mdnsNameParameter.name)) mdnsName=mdnsNameParameter.fromJson(newParam);
            else mdnsName=mdnsNameParameter.fromJson(parameters);
            if (mdnsName == null || mdnsName.isEmpty())
                throw new JSONException(MDNS_NAME.name+" cannot be empty when "+MDNS_ENABLED.name+" is set");
            checkClaim(CLAIM_SERVICE, TcpServiceReader.NMEA_SERVICE_TYPE+"."+mdnsName, true);
        }
    }

    @Override
    public void stop() {
        super.stop();
        try{
            serversocket.close();
            serversocket=null;
        }catch (Throwable t){}
        stopClients();
    }

    @Override
    public void run(int startSequence) throws JSONException, IOException {
        stopClients();
        Integer port = PORT_PARAMETER.fromJson(parameters);
        addClaim(CLAIM_TCPPORT,port.toString(),true);
        if (mdnsEnableParameter.fromJson(parameters)) {
            addClaim(CLAIM_SERVICE, TcpServiceReader.NMEA_SERVICE_TYPE+"."+mdnsNameParameter.fromJson(parameters), true);
        }
        boolean allowExternal=EXTERNAL_ACCESS.fromJson(parameters);
        if (serversocket != null){
            try{
                serversocket.close();
            }catch(Throwable t){}
        }
        serversocket=new ServerSocket();
        serversocket.setReuseAddress(true);
        if (allowExternal) serversocket.bind(new InetSocketAddress(Inet4Address.getByName("0.0.0.0"),port));
        else {
            InetAddress local= AvnUtil.getLocalHost();
            serversocket.bind(new InetSocketAddress(local.getHostAddress(),port));
        }
        if (mdnsEnableParameter.fromJson(parameters)) {
            gpsService.registerService(getId(),TcpServiceReader.NMEA_SERVICE_TYPE,
                    mdnsNameParameter.fromJson(parameters),port);
        }
        setStatus(WorkerStatus.Status.NMEA,"listening on "+port+", external access "+allowExternal);
        while (! shouldStop(startSequence)){
            Socket client=null;
            try {
                client = serversocket.accept();
            }catch (Throwable t) {
                AvnLog.e("accept error", t);
                try {
                    client.close();
                } catch (Throwable t1) {}
                break;
            }
            try{
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
            }catch (Throwable tc){
                AvnLog.e("unable to run client",tc);
                try{
                    client.close();
                }catch (Throwable tx){}
            }
        }
        stopClients();
        setStatus(WorkerStatus.Status.INACTIVE,"stopped");
        removeClaims();
        try{
            serversocket.close();
            serversocket=null;
        }catch(Throwable t){}
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
        NsdServiceInfo service=gpsService.getRegisteredService(getId());
        if (service == null){
            status.unsetChildStatus("mdns");
        }
        else{
            status.setChildStatus("mdns", WorkerStatus.Status.NMEA,service.getServiceName());
        }
    }
}
