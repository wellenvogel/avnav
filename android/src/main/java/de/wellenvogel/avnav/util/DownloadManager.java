package de.wellenvogel.avnav.util;

import org.apache.http.Header;
import org.apache.http.HttpEntity;
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

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.Socket;
import java.net.SocketException;
import java.net.URISyntaxException;
import java.net.URL;
import java.security.NoSuchAlgorithmException;
import java.util.Collections;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

import javax.net.ssl.SSLContext;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLHandshakeException;
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
    /** Immutable snapshot of the current download. Unknown totals and percentages are null. */
    public static final class Status {
        public final int id;
        public final Object info;
        public final Long totalBytes;
        public final long fetchedBytes;
        public final Double percent;
        public final String error;
        public final boolean done;
        public final String phase;

        private Status(Job job) {
            id = job.id;
            info = job.info;
            totalBytes = job.totalBytes;
            fetchedBytes = job.fetchedBytes;
            percent = job.percent;
            error = job.error;
            done = job.done;
            phase = job.phase;
        }
    }

    /** Called on the download thread, including after transfer failures. */
    public interface DoneCallback {
        void onDone(Status status, AtomicBoolean cancelled) throws Exception;
    }

    private static final int TIMEOUT = 30000;
    private static final int MAX_REDIRECTS = 10;
    private int nextId = 1;
    private Job current;

    private final class Job implements Runnable {
        final int id;
        final URL url;
        final File filename;
        final String method;
        final Map<String, String> headers;
        final Object info;
        final Long maxBytes;
        final DoneCallback callback;
        final boolean skipTimeCheck;
        final AtomicBoolean cancelled = new AtomicBoolean();
        final Thread thread;
        Socket socket;
        Long totalBytes = 0L;
        long fetchedBytes;
        Double percent = 0.0;
        String error;
        boolean done;
        String phase = "initialized";

        Job(int id, URL url, File filename, String method, Map<String, String> headers,
            Object info, Long maxBytes, DoneCallback callback, boolean skipTimeCheck) {
            this.id = id;
            this.url = url;
            this.filename = filename;
            this.method = method.toUpperCase(Locale.ROOT);
            this.headers = headers == null ? Collections.emptyMap() : new HashMap<>(headers);
            this.info = info;
            this.maxBytes = maxBytes;
            this.callback = callback;
            this.skipTimeCheck = skipTimeCheck;
            this.thread = new Thread(this, "DownloadManager-" + id);
            this.thread.setDaemon(true);
        }

        void setSocket(Socket next) {
            synchronized (DownloadManager.this) {
                socket = next;
                if (cancelled.get()) closeSocket(next);
            }
        }

        void checkCancelled() throws IOException {
            if (cancelled.get()) throw new IOException("download cancelled");
        }

        void download() throws Exception {
            URL target = url;
            String requestMethod = method;
            Map<String, String> requestHeaders = headers;
            for (int redirects = 0; ; redirects++) {
                checkCancelled();
                HttpResponse response;
                try {
                    response = clientRequest(target, requestMethod, requestHeaders, skipTimeCheck,
                            TIMEOUT, this::setSocket);
                    checkCancelled();
                    int code = response.getStatusLine().getStatusCode();
                    if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                        Header location = response.getFirstHeader("Location");
                        if (location == null) throw new IOException("redirect without Location");
                        if (redirects >= MAX_REDIRECTS) throw new IOException("too many redirects");
                        URL next = new URL(target, location.getValue());
                        if (!"http".equalsIgnoreCase(next.getProtocol()) &&
                                !"https".equalsIgnoreCase(next.getProtocol())) {
                            throw new IOException("unsupported redirect protocol: " + next.getProtocol());
                        }
                        if (!target.getProtocol().equalsIgnoreCase(next.getProtocol()) ||
                                !target.getHost().equalsIgnoreCase(next.getHost()) ||
                                target.getPort() != next.getPort()) {
                            requestHeaders = new HashMap<>(requestHeaders);
                            final Map<String, String> filtered = requestHeaders;
                            for (String key : new HashMap<>(filtered).keySet()) {
                                if (key.equalsIgnoreCase("Authorization") || key.equalsIgnoreCase("Cookie") ||
                                        key.equalsIgnoreCase("Host")) filtered.remove(key);
                            }
                        }
                        if (code == 303 && !requestMethod.equals("HEAD") ||
                                (code == 301 || code == 302) && requestMethod.equals("POST")) {
                            requestMethod = "GET";
                        }
                        target = next;
                        continue;
                    }
                    if (code < 200 || code >= 300) {
                        throw new IOException("HTTP " + code + ": " + response.getStatusLine().getReasonPhrase());
                    }
                    HttpEntity entity = response.getEntity();
                    long length = entity == null ? 0 : entity.getContentLength();
                    synchronized (DownloadManager.this) {
                        totalBytes = length > 0 ? length : null;
                        percent = length > 0 ? 0.0 : null;
                    }
                    try (InputStream input = entity == null ? null : entity.getContent();
                         FileOutputStream output = new FileOutputStream(filename)) {
                        byte[] buffer = new byte[8192];
                        long fetched = 0;
                        int count;
                        while (input != null && (count = input.read(buffer)) != -1) {
                            checkCancelled();
                            output.write(buffer, 0, count);
                            fetched += count;
                            if (maxBytes != null && fetched > maxBytes) {
                                throw new IOException("download " + url + " exceeds max " + maxBytes);
                            }
                            synchronized (DownloadManager.this) {
                                fetchedBytes = fetched;
                                percent = totalBytes == null ? null :
                                        Math.min(100.0, fetched * 100.0 / totalBytes);
                            }
                        }
                        checkCancelled();
                        if (length > 0 && fetched != length) {
                            throw new IOException("incomplete download: expected " + length + " bytes, got " + fetched);
                        }
                    }
                    return;
                } finally {
                    synchronized (DownloadManager.this) {
                        closeSocket(socket);
                        socket = null;
                    }
                }
            }
        }

        @Override
        public void run() {
            synchronized (DownloadManager.this) {
                phase = "downloading";
            }
            try {
                download();
            } catch (Exception e) {
                synchronized (DownloadManager.this) {
                    error = e.getMessage() == null ? e.toString() : e.getMessage();
                }
                if (filename.isFile() && !filename.delete()) {
                    synchronized (DownloadManager.this) {
                        error += "; unable to delete " + filename;
                    }
                }
            }
            synchronized (DownloadManager.this) {
                phase = "postprocessing";
            }
            if (callback != null) {
                try {
                    callback.onDone(snapshot(this), cancelled);
                } catch (Exception e) {
                    synchronized (DownloadManager.this) {
                        error = e.getMessage() == null ? e.toString() : e.getMessage();
                    }
                }
            }
            synchronized (DownloadManager.this) {
                phase = "done";
                done = true;
            }
        }
    }

    private synchronized Status snapshot(Job job) {
        return new Status(job);
    }

    /**
     * Starts one background download. The callback runs before the job is marked done and may
     * check the cancellation flag while postprocessing.
     */
    public synchronized int start(URL url, File filename, String method, Map<String, String> headers,
                                  Object info, Long maxBytes, DoneCallback callback, boolean skipTimeCheck) {
        if (current != null && current.thread.isAlive()) {
            throw new IllegalStateException("unable to start download for " + url + ": Already running");
        }
        if (url == null || filename == null || method == null) {
            throw new IllegalArgumentException("url, filename and method are required");
        }
        if (!"http".equalsIgnoreCase(url.getProtocol()) && !"https".equalsIgnoreCase(url.getProtocol())) {
            throw new IllegalArgumentException("unsupported protocol: " + url.getProtocol());
        }
        current = new Job(nextId++, url, filename, method, headers, info, maxBytes, callback, skipTimeCheck);
        current.thread.start();
        return current.id;
    }

    public int start(URL url, File filename) {
        return start(url, filename, "GET", null, null, null, null, false);
    }

    public synchronized Status status() {
        return current == null ? null : new Status(current);
    }

    public synchronized Status status(int id) {
        return current == null || current.id != id ? null : new Status(current);
    }

    public synchronized boolean isRunning() {
        return current != null && current.thread.isAlive();
    }

    /** Signals cancellation and closes the active socket, if one has been created. */
    public synchronized boolean cancel(int id) {
        if (current == null || current.id != id) return false;
        current.cancelled.set(true);
        closeSocket(current.socket);
        return true;
    }

    private static void closeSocket(Socket socket) {
        if (socket != null) {
            try {
                socket.close();
            } catch (IOException e) {
                AvnLog.e("unable to close download socket", e);
            }
        }
    }

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
            if (port < 0) port = url.getProtocol().equalsIgnoreCase("https") ? 443 : 80;
            host=new HttpHost(url.getHost(),port);
            Socket socket = new Socket();
            socket.setSoTimeout(timeout);
            if (socketCallback != null) {
                socketCallback.onSocketCreated(socket);
            }
            try {
                socket.connect(new java.net.InetSocketAddress(url.getHost(), port), timeout);
                if (url.getProtocol().toLowerCase().equals("https")){
                    SSLContext sslcontext = SSLContext.getInstance(IgnoreExpiredTrustmanager.getSSlContextProtocol());
                    try {
                        TrustManager[] trustManagers = skipTimeCheck ?
                                IgnoreExpiredTrustmanager.getDefaultTrustManagers() : null;
                        sslcontext.init(null, trustManagers, null);
                    } catch (Exception e) {
                        throw new IOException("cannot create trustmanager", e);
                    }
                    SSLSocketFactory sf = sslcontext.getSocketFactory();
                    SSLSocket sslSocket = (SSLSocket) sf.createSocket(socket, url.getHost(), port, true);
                    IgnoreExpiredTrustmanager.ensureTls12Enabled(sslSocket);
                    sslSocket.startHandshake();
                    if (!HttpsURLConnection.getDefaultHostnameVerifier().verify(url.getHost(), sslSocket.getSession())) {
                        throw new SSLHandshakeException("hostname verification failed for " + url.getHost());
                    }
                    conn.bind(sslSocket, paramAndProc.params);
                }
                else {
                    conn.bind(socket, paramAndProc.params);
                }
                context.setAttribute(ExecutionContext.HTTP_TARGET_HOST, host);
            } catch (IOException | NoSuchAlgorithmException | RuntimeException e) {
                try {
                    socket.close();
                } catch (IOException closeError) {
                    e.addSuppressed(closeError);
                }
                throw e;
            }
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

    /*
    Security review notes (2026-11-18), issues not addressed here:

    - HttpsURLConnection.getDefaultHostnameVerifier() used for hostname verification is
      process-global, mutable state: other code in the app could call
      HttpsURLConnection.setDefaultHostnameVerifier(...) and silently weaken this check for
      every TLS connection made by the app, not just this class. A locally-owned
      HostnameVerifier instance would be more robust.

    - On a cross-origin or protocol-downgrading redirect, only the Authorization, Cookie and
      Host headers are stripped before following the redirect (see download()). Any other
      caller-supplied secret header (API keys, custom bearer tokens, ...) is still forwarded
      to the redirect target, which is chosen by the original server.

    - Neither the initial URL nor redirect targets are restricted to public hosts, so this
      manager can be used for SSRF against loopback/link-local/internal addresses if it is
      reachable with attacker-influenced URLs (e.g. via an HTTP API that exposes
      "download this URL"). This mirrors the parity Python implementation; restricting
      allowed hosts would need to be a conscious decision by the caller.

    - start() does not validate or sanitize the destination File: path traversal and
      symlink-attack protection for the "filename" parameter must be fully handled by the
      caller before invoking start().

    - Status.error contains raw exception messages, which can include local file paths.
      If a caller exposes job status through an unauthenticated API, this is a (low severity)
      information disclosure risk.

    - IgnoreExpiredTrustmanager.ensureTls12Enabled() only adds TLSv1.2 to the enabled
      protocol list if missing; it does not remove legacy protocols (SSLv3/TLSv1.0/1.1) that
      the platform may still enable by default on old API levels.
    */
}
