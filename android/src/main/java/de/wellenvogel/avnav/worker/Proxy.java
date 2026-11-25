package de.wellenvogel.avnav.worker;

import android.net.Uri;
import android.os.Build;
import android.util.Base64;

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

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.Socket;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URL;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.NoSuchAlgorithmException;
import java.util.HashMap;
import java.util.Map;

import javax.net.SocketFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManager;

import de.wellenvogel.avnav.appapi.ExtendedWebResourceResponse;
import de.wellenvogel.avnav.appapi.INavRequestHandler;
import de.wellenvogel.avnav.appapi.PostVars;
import de.wellenvogel.avnav.appapi.RequestHandler;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.util.DownloadManager;
import de.wellenvogel.avnav.util.IgnoreExpiredTrustmanager;

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

    ExtendedWebResourceResponse handleProxy(String url,String method,Map<String,String> headers,
                                            boolean skipTimeCheck,int timeout) throws IOException, HttpException, NoSuchAlgorithmException, URISyntaxException {
        URL parsed=new URL(url);
        HttpResponse response= DownloadManager.clientRequest(parsed,method,headers,skipTimeCheck,timeout);
        int status=response.getStatusLine().getStatusCode();
        if ( status < 200 || status > 399){
            return new ExtendedWebResourceResponse(status,response.getStatusLine().getReasonPhrase());
        }
        HttpEntity entity=response.getEntity();
        Header ct=null;
        Header ce=null;
        long l=-1;
        if (entity != null){
            ct = entity.getContentType();
            ce = entity.getContentEncoding();
            l = entity.getContentLength();
            if (l == 0) {
                l = -1;
            }
        }
        ExtendedWebResourceResponse rt=new ExtendedWebResourceResponse(l,
                (ct != null)?ct.getValue():"application/octet-string",
                (ce != null)?ce.getValue():"",
                (entity != null)?entity.getContent():new ByteArrayInputStream(new byte[0]));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            String reason=response.getStatusLine().getReasonPhrase();
            if (reason.trim().isEmpty()){
                rt.setStatusCodeAndReasonPhrase(status,"OK");
            }
            else {
                rt.setStatusCodeAndReasonPhrase(status, response.getStatusLine().getReasonPhrase());
            }
        }
        for (Header h: response.getAllHeaders()){
            rt.setHeader(h.getName(),h.getValue());
        }
        rt.setProxy(true);
        return rt;
    }

    public static String decodeUrlFromPath(String encoded) {
        // Base64.URL_SAFE handles '-' and '_' and tolerates missing '=' padding
        byte[] decodedBytes = Base64.decode(encoded, Base64.URL_SAFE);
        return new String(decodedBytes, StandardCharsets.UTF_8);
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
        path= decodeUrlFromPath(path);
        HashMap<String,String> existingHeaders=new HashMap<>();
        for (String k:headers.keySet()){
            existingHeaders.put(k.toLowerCase(),k);
        }
        boolean skipTimeCheck=false;
        int timeout=30000;
        for (String s: uri.getQueryParameterNames()) {
            String sk=s.toLowerCase();
            if (! sk.startsWith("h:")) {
                if ("a:notime".equals(sk)) {
                    skipTimeCheck=true;
                }
                if ("a:timeout".equals(sk)) {
                    try {
                        timeout=Integer.parseInt(uri.getQueryParameter(s))*1000;
                    } catch (Throwable e) {
                        AvnLog.e("invalid timeout "+uri.getQueryParameter(s));
                    }
                }
                continue;
            }
            sk=sk.substring(2);
            String v=uri.getQueryParameter(s);
            if (v != null){
                //ensure to overwrite existing headers
                String key=existingHeaders.get(sk);
                if (key == null) key=sk;
                headers.put(key, v);
            }
            headers.remove("host");
        }
        return handleProxy(path,method,headers,skipTimeCheck,timeout);
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
