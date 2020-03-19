package de.wellenvogel.avnav.appapi;

/**
 * Created by andreas on 06.01.15.

 */


import android.app.NotificationManager;
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
import org.apache.http.params.BasicHttpParams;
import org.apache.http.params.CoreConnectionPNames;
import org.apache.http.params.CoreProtocolPNames;
import org.apache.http.protocol.BasicHttpContext;
import org.apache.http.protocol.BasicHttpProcessor;
import org.apache.http.protocol.HttpContext;
import org.apache.http.protocol.HttpCoreContext;
import org.apache.http.protocol.HttpRequestHandler;
import org.apache.http.protocol.HttpRequestHandlerRegistry;
import org.apache.http.protocol.HttpService;
import org.apache.http.protocol.ResponseConnControl;
import org.apache.http.protocol.ResponseContent;
import org.apache.http.protocol.ResponseDate;
import org.apache.http.protocol.ResponseServer;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InterruptedIOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketException;
import java.net.SocketTimeoutException;
import java.net.URLDecoder;
import java.util.Locale;

import de.wellenvogel.avnav.main.MainActivity;
import de.wellenvogel.avnav.util.AvnLog;

public class WebServer {

    static final String NAME="AvNavWebServer";

    private BasicHttpProcessor httpproc = null;
    private BasicHttpContext httpContext = null;
    private HttpService httpService = null;
    private HttpRequestHandlerRegistry registry = null;
    private NotificationManager notifyManager = null;

    protected MainActivity activity;
    private boolean running;

    public RequestHandler.ServerInfo getServerInfo(){
        RequestHandler.ServerInfo info=null;
        if (listener != null){
            try {
                info = new RequestHandler.ServerInfo();
                info.address = listener.getLocalAddress();
                info.listenAny = listener.getAny();
                info.lastError = listener.getLastError();
            }catch (Throwable t){}
        }
        return info;
    };

    class NavRequestHandler implements HttpRequestHandler{

        @Override
        public void handle(HttpRequest httpRequest, HttpResponse httpResponse, HttpContext httpContext) throws HttpException, IOException {
            AvnLog.d(NAME,"nav request"+httpRequest.getRequestLine());
            String url = URLDecoder.decode(httpRequest.getRequestLine().getUri());
            String method = httpRequest.getRequestLine().getMethod().toUpperCase(Locale.ENGLISH);
            if (!method.equals("GET") && !method.equals("HEAD")  && ! method.equals("POST")) {
                throw new MethodNotSupportedException(method + " method not supported");
            }
            url=url.replaceAll("^/*", "");
            PostVars postData=null;
            if (httpRequest instanceof HttpEntityEnclosingRequest) {
                HttpEntity data = ((HttpEntityEnclosingRequest) httpRequest).getEntity();
                if (data != null) postData= new PostVars(data);
            }
            ExtendedWebResourceResponse resp=null;
            try {
                if (activity.getRequestHandler() != null) {
                    resp = activity.getRequestHandler().handleNavRequest(url,
                            postData,
                            getServerInfo());
                }
            }catch (Throwable t){
                AvnLog.e("error handling request "+url,t);
                if (postData != null) {
                    postData.closeInput();
                    HttpServerConnection con=(HttpServerConnection)httpContext.getAttribute(HttpCoreContext.HTTP_CONNECTION);
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

        INavRequestHandler handler;
        DirectoryRequestHandler(INavRequestHandler handler){
            this.handler=handler;
        }
        @Override
        public void handle(HttpRequest request, HttpResponse response, HttpContext context) throws HttpException, IOException {
            AvnLog.d(NAME,"prefix request for "+handler.getPrefix()+request.getRequestLine());
            try {
                String url = URLDecoder.decode(request.getRequestLine().getUri(),"UTF-8");
                String method = request.getRequestLine().getMethod().toUpperCase(Locale.ENGLISH);
                url = url.replaceAll("^/*", "");
                url = url.replaceAll("\\?.*", "");
                if (method.equals("GET") || method.equals("HEAD")) {
                    ExtendedWebResourceResponse resp = handler.handleDirectRequest(url);
                    if (resp != null) {
                        response.setHeader("content-type", resp.getMimeType());
                        if (resp.getLength() < 0) {
                            response.setEntity(streamToEntity(resp.getData()));
                        } else {
                            response.setEntity(new InputStreamEntity(resp.getData(), resp.getLength()));
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
            return handler.getPrefix();
        }
    }

    class BaseRequestHandler implements HttpRequestHandler{

        @Override
        public void handle(HttpRequest httpRequest, HttpResponse httpResponse, HttpContext httpContext) throws HttpException, IOException {
            AvnLog.d(NAME,"base request"+httpRequest.getRequestLine());
            String url = URLDecoder.decode(httpRequest.getRequestLine().getUri());
            String method = httpRequest.getRequestLine().getMethod().toUpperCase(Locale.ENGLISH);
            if (!method.equals("GET") && !method.equals("HEAD") ) {
                throw new MethodNotSupportedException(method + " method not supported");
            }
            if (url.equals("")|| url.equals("/")) {
                httpResponse.setStatusCode(301);
                httpResponse.addHeader("Location","/viewer/avnav_viewer.html?onAndroid=1");
                return;
            }
            url=url.replaceAll("^/*","");
            url=url.replaceAll("\\?.*","");
            //TODO: restrict access
            try {
                InputStream is=activity.getAssets().open(url);
                httpResponse.setStatusCode(HttpStatus.SC_OK);
                httpResponse.setEntity(new InputStreamEntity(is));
                httpResponse.addHeader("content-type", activity.getRequestHandler().mimeType(url));

            }catch (Exception e){
                AvnLog.d(NAME,"file "+url+" not found: "+e);
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


    public WebServer(MainActivity controller) {

        activity=controller;

    }

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


    class Listener extends Thread{
        private ServerSocket serversocket;
        private BasicHttpParams params;
        private HttpService httpService;
        private boolean any; //bind to any
        private int port;
        private String lastError=null;


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
                    new DefaultHttpResponseFactory());
            httpService.setParams(params);
            registry = new HttpRequestHandlerRegistry();
            registry.register("/"+ RequestHandler.NAVURL+"*",navRequestHandler);
            for (INavRequestHandler h: activity.getRequestHandler().getHandlers()){
                if (h.getPrefix() == null) continue;
                DirectoryRequestHandler handler=new DirectoryRequestHandler(h);
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

        @Override
        public void run(){
            AvnLog.i(NAME,"Listening on port " + this.serversocket.getLocalPort());
            lastError=null;
            try {
                serversocket.setReuseAddress(true);
                if (any) serversocket.bind(new InetSocketAddress(port));
                else {
                    InetAddress local=null;
                    try {
                        local = InetAddress.getByName("localhost");
                    }catch(Exception ex){
                        AvnLog.e("Exception getting localhost: "+ex);
                    }
                    if (local == null) local=InetAddress.getLocalHost();
                    serversocket.bind(new InetSocketAddress(local.getHostAddress(),port));
                }
            }catch (IOException ex){
                AvnLog.e("Exception while starting server "+ex);
                lastError=ex.getLocalizedMessage();
                try {
                    serversocket.close();
                }catch (IOException i){}
                return;
            }
            while (!Thread.interrupted()) {
                try {
                    Socket socket = this.serversocket.accept();
                    DefaultHttpServerConnection conn = new DefaultHttpServerConnection();
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
        private final HttpServerConnection conn;
        private final Socket socket;

        public WorkerThread(
                final HttpService httpservice,
                final HttpServerConnection conn,
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

    public void stopServer() {
        if (! running) return;
        AvnLog.d(NAME,"stop");
        running=false;
        listener.close();
        listener=null;
    }

    public int startServer(String port, boolean anyAddress) throws Exception {
        int newPort=Integer.parseInt(port);
        if (running && listener != null) {
            int oldPort=listener.getPort();
            boolean oldAny=listener.getAny();
            if (oldPort == newPort && oldAny == anyAddress) return oldPort;
            AvnLog.d(NAME,"stop");
            running=false;
            listener.close();
            listener=null;
        }
        AvnLog.d(NAME,"start");
        running=true;
        listener=new Listener(anyAddress,newPort);
        listener.setDaemon(true);
        listener.start();
        return listener.getPort();
    }



}

