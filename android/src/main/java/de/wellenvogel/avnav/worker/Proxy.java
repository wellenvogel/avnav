package de.wellenvogel.avnav.worker;

import android.net.Uri;

import org.apache.http.ConnectionReuseStrategy;
import org.apache.http.Header;
import org.apache.http.HttpEntity;
import org.apache.http.HttpException;
import org.apache.http.HttpHost;
import org.apache.http.HttpResponse;
import org.apache.http.HttpVersion;
import org.apache.http.impl.DefaultConnectionReuseStrategy;
import org.apache.http.impl.DefaultHttpClientConnection;
import org.apache.http.message.BasicHeader;
import org.apache.http.message.BasicHttpRequest;
import org.apache.http.params.BasicHttpParams;
import org.apache.http.params.HttpParams;
import org.apache.http.params.HttpProtocolParams;
import org.apache.http.protocol.BasicHttpContext;
import org.apache.http.protocol.BasicHttpProcessor;
import org.apache.http.protocol.ExecutionContext;
import org.apache.http.protocol.HttpContext;
import org.apache.http.protocol.HttpRequestExecutor;
import org.apache.http.protocol.RequestConnControl;
import org.apache.http.protocol.RequestContent;
import org.apache.http.protocol.RequestExpectContinue;
import org.apache.http.protocol.RequestTargetHost;
import org.apache.http.protocol.RequestUserAgent;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.net.Socket;
import java.net.URL;
import java.net.URLDecoder;
import java.security.NoSuchAlgorithmException;
import java.util.HashMap;
import java.util.Map;

import javax.net.SocketFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocket;

import de.wellenvogel.avnav.appapi.ExtendedWebResourceResponse;
import de.wellenvogel.avnav.appapi.INavRequestHandler;
import de.wellenvogel.avnav.appapi.PostVars;
import de.wellenvogel.avnav.appapi.RequestHandler;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;

/*
# Copyright (c) 2022,2026 Andreas Vogel andreas@wellenvogel.net

#  Permission is hereby granted, free of charge, to any person obtaining a
#  copy of this software and associated documentation files (the "Software"),
#  to deal in the Software without restriction, including without limitation
#  the rights to use, copy, modify, merge, publish, distribute, sublicense,
#  and/or sell copies of the Software, and to permit persons to whom the
#  Software is furnished to do so, subject to the following conditions:
#
#  The above copyright notice and this permission notice shall be included
#  in all copies or substantial portions of the Software.
#
#  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
#  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
#  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
#  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
#  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
#  DEALINGS IN THE SOFTWARE.
*/
public class Proxy extends Worker implements INavRequestHandler {
    HttpParams params;
    BasicHttpProcessor httpproc;
    protected Proxy(String typeName, GpsService ctx) {
        super(typeName, ctx);
        parameterDescriptions.addParams(ENABLED_PARAMETER);
        status.canEdit=true;
        params = new BasicHttpParams();
        HttpProtocolParams.setVersion(params, HttpVersion.HTTP_1_1);
        HttpProtocolParams.setContentCharset(params, "UTF-8");
        HttpProtocolParams.setUserAgent(params, "HttpComponents/1.1");
        HttpProtocolParams.setUseExpectContinue(params, true);
        httpproc = new BasicHttpProcessor();
        // Required protocol interceptors
        httpproc.addInterceptor(new RequestContent());
        httpproc.addInterceptor(new RequestTargetHost());
        // Recommended protocol interceptors
        httpproc.addInterceptor(new RequestConnControl());
        httpproc.addInterceptor(new RequestUserAgent());
        httpproc.addInterceptor(new RequestExpectContinue());
    }


    @Override
    public ExtendedWebResourceResponse handleDownload(String name, Uri uri) throws Exception {
        throw new InvalidCommandException("download not available for proxy");
    }

    @Override
    public boolean handleUpload(PostVars postData, String name, boolean ignoreExisting, boolean completeName) throws Exception {
        throw new InvalidCommandException("upload not available for proxy");
    }

    @Override
    public JSONArray handleList(Uri uri, RequestHandler.ServerInfo serverInfo) throws Exception {
        throw new InvalidCommandException("list not available for proxy");
    }

    @Override
    public JSONObject handleInfo(String name, Uri uri, RequestHandler.ServerInfo serverInfo) throws Exception {
        throw new InvalidCommandException("info not available for proxy");
    }

    @Override
    public boolean handleDelete(String name, Uri uri) throws Exception {
        throw new InvalidCommandException("delete not available for proxy");
    }

    @Override
    public boolean handleRename(String oldName, String newName) throws Exception {
        throw new InvalidCommandException("rename not available for proxy");
    }

    @Override
    public JSONObject handleApiRequest(String command, Uri uri, PostVars postData, RequestHandler.ServerInfo serverInfo) throws Exception {
        throw new Exception("no api requests for proxy");
    }

    ExtendedWebResourceResponse handleProxy(String url,String method,Map<String,String> headers) throws IOException, HttpException, NoSuchAlgorithmException {
        HttpRequestExecutor httpexecutor = new HttpRequestExecutor();

        HttpContext context = new BasicHttpContext(null);
        URL parsed=new URL(url);

        DefaultHttpClientConnection conn = new DefaultHttpClientConnection();
        ConnectionReuseStrategy connStrategy = new DefaultConnectionReuseStrategy();
        context.setAttribute(ExecutionContext.HTTP_CONNECTION, conn);
        HttpHost host;
        if (!conn.isOpen()) {
            if (parsed.getProtocol().toLowerCase().equals("https")){
                SSLContext sslcontext = SSLContext.getDefault();
                SocketFactory sf = sslcontext.getSocketFactory();
                int port=parsed.getPort();
                if (port < 0) port=443;
                host=new HttpHost(parsed.getHost(),port);
                SSLSocket socket = (SSLSocket) sf.createSocket(parsed.getHost(), port);
                conn.bind(socket, params);
            }
            else {
                int port=parsed.getPort();
                if (port < 0) port=80;
                host=new HttpHost(parsed.getHost(),port);
                Socket socket = new Socket(parsed.getHost(), port);
                conn.bind(socket, params);
            }
            context.setAttribute(ExecutionContext.HTTP_TARGET_HOST, host);
        }
        BasicHttpRequest request = new BasicHttpRequest(method,
                AvnUtil.encodeUrlPath(parsed.getPath())+
                        "?"+parsed.getQuery());
        request.setParams(params);
        for (String k:headers.keySet()) {
            if (k.toLowerCase().equals("host")) continue;
            Header h=new BasicHeader(k,headers.get(k));
            request.setHeader(h);
        }
        httpexecutor.preProcess(request, httpproc, context);
        HttpResponse response = httpexecutor.execute(request, conn, context);
        response.setParams(params);
        httpexecutor.postProcess(response, httpproc, context);
        int status=response.getStatusLine().getStatusCode();
        if ( status != 200 && status != 304){
            return new ExtendedWebResourceResponse(status,response.getStatusLine().getReasonPhrase());
        }
        HttpEntity entity=response.getEntity();
        if (entity == null){
            return new ExtendedWebResourceResponse(500,"empty response");
        }
        Header ct=entity.getContentType();
        Header ce=entity.getContentEncoding();
        long l=entity.getContentLength();
        if (l == 0) {
            l=-1;
        }
        ExtendedWebResourceResponse rt=new ExtendedWebResourceResponse(l,
                (ct != null)?ct.getValue():"application/octet-string",
                (ce != null)?ce.getValue():"",
                entity.getContent());
        for (Header h: response.getAllHeaders()){
            String n=h.getName().toLowerCase();
            //if (n.equals("content-length")) continue;
            //if (n.equals("content-type")) continue;
            rt.setHeader(h.getName(),h.getValue());
        }
        rt.setProxy(true);
        return rt;
    }

    @Override
    public ExtendedWebResourceResponse handleDirectRequest(Uri uri, RequestHandler handler, String method, Map<String, String> headers) throws Exception {
        if (!isEnabled()) throw new Exception("proxy disabled");
        AvnLog.i("proxy request "+uri);
        String path = uri.getPath();
        if (path == null) return null;
        if (path.startsWith("/")) path = path.substring(1);
        if (!path.startsWith(getPrefix())) return null;
        path = path.substring((getPrefix().length() + 1));
        path= URLDecoder.decode(path, "UTF-8");
        return handleProxy(path,method,headers);
    }

    @Override
    public String getPrefix() {
        return "proxy";
    }

    @Override
    public String getType() {
        return status.typeName;
    }

    @Override
    protected void run(int startSequence) throws JSONException, IOException {
        while (! shouldStop(startSequence)){
            sleep(30000);
        }
    }
}
