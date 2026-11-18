package de.wellenvogel.avnav.util;

import org.apache.http.Header;
import org.apache.http.HttpException;
import org.apache.http.HttpHost;
import org.apache.http.HttpResponse;
import org.apache.http.HttpVersion;
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

import java.io.IOException;
import java.net.Socket;
import java.net.SocketException;
import java.net.URISyntaxException;
import java.net.URL;
import java.security.NoSuchAlgorithmException;
import java.util.Map;

import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManager;

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
public class DownloadManager {
    static class ParamAndProc{
        public HttpParams params=new BasicHttpParams();
        public BasicHttpProcessor httpproc=new BasicHttpProcessor();
        public ParamAndProc(){
            HttpProtocolParams.setVersion(params, HttpVersion.HTTP_1_1);
            HttpProtocolParams.setContentCharset(params, "UTF-8");
            HttpProtocolParams.setUserAgent(params, "HttpComponents/1.1");
            HttpProtocolParams.setUseExpectContinue(params, true);
            httpproc.addInterceptor(new RequestContent());
            httpproc.addInterceptor(new RequestTargetHost());
            // Recommended protocol interceptors
            httpproc.addInterceptor(new RequestConnControl());
            httpproc.addInterceptor(new RequestUserAgent());
            httpproc.addInterceptor(new RequestExpectContinue());
        }
    }
    public static interface SocketCallback{
        void onSocketCreated(Socket socket);
    }
    public static ParamAndProc paramAndProc=new ParamAndProc();
    public static HttpResponse clientRequest(URL url, String method, Map<String,String> headers,
                                             boolean skipTimeCheck, int timeout) throws IOException, URISyntaxException, HttpException, NoSuchAlgorithmException {
        return clientRequest(url,method,headers,skipTimeCheck,timeout,null);
    }
    public static HttpResponse clientRequest(URL url, String method, Map<String,String> headers,
                                      boolean skipTimeCheck, int timeout, SocketCallback socketCallback) throws IOException, URISyntaxException, HttpException, NoSuchAlgorithmException {
        HttpRequestExecutor httpexecutor = new HttpRequestExecutor();

        HttpContext context = new BasicHttpContext(null);

        DefaultHttpClientConnection conn = new DefaultHttpClientConnection();
        context.setAttribute(ExecutionContext.HTTP_CONNECTION, conn);
        HttpHost host;
        if (!conn.isOpen()) {
            int port=url.getPort();
            if (port < 0) port=443;
            host=new HttpHost(url.getHost(),port);
            Socket socket = new Socket();
            socket.setSoTimeout(timeout);
            socket.connect(new java.net.InetSocketAddress(url.getHost(), port), timeout);
            if (socketCallback != null) {
                socketCallback.onSocketCreated(socket);
            }
            if (url.getProtocol().toLowerCase().equals("https")){
                SSLContext sslcontext = SSLContext.getInstance(IgnoreExpiredTrustmanager.getSSlContextProtocol());
                if (skipTimeCheck) {
                    try {
                        TrustManager[] trustManagers=IgnoreExpiredTrustmanager.getDefaultTrustManagers();
                        sslcontext.init(null, trustManagers, null);
                    } catch (Exception e) {
                        AvnLog.e("cannot create trustmanager",e);
                    }
                }
                SSLSocketFactory sf = sslcontext.getSocketFactory();
                SSLSocket sslSocket = (SSLSocket) sf.createSocket(socket, url.getHost(), port, true);
                IgnoreExpiredTrustmanager.ensureTls12Enabled(sslSocket);
                conn.bind(sslSocket, paramAndProc.params);
            }
            else {
                conn.bind(socket, paramAndProc.params);
            }
            context.setAttribute(ExecutionContext.HTTP_TARGET_HOST, host);
        }
        BasicHttpRequest request = new BasicHttpRequest(method,
                AvnUtil.encodeUrlForClient(url));
        request.setParams(paramAndProc.params);
        for (String k:headers.keySet()) {
            Header h=new BasicHeader(k,headers.get(k));
            request.setHeader(h);
        }
        httpexecutor.preProcess(request, paramAndProc.httpproc, context);
        HttpResponse response = httpexecutor.execute(request, conn, context);
        response.setParams(paramAndProc.params);
        httpexecutor.postProcess(response, paramAndProc.httpproc, context);
        return response;
    }


}
