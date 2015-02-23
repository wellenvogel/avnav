package de.wellenvogel.avnav.main;

/**
 * Created by andreas on 06.01.15.

 */


import android.app.NotificationManager;
import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.os.Handler;
import android.service.textservice.SpellCheckerService;
import android.util.Log;
import de.wellenvogel.avnav.util.AvnLog;
import org.apache.http.*;
import org.apache.http.client.utils.URLEncodedUtils;
import org.apache.http.entity.ContentProducer;
import org.apache.http.entity.EntityTemplate;
import org.apache.http.entity.InputStreamEntity;
import org.apache.http.impl.DefaultConnectionReuseStrategy;
import org.apache.http.impl.DefaultHttpResponseFactory;
import org.apache.http.impl.DefaultHttpServerConnection;
import org.apache.http.params.BasicHttpParams;
import org.apache.http.params.CoreConnectionPNames;
import org.apache.http.params.CoreProtocolPNames;
import org.apache.http.protocol.*;

import java.io.*;
import java.net.*;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;

public class WebServer {

    static final String NAME="AvNavWebServer";
    private int serverPort = 34567; //TODO: make this configurable

    private BasicHttpProcessor httpproc = null;
    private BasicHttpContext httpContext = null;
    private HttpService httpService = null;
    private HttpRequestHandlerRegistry registry = null;
    private NotificationManager notifyManager = null;

    protected WebServerActivity activity;
    private boolean running;

    class NavRequestHandler implements HttpRequestHandler{

        @Override
        public void handle(HttpRequest httpRequest, HttpResponse httpResponse, HttpContext httpContext) throws HttpException, IOException {
            AvnLog.d(NAME,"nav request"+httpRequest.getRequestLine());
            String url = URLDecoder.decode(httpRequest.getRequestLine().getUri());
            String method = httpRequest.getRequestLine().getMethod().toUpperCase(Locale.ENGLISH);
            if (!method.equals("GET") && !method.equals("HEAD") ) {
                throw new MethodNotSupportedException(method + " method not supported");
            }
            url=url.replaceAll("^/*","");
            WebViewActivityBase.ExtendedWebResourceResponse resp=activity.handleNavRequest(url);
            if (resp != null){
                httpResponse.setHeader("content-type","application/json");
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


    class ChartRequestHandler implements HttpRequestHandler{

        @Override
        public void handle(HttpRequest httpRequest, HttpResponse httpResponse, HttpContext httpContext) throws HttpException, IOException {
            AvnLog.d(NAME,"chart request"+httpRequest.getRequestLine());
            String url = URLDecoder.decode(httpRequest.getRequestLine().getUri());
            String method = httpRequest.getRequestLine().getMethod().toUpperCase(Locale.ENGLISH);
            if (!method.equals("GET") && !method.equals("HEAD") ) {
                throw new MethodNotSupportedException(method + " method not supported");
            }
            url=url.replaceAll("^/*","");
            WebViewActivityBase.ExtendedWebResourceResponse resp=activity.handleChartRequest(url);
            if (resp != null){
                httpResponse.setHeader("content-type",resp.getMimeType());
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

    private ChartRequestHandler chartRequestHandler=new ChartRequestHandler();

    class BaseRequestHandler implements HttpRequestHandler{

        @Override
        public void handle(HttpRequest httpRequest, HttpResponse httpResponse, HttpContext httpContext) throws HttpException, IOException {
            AvnLog.d(NAME,"base request"+httpRequest.getRequestLine());
            String url = URLDecoder.decode(httpRequest.getRequestLine().getUri());
            String method = httpRequest.getRequestLine().getMethod().toUpperCase(Locale.ENGLISH);
            if (!method.equals("GET") && !method.equals("HEAD") ) {
                throw new MethodNotSupportedException(method + " method not supported");
            }
            url=url.replaceAll("^/*","");
            url=url.replaceAll("\\?.*","");
            //TODO: restrict access
            try {
                InputStream is = activity.assetManager.open(url);
                httpResponse.setStatusCode(HttpStatus.SC_OK);
                httpResponse.setEntity(streamToEntity(is));
                httpResponse.addHeader("content-type", activity.mimeType(url));

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


    public WebServer(WebServerActivity controller) {

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

        Listener() throws IOException {
            serversocket = new ServerSocket();
            try {
                serversocket.setReuseAddress(true);
                serversocket.bind(new InetSocketAddress(serverPort));
            }catch (IOException ex){
                try {
                    serversocket.close();
                }catch (IOException i){}
                throw ex;
            }
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
            registry.register("/"+activity.NAVURL+"*",navRequestHandler);
            registry.register("/"+activity.CHARTPREFIX+"*",chartRequestHandler);

            registry.register("*",baseRequestHandler);

            httpService.setHandlerResolver(registry);
        }

        int getPort(){
            return serversocket.getLocalPort();
        }

        void close(){
            try {
                serversocket.close();
            }catch(Exception i){}
        }

        @Override
        public void run(){
            AvnLog.i(NAME,"Listening on port " + this.serversocket.getLocalPort());
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
                    break;
                } catch (InterruptedIOException ex) {
                    Log.e(NAME,"Listener Interrupted ");
                    break;
                } catch (IOException e) {
                    Log.d(NAME,"Listener I/O error "
                            + e.getMessage());
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
                Log.e(NAME,"HTTP violation: " + ex.getMessage());
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

    public int startServer() throws IOException {
        if (running && listener != null) return listener.getPort();
        AvnLog.d(NAME,"start");
        running=true;
        listener=new Listener();
        listener.setDaemon(true);
        listener.start();
        return listener.getPort();
    }



}

