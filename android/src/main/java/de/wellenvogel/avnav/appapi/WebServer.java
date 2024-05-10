package de.wellenvogel.avnav.appapi;

/**
 * Created by andreas on 06.01.15.

 */


import android.app.NotificationManager;
import android.net.Uri;
import android.util.Log;

import org.apache.http.ConnectionClosedException;
import org.apache.http.HttpEntity;
import org.apache.http.HttpEntityEnclosingRequest;
import org.apache.http.HttpException;
import org.apache.http.HttpRequest;
import org.apache.http.HttpResponse;
import org.apache.http.HttpServerConnection;
import org.apache.http.HttpStatus;
import org.apache.http.MethodNotSupportedException;
import org.apache.http.entity.InputStreamEntity;
import org.apache.http.impl.DefaultConnectionReuseStrategy;
import org.apache.http.impl.DefaultHttpResponseFactory;
import org.apache.http.impl.DefaultHttpServerConnection;
import org.apache.http.io.SessionInputBuffer;
import org.apache.http.io.SessionOutputBuffer;
import org.apache.http.params.BasicHttpParams;
import org.apache.http.params.CoreConnectionPNames;
import org.apache.http.params.CoreProtocolPNames;
import org.apache.http.params.HttpParams;
import org.apache.http.protocol.BasicHttpContext;
import org.apache.http.protocol.BasicHttpProcessor;
import org.apache.http.protocol.ExecutionContext;
import org.apache.http.protocol.HttpContext;
import org.apache.http.protocol.HttpRequestHandler;
import org.apache.http.protocol.HttpRequestHandlerRegistry;
import org.apache.http.protocol.HttpService;
import org.apache.http.protocol.ResponseConnControl;
import org.apache.http.protocol.ResponseContent;
import org.apache.http.protocol.ResponseDate;
import org.apache.http.protocol.ResponseServer;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InterruptedIOException;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.util.Enumeration;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.WeakHashMap;

import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.worker.EditableParameter;
import de.wellenvogel.avnav.worker.GpsService;
import de.wellenvogel.avnav.worker.Worker;
import de.wellenvogel.avnav.worker.WorkerStatus;

public class WebServer extends Worker {

    static final String NAME="AvNavWebServer";
    private final EditableParameter.StringParameter mdnsNameParameter;
    private final EditableParameter.BooleanParameter mdnsEnabledParameter;

    private BasicHttpProcessor httpproc = null;
    private BasicHttpContext httpContext = null;
    private HttpService httpService = null;
    private HttpRequestHandlerRegistry registry = null;
    private NotificationManager notifyManager = null;

    protected GpsService gpsService;
    private boolean running;
    private boolean listenAny;

    private final WeakHashMap<AvNavHttpServerConnection,Boolean> connections=new WeakHashMap<>();

    private void storeConnection(AvNavHttpServerConnection connection){
        synchronized (connections){
            connections.put(connection,true);
        }
    }

    private Set<AvNavHttpServerConnection> getConnections(){
        synchronized (connections){
            HashSet<AvNavHttpServerConnection> rt=new HashSet<>(connections.keySet());
            return rt;
        }
    }


    public RequestHandler.ServerInfo getServerInfo(InetAddress currentTarget){
        RequestHandler.ServerInfo info=null;
        if (listener != null){
            try {
                info = new RequestHandler.ServerInfo();
                info.address = (currentTarget != null)?currentTarget:listener.getLocalAddress().getAddress();
                info.listenAny = listener.getAny();
                info.lastError = listener.getLastError();
            }catch (Throwable t){}
        }
        return info;
    };

    public static final EditableParameter.BooleanParameter ANY_ADDRESS=
            new EditableParameter.BooleanParameter("external",R.string.enableExternalAccess,false);
    public static final EditableParameter.IntegerParameter PORT=
            new EditableParameter.IntegerParameter("port",R.string.labelSettingsServerPort,8080);

    public WebServer(GpsService controller) {
        super("WebServer",controller);
        mdnsEnabledParameter=MDNS_ENABLED.clone(true);
        mdnsNameParameter=MDNS_NAME.clone("avnav-android");
        parameterDescriptions.addParams(
                PORT,
                Worker.ENABLED_PARAMETER.clone(false),
                ANY_ADDRESS,
                mdnsEnabledParameter,
                mdnsNameParameter
        );
        gpsService =controller;
        status.canEdit=true;
    }
    private static final String SERVICE_TYPE="_http._tcp";

    @Override
    protected void checkParameters(JSONObject newParam) throws JSONException, IOException {
        super.checkParameters(newParam);
        Integer port=PORT.fromJson(newParam);
        checkClaim(CLAIM_TCPPORT,port.toString(),true);
        if ((newParam.has(mdnsEnabledParameter.name) && mdnsEnabledParameter.fromJson(newParam))
            || (! newParam.has(mdnsEnabledParameter.name) && mdnsEnabledParameter.fromJson(parameters))) {
            String mdnsName=null;
            if (newParam.has(mdnsNameParameter.name)) mdnsName=mdnsNameParameter.fromJson(newParam);
            else mdnsName=mdnsNameParameter.fromJson(parameters);
            if (mdnsName == null || mdnsName.isEmpty())
                throw new JSONException(mdnsNameParameter.name+" cannot be empty when "+mdnsEnabledParameter.name+" is set");
            checkClaim(CLAIM_SERVICE, SERVICE_TYPE+"."+mdnsName, true);
        }
    }

    private void closeConnections(){
        Set<AvNavHttpServerConnection> current=getConnections();
        for (AvNavHttpServerConnection connection:current){
            try{
                connection.close();
                connection.shutdown();
                connection.setClosed();
            }catch(Throwable t){
                AvnLog.dfs("exception closing connection %s:%s",connection,t);
            }
        }
        synchronized(connections){
            for (AvNavHttpServerConnection connection:current){
                connections.remove(connection);
            }
        }
    }

    @Override
    public void check() throws JSONException {
        super.check();
        Set<AvNavHttpServerConnection> current=getConnections();
        synchronized (connections) {
            for (AvNavHttpServerConnection connection : current) {
                if (connection.isClosed || ! connection.isOpen()) {
                    connections.remove(connection);
                }
            }
        }
    }

    @Override
    protected void run(int startSequence) throws JSONException, IOException {
        Integer port=PORT.fromJson(parameters);
        listenAny=ANY_ADDRESS.fromJson(parameters);
        addClaim(CLAIM_TCPPORT,port.toString(),true);
        if (mdnsEnabledParameter.fromJson(parameters)) {
            addClaim(CLAIM_SERVICE, SERVICE_TYPE+"."+mdnsNameParameter.fromJson(parameters), true);
            gpsService.registerService(getId(), SERVICE_TYPE, mdnsNameParameter.fromJson(parameters), port);
        }
        setStatus(WorkerStatus.Status.STARTED,"starting with port "+port+", external access "+listenAny);
        running=true;
        listener=new Listener(listenAny,port);
        listener.run(startSequence);
        closeConnections();
    }

    @Override
    public synchronized JSONObject getJsonStatus() throws JSONException {
        JSONObject rt=super.getJsonStatus();
        int port=getPort();
        if (isRunning() && port != 0){
            JSONObject props=new JSONObject();
            JSONArray addr=new JSONArray();
            if (listenAny) {
                try {
                    Enumeration<NetworkInterface> intfs = NetworkInterface.getNetworkInterfaces();
                    while (intfs.hasMoreElements()) {
                        NetworkInterface intf = intfs.nextElement();
                        Enumeration<InetAddress> ifaddresses = intf.getInetAddresses();
                        while (ifaddresses.hasMoreElements()) {
                            InetAddress ifaddress = ifaddresses.nextElement();
                            if (ifaddress.getHostAddress().contains(":"))
                                continue; //skip IPV6 for now
                            String ifurl = ifaddress.getHostAddress() + ":" + port;
                            addr.put(ifurl);
                        }
                    }
                } catch (SocketException e1) {
                }
            }
            else{
                try {
                    addr.put(getLocalHost().getHostAddress()+":"+port);
                } catch (UnknownHostException e) {

                }
            }
            props.put("addresses",addr);
            rt.put("properties",props);
        }
        return rt;
    }

    class NavRequestHandler implements HttpRequestHandler{

        @Override
        public void handle(HttpRequest httpRequest, HttpResponse httpResponse, HttpContext httpContext) throws HttpException, IOException {
            AvnLog.d(NAME,"nav request"+httpRequest.getRequestLine());
            String url = httpRequest.getRequestLine().getUri();
            String method = httpRequest.getRequestLine().getMethod().toUpperCase(Locale.ENGLISH);
            RequestHandler handler=gpsService.getRequestHandler();
            if (!method.equals("GET") && !method.equals("HEAD")  && ! method.equals("POST")) {
                throw new MethodNotSupportedException(method + " method not supported");
            }
            Uri uri=Uri.parse(url);
            if (uri.getPath() == null){
                throw new HttpException("no path in "+url);
            }
            PostVars postData=null;
            if (httpRequest instanceof HttpEntityEnclosingRequest) {
                HttpEntity data = ((HttpEntityEnclosingRequest) httpRequest).getEntity();
                if (data != null) postData= new PostVars(data);
            }
            ExtendedWebResourceResponse resp=null;
            try {
                if (handler!= null) {
                    AvNavHttpServerConnection con=(AvNavHttpServerConnection)httpContext.getAttribute("http.connection");
                    InetAddress currentTarget=null;
                    if (con != null){
                        currentTarget=con.getLocalAddress();
                    }
                    resp = handler.handleNavRequest(uri,
                            postData,
                            getServerInfo(currentTarget));
                }
            }catch (Throwable t){
                AvnLog.e("error handling request "+url,t);
                if (postData != null) {
                    postData.closeInput();
                    HttpServerConnection con=(HttpServerConnection)httpContext.getAttribute(ExecutionContext.HTTP_CONNECTION);
                    con.close();
                }
                throw new HttpException("error handling "+url,t);
            }
            if (resp != null){
                httpResponse.setHeader("content-type","application/json");
                for (String k:resp.getHeaders().keySet()){
                    httpResponse.setHeader(k,resp.getHeaders().get(k));
                }
                if (resp.getLength() < 0){
                    httpResponse.setEntity(streamToEntity(resp.getData()));
                }
                else {
                    httpResponse.setEntity(new InputStreamEntity(resp.getData(),resp.getLength()));
                }
            }
            else {
                AvnLog.d(NAME,"no data for "+url);
                httpResponse.setStatusCode(404);
            }
        }
    }

    private NavRequestHandler navRequestHandler=new NavRequestHandler();



    class DirectoryRequestHandler implements HttpRequestHandler{

        RequestHandler handler;
        String prefix;
        DirectoryRequestHandler(String prefix,RequestHandler handler){
            this.handler=handler;
            this.prefix=prefix;
        }
        @Override
        public void handle(HttpRequest request, HttpResponse response, HttpContext context) throws HttpException, IOException {
            AvnLog.d(NAME,"prefix request for "+prefix+request.getRequestLine());
            try {
                String url=request.getRequestLine().getUri();
                Uri uri=Uri.parse(url);
                if (uri.getPath() == null){
                    response.setStatusCode(404);
                    response.setReasonPhrase("no path");
                    return;
                }
                String method = request.getRequestLine().getMethod().toUpperCase(Locale.ENGLISH);
                if (method.equals("GET") || method.equals("HEAD")) {
                    ExtendedWebResourceResponse resp = handler.tryDirectRequest(uri,method);
                    if (resp != null) {
                        for (String n : resp.getHeaders().keySet()){
                            response.setHeader(n,resp.getHeaders().get(n));
                        }
                        response.setHeader("content-type", resp.getMimeType());
                        InputStream ris=resp.getData();
                        if (ris != null) {
                            if (resp.getLength() < 0) {
                                response.setEntity(streamToEntity(resp.getData()));
                            } else {
                                response.setEntity(new InputStreamEntity(resp.getData(), resp.getLength()));
                            }
                        }
                    } else {
                        AvnLog.d(NAME, "no data for " + url);
                        response.setStatusCode(404);
                    }
                } else {
                    AvnLog.d(NAME, "invalid method " + method);
                    response.setStatusCode(404);
                }
            }catch(Throwable t){
                response.setStatusCode(500);
                response.setReasonPhrase(t.getLocalizedMessage());
                AvnLog.e("http request processing error",t);
            }

        }

        String getPrefix(){
            return prefix;
        }
    }

    class BaseRequestHandler implements HttpRequestHandler{

        @Override
        public void handle(HttpRequest httpRequest, HttpResponse httpResponse, HttpContext httpContext) throws HttpException{
            AvnLog.d(NAME,"base request"+httpRequest.getRequestLine());
            Uri uri=Uri.parse(httpRequest.getRequestLine().getUri());
            if (uri.getPath() == null){
                throw new HttpException("no path");
            }
            String method = httpRequest.getRequestLine().getMethod().toUpperCase(Locale.ENGLISH);
            if (!method.equals("GET") && !method.equals("HEAD") ) {
                throw new MethodNotSupportedException(method + " method not supported");
            }
            String path=uri.getPath();
            if (path.equals("")|| path.equals("/")) {
                httpResponse.setStatusCode(301);
                httpResponse.addHeader("Location",RequestHandler.ROOT_PATH+"/avnav_viewer.html?onAndroid=1");
                return;
            }
            path=path.replaceAll("^/*","");
            //TODO: restrict access
            try {
                InputStream is= gpsService.getAssets().open(path);
                httpResponse.setStatusCode(HttpStatus.SC_OK);
                httpResponse.setEntity(new InputStreamEntity(is,-1));
                httpResponse.addHeader("content-type", RequestHandler.mimeType(path));

            }catch (Exception e){
                AvnLog.d(NAME,"file "+path+" not found: "+e);
                httpResponse.setStatusCode(404);
                httpResponse.setReasonPhrase("not found");
            }

        }
    }


    private BaseRequestHandler baseRequestHandler=new BaseRequestHandler();

    //we need to read completely as currently there is no streaming entity without the size
    private static HttpEntity streamToEntity(InputStream is) throws IOException {
        byte tmp[] = new byte[4096];
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        int length;
        //we need to read completely as currently there is no streaming entity without the size
        while ((length = is.read(tmp)) != -1) buffer.write(tmp, 0, length);
        AvnLog.d(NAME,"convert is: "+buffer.size());
        return new InputStreamEntity(new ByteArrayInputStream(buffer.toByteArray()), buffer.size());
    }

    private Listener listener;


    public int getPort(){
        if (listener != null){
            return listener.getPort();
        }
        return 0;
    }

    public boolean isRunning(){
        //TODO: check listener
        return running;
    }

    private InetAddress getLocalHost() throws UnknownHostException {
        return AvnUtil.getLocalHost();
    }

    static class AvNavHttpServerConnection extends DefaultHttpServerConnection{
        SessionInputBuffer avInputBuffer;
        SessionOutputBuffer avOutputBuffer;
        //prevent the final request processing when we are done with the websocket
        private boolean isClosed=false;
        @Override
        protected void init(SessionInputBuffer inbuffer, SessionOutputBuffer outbuffer, HttpParams params) {
            avInputBuffer=inbuffer;
            avOutputBuffer=outbuffer;
            super.init(inbuffer, outbuffer, params);
        }

        @Override
        public void sendResponseHeader(HttpResponse response) throws HttpException, IOException {
            if (isClosed) return;
            super.sendResponseHeader(response);
        }

        @Override
        public void sendResponseEntity(HttpResponse response) throws HttpException, IOException {
            if (isClosed) return;
            super.sendResponseEntity(response);
        }

        @Override
        public void flush() throws IOException {
            if (isClosed) return;
            super.flush();
        }

        public void setClosed(){
            isClosed=true;
        }
    }
    class Listener{
        private ServerSocket serversocket;
        private BasicHttpParams params;
        private HttpService httpService;
        private boolean any; //bind to any
        private int port;
        private String lastError=null;
        private HashSet<String> registeredHandlerPrefixes=new HashSet<String>();


        Listener(boolean any, int port) throws IOException {
            this.port=port;
            this.any=any;
            serversocket = new ServerSocket();
            params = new BasicHttpParams();
            params
                    .setIntParameter(CoreConnectionPNames.SO_TIMEOUT, 5000)
                    .setIntParameter(CoreConnectionPNames.SOCKET_BUFFER_SIZE, 8 * 1024)
                    .setBooleanParameter(CoreConnectionPNames.STALE_CONNECTION_CHECK, false)
                    .setBooleanParameter(CoreConnectionPNames.TCP_NODELAY, true)
                    .setParameter(CoreProtocolPNames.ORIGIN_SERVER, NAME);
            httpproc = new BasicHttpProcessor();
            httpContext = new BasicHttpContext();
            httpproc.addInterceptor(new ResponseDate());
            httpproc.addInterceptor(new ResponseServer());
            httpproc.addInterceptor(new ResponseContent());
            httpproc.addInterceptor(new ResponseConnControl());

            httpService = new HttpService(httpproc,
                    new DefaultConnectionReuseStrategy(),
                    new DefaultHttpResponseFactory()){
                @Override
                protected void doService(HttpRequest request, HttpResponse response, HttpContext context) throws HttpException, IOException {
                    String url = request.getRequestLine().getUri();
                    String method = request.getRequestLine().getMethod().toUpperCase(Locale.ENGLISH);
                    if (method.equals("GET") &&
                            request.containsHeader("Upgrade")
                            && "websocket".equals(request.getFirstHeader("Upgrade").getValue())){
                        RequestHandler handler=gpsService.getRequestHandler();
                        if (handler == null){
                            response.setStatusCode(500);
                            response.setReasonPhrase("no handler for websocket request");
                            return;
                        }
                        IWebSocketHandler wsHandler=handler.getWebSocketHandler(url);
                        if (wsHandler == null){
                            response.setStatusCode(404);
                            response.setReasonPhrase("no websocket handler for "+url);
                        }
                        AvNavHttpServerConnection con=(AvNavHttpServerConnection) context.getAttribute(ExecutionContext.HTTP_CONNECTION);
                        storeConnection(con);
                        WebSocket ws=new WebSocket(request,response,context,wsHandler);
                        try {
                            ws.handle();
                        }catch (Throwable t){
                            AvnLog.e("error in websocket handling",t);
                            con.close();
                            con.setClosed();

                        }
                        return;
                    }
                    super.doService(request, response, context);
                }
            };
            httpService.setParams(params);
            registry = new HttpRequestHandlerRegistry();
            registry.register("/"+ RequestHandler.NAVURL+"*",navRequestHandler);
            for (INavRequestHandler h: gpsService.getRequestHandler().getHandlers()){
                String prefix=h.getPrefix();
                if (prefix == null) continue;
                DirectoryRequestHandler handler=new DirectoryRequestHandler(prefix, gpsService.getRequestHandler());
                registeredHandlerPrefixes.add(prefix);
                registry.register("/"+h.getPrefix()+"/*",handler);
            }

            registry.register("*",baseRequestHandler);

            httpService.setHandlerResolver(registry);
        }

        int getPort(){
            return port;
        }
        String getLastError(){
            return lastError;
        }
        InetSocketAddress getLocalAddress(){
            if (listener == null) return new InetSocketAddress(port);
            return new InetSocketAddress(serversocket.getInetAddress(),port);
        }

        boolean getAny(){
            return any;
        }
        void close(){
            try {
                serversocket.close();
            }catch(Exception i){}
        }

        public void run(int startSequence) throws IOException {
            AvnLog.i(NAME,"Listening on port " + this.serversocket.getLocalPort());
            lastError=null;
            try {
                serversocket.setReuseAddress(true);
                if (any) serversocket.bind( new InetSocketAddress( port));
                else {
                    InetAddress local=getLocalHost();
                    serversocket.bind(new InetSocketAddress(local.getHostAddress(),port));
                }
                setStatus(WorkerStatus.Status.NMEA,"active on port "+port+", external access "+any);
            }catch (IOException ex){
                AvnLog.e("Exception while starting server "+ex);
                lastError=ex.getLocalizedMessage();
                try {
                    serversocket.close();
                }catch (IOException i){}
               throw ex;
            }
            while (!shouldStop(startSequence)) {
                try {
                    Socket socket = this.serversocket.accept();
                    AvNavHttpServerConnection conn = new AvNavHttpServerConnection();
                    AvnLog.i(NAME, "con " + socket.getInetAddress());
                    conn.bind(socket, this.params);

                    // Start worker thread
                    Thread t = new WorkerThread(this.httpService, conn, socket);
                    t.setDaemon(true);
                    t.start();
                } catch (SocketException e) {
                    lastError=e.getLocalizedMessage();
                    break;
                } catch (InterruptedIOException ex) {
                    Log.e(NAME,"Listener Interrupted ");
                    lastError=ex.getLocalizedMessage();
                    break;
                } catch (IOException e) {
                    Log.d(NAME,"Listener I/O error "
                            + e.getMessage());
                    lastError=e.getLocalizedMessage();
                    break;
                }
            }
            AvnLog.i(NAME,"Listener stopped");
        }

    }

    class WorkerThread extends Thread {

        private final HttpService httpservice;
        private final AvNavHttpServerConnection conn;
        private final Socket socket;

        public WorkerThread(
                final HttpService httpservice,
                final AvNavHttpServerConnection conn,
                final Socket socket) {
            super();
            this.httpservice = httpservice;
            this.conn = conn;
            this.socket = socket;
        }

        public void run() {
            AvnLog.d(NAME,"con");
            HttpContext context = new BasicHttpContext();
            try {
                while (!Thread.interrupted() && this.conn.isOpen() && running) {
                    this.httpservice.handleRequest(this.conn, context);
                }
            } catch (ConnectionClosedException ex) {
                Log.e(NAME,"closed");
            } catch (SocketTimeoutException ex) {
                Log.e(NAME,"timeout");
            } catch (IOException ex) {
                Log.e(NAME,"I/O error: " + ex.getMessage());
            } catch (HttpException ex) {
                Log.e(NAME, "HTTP violation: " + ex.getMessage());
            } catch (Throwable t){
                Log.e(NAME,"HTTP worker exception: "+t.getMessage());
            } finally {
                try {
                    this.conn.shutdown();
                } catch (IOException ignore) {}
            }
        }
    }
    @Override
    public void stop() {
        super.stop();
        running=false;
        AvnLog.d(NAME,"stop");
        listener.close();
        listener=null;
        closeConnections();
    }


}

