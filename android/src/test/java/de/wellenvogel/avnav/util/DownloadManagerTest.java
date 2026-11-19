package de.wellenvogel.avnav.util;

import org.apache.http.HttpResponse;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import java.io.File;
import java.io.FileInputStream;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.security.KeyStore;
import java.util.Collections;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLException;
import javax.net.ssl.SSLHandshakeException;

import static org.junit.Assert.*;

public class DownloadManagerTest {
    private TestServer server;
    private File directory;
    private URL base;

    @Before
    public void setUp() throws Exception {
        directory = Files.createTempDirectory(Paths.get("."), "download-manager-test-").toFile();
        server = new TestServer(null);
        base = new URL("http://127.0.0.1:" + server.port() + "/");
    }

    @After
    public void tearDown() throws Exception {
        try {
            if (server != null) server.close();
        } finally {
            if (directory != null) {
                File[] files = directory.listFiles();
                if (files != null) {
                    for (File file : files) assertTrue(file.delete());
                }
                assertTrue(directory.delete());
            }
        }
    }

    @FunctionalInterface
    private interface Handler {
        void handle(Map<String, String> headers, OutputStream output) throws Exception;
    }

    private static class TestServer implements AutoCloseable {
        private final ServerSocket listener;
        private final Thread thread;
        private final boolean tls;
        private final Map<String, Handler> handlers = new ConcurrentHashMap<>();
        private final AtomicReference<Throwable> failure = new AtomicReference<>();
        private volatile Socket current;

        TestServer(SSLContext context) throws IOException {
            tls = context != null;
            listener = context == null ? new ServerSocket() :
                    context.getServerSocketFactory().createServerSocket();
            listener.bind(new InetSocketAddress("127.0.0.1", 0));
            thread = new Thread(this::serve, "download-test-server");
            thread.setDaemon(true);
            thread.start();
        }

        int port() {
            return listener.getLocalPort();
        }

        void on(String path, Handler handler) {
            handlers.put(path, handler);
        }

        private void serve() {
            while (!listener.isClosed()) {
                boolean requestReceived = false;
                try (Socket socket = listener.accept()) {
                    current = socket;
                    socket.setSoTimeout(5000);
                    BufferedReader input = new BufferedReader(new InputStreamReader(
                            socket.getInputStream(), StandardCharsets.US_ASCII));
                    String request = input.readLine();
                    if (request == null) continue;
                    requestReceived = true;
                    String[] parts = request.split(" ");
                    if (parts.length < 2) throw new IOException("invalid request: " + request);
                    Map<String, String> headers = new HashMap<>();
                    String line;
                    while ((line = input.readLine()) != null && !line.isEmpty()) {
                        int colon = line.indexOf(':');
                        if (colon < 0) throw new IOException("invalid header: " + line);
                        headers.put(line.substring(0, colon).toLowerCase(Locale.ROOT),
                                line.substring(colon + 1).trim());
                    }
                    Handler handler = handlers.get(new URI(parts[1]).getRawPath());
                    if (handler == null) throw new IOException("unexpected path: " + parts[1]);
                    handler.handle(headers, socket.getOutputStream());
                } catch (SSLException e) {
                    if ((!tls || requestReceived) && !listener.isClosed()) {
                        failure.compareAndSet(null, e);
                    }
                } catch (Exception | AssertionError e) {
                    if (!listener.isClosed()) failure.compareAndSet(null, e);
                } finally {
                    current = null;
                }
            }
        }

        @Override
        public void close() throws Exception {
            listener.close();
            Socket socket = current;
            if (socket != null) socket.close();
            thread.join(6000);
            assertFalse("server did not stop", thread.isAlive());
            if (failure.get() != null) throw new AssertionError("test server failed", failure.get());
        }
    }

    private static void write(OutputStream output, String text) throws IOException {
        output.write(text.getBytes(StandardCharsets.US_ASCII));
        output.flush();
    }

    private DownloadManager.Status waitFor(DownloadManager manager) throws Exception {
        long deadline = System.currentTimeMillis() + 5000;
        while (manager.isRunning() && System.currentTimeMillis() < deadline) Thread.sleep(10);
        assertFalse("download did not finish", manager.isRunning());
        return manager.status();
    }

    @Test
    public void socketCallbackRunsBeforeConnectAndCanCancel() throws Exception {
        AtomicReference<Boolean> connected = new AtomicReference<>();
        try {
            DownloadManager.clientRequest(base, "GET", Collections.emptyMap(), false, 1000, socket -> {
                connected.set(socket.isConnected());
                try {
                    socket.close();
                } catch (IOException e) {
                    throw new AssertionError(e);
                }
            });
            fail("closed socket must not connect");
        } catch (IOException expected) {
            assertEquals(Boolean.FALSE, connected.get());
        }
    }

    @Test
    public void verifiesHostnameAfterHandshakeBeforeSendingRequest() throws Exception {
        File storeFile = new File(directory, "test-keystore.p12");
        String password = "test-password";
        Process process = new ProcessBuilder(
                new File(System.getProperty("java.home"), "bin/keytool").getPath(),
                "-genkeypair", "-alias", "server", "-keyalg", "RSA", "-keysize", "2048",
                "-dname", "CN=localhost", "-ext", "SAN=dns:localhost", "-validity", "1",
                "-storetype", "PKCS12", "-keystore", storeFile.getPath(),
                "-storepass", password, "-keypass", password, "-noprompt")
                .redirectErrorStream(true).start();
        try (java.io.InputStream output = process.getInputStream()) {
            byte[] buffer = new byte[1024];
            while (output.read(buffer) != -1) { }
        }
        assertEquals(0, process.waitFor());

        KeyStore store = KeyStore.getInstance("PKCS12");
        try (FileInputStream input = new FileInputStream(storeFile)) {
            store.load(input, password.toCharArray());
        }
        KeyManagerFactory keys = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
        keys.init(store, password.toCharArray());
        SSLContext serverContext = SSLContext.getInstance("TLS");
        serverContext.init(keys.getKeyManagers(), null, null);
        TestServer tlsServer = new TestServer(serverContext);
        AtomicInteger received = new AtomicInteger();
        tlsServer.on("/", (headers, output) -> {
            received.incrementAndGet();
            write(output, "HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
        });
        String previousStore = System.getProperty("javax.net.ssl.trustStore");
        String previousPassword = System.getProperty("javax.net.ssl.trustStorePassword");
        String previousType = System.getProperty("javax.net.ssl.trustStoreType");
        HostnameVerifier previousVerifier = HttpsURLConnection.getDefaultHostnameVerifier();
        try {
            System.setProperty("javax.net.ssl.trustStore", storeFile.getPath());
            System.setProperty("javax.net.ssl.trustStorePassword", password);
            System.setProperty("javax.net.ssl.trustStoreType", "PKCS12");
            AtomicReference<String> verifiedHost = new AtomicReference<>();
            HttpsURLConnection.setDefaultHostnameVerifier((host, session) -> {
                verifiedHost.set(host);
                try {
                    return "localhost".equals(host) &&
                            store.getCertificate("server").equals(session.getPeerCertificates()[0]);
                } catch (Exception e) {
                    throw new AssertionError(e);
                }
            });
            int port = tlsServer.port();
            int expectedRequests = 0;
            for (boolean skipTimeCheck : new boolean[]{false, true}) {
                try {
                    DownloadManager.clientRequest(new URL("https://127.0.0.1:" + port + "/"),
                            "GET", Collections.emptyMap(), skipTimeCheck, 5000);
                    fail("mismatched hostname must fail");
                } catch (SSLHandshakeException expected) {
                    assertEquals("127.0.0.1", verifiedHost.get());
                    assertEquals(expectedRequests, received.get());
                }
                AtomicReference<java.net.Socket> socket = new AtomicReference<>();
                HttpResponse response = DownloadManager.clientRequest(
                        new URL("https://localhost:" + port + "/"), "GET", Collections.emptyMap(),
                        skipTimeCheck, 5000, socket::set);
                assertEquals(200, response.getStatusLine().getStatusCode());
                assertEquals("localhost", verifiedHost.get());
                assertEquals(++expectedRequests, received.get());
                socket.get().close();
            }
        } finally {
            HttpsURLConnection.setDefaultHostnameVerifier(previousVerifier);
            restoreProperty("javax.net.ssl.trustStore", previousStore);
            restoreProperty("javax.net.ssl.trustStorePassword", previousPassword);
            restoreProperty("javax.net.ssl.trustStoreType", previousType);
            tlsServer.close();
        }
    }

    private static void restoreProperty(String key, String value) {
        if (value == null) System.clearProperty(key);
        else System.setProperty(key, value);
    }

    @Test
    public void downloadsRedirectAndReportsCallback() throws Exception {
        server.on("/redirect", (headers, output) -> {
            write(output, "HTTP/1.1 302 Found\r\nLocation: /data\r\n" +
                    "Content-Length: 0\r\nConnection: close\r\n\r\n");
        });
        server.on("/data", (headers, output) -> {
            assertEquals("custom", headers.get("x-test"));
            write(output, "HTTP/1.1 200 OK\r\nContent-Length: 5\r\n" +
                    "Connection: close\r\n\r\nhello");
        });
        DownloadManager manager = new DownloadManager();
        File target = new File(directory, "download");
        AtomicReference<DownloadManager.Status> callback = new AtomicReference<>();
        int id = manager.start(new URL(base, "redirect"), target, "GET",
                Collections.singletonMap("X-Test", "custom"), "info", null,
                (status, cancelled) -> callback.set(status), false);
        DownloadManager.Status status = waitFor(manager);
        assertEquals(id, status.id);
        assertEquals("info", status.info);
        assertEquals(Long.valueOf(5), status.totalBytes);
        assertEquals(5, status.fetchedBytes);
        assertEquals(100.0, status.percent, 0.001);
        assertNull(status.error);
        assertTrue(status.done);
        assertEquals("done", status.phase);
        assertEquals("hello", new String(Files.readAllBytes(target.toPath()), StandardCharsets.UTF_8));
        assertEquals("postprocessing", callback.get().phase);
        assertFalse(callback.get().done);
        assertNull(manager.status(id + 1));
    }

    @Test
    public void unknownLengthAndMaximumSize() throws Exception {
        server.on("/stream", (headers, output) -> {
            write(output, "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n" +
                    "Connection: close\r\n\r\n5\r\nhello\r\n0\r\n\r\n");
        });
        DownloadManager manager = new DownloadManager();
        File target = new File(directory, "download");
        URL url = new URL(base, "stream");
        manager.start(url, target);
        DownloadManager.Status status = waitFor(manager);
        assertNull(status.error);
        assertNull(status.totalBytes);
        assertNull(status.percent);
        assertEquals(5, status.fetchedBytes);
        JSONObject json = status.toJson();
        assertEquals(status.id, json.getInt("id"));
        assertEquals(5, json.getLong("fetchedBytes"));
        assertTrue(json.has("totalBytes") && json.isNull("totalBytes"));
        assertTrue(json.has("percent") && json.isNull("percent"));
        assertTrue(json.has("info") && json.isNull("info"));
        assertTrue(json.has("error") && json.isNull("error"));
        assertTrue(json.getBoolean("done"));
        assertEquals("done", json.getString("phase"));
        manager.start(url, target, "GET", null, null, 2L, null, false);
        status = waitFor(manager);
        assertTrue(status.error.contains("exceeds max 2"));
        assertFalse(target.exists());
    }

    @Test
    public void errorsReachCallbackAndCallbackErrorsReplaceThem() throws Exception {
        server.on("/missing", (headers, output) -> {
            write(output, "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n" +
                    "Connection: close\r\n\r\n");
        });
        DownloadManager manager = new DownloadManager();
        File target = new File(directory, "download");
        AtomicReference<DownloadManager.Status> callback = new AtomicReference<>();
        manager.start(new URL(base, "missing"), target, "GET", null, null, null,
                (status, cancelled) -> {
                    callback.set(status);
                    throw new Exception("callback failed");
                }, false);
        DownloadManager.Status status = waitFor(manager);
        assertTrue(callback.get().error.contains("404"));
        assertEquals("callback failed", status.error);
        assertTrue(status.done);
        assertFalse(target.exists());
    }

    @Test
    public void jobProgressAndCallbackDoNotRequireManagerLock() throws Exception {
        server.on("/data", (headers, output) ->
                write(output, "HTTP/1.1 200 OK\r\nContent-Length: 5\r\n" +
                        "Connection: close\r\n\r\nhello"));
        DownloadManager manager = new DownloadManager();
        File target = new File(directory, "download");
        CountDownLatch callbackStarted = new CountDownLatch(1);
        CountDownLatch releaseCallback = new CountDownLatch(1);
        AtomicReference<DownloadManager.Status> callbackStatus = new AtomicReference<>();
        AtomicReference<AtomicBoolean> cancellation = new AtomicReference<>();
        try {
            synchronized (manager) {
                int id = manager.start(new URL(base, "data"), target, "GET", null, null, null,
                        (status, cancelled) -> {
                            callbackStatus.set(status);
                            cancellation.set(cancelled);
                            callbackStarted.countDown();
                            if (!releaseCallback.await(5, TimeUnit.SECONDS)) {
                                throw new IOException("timed out waiting for callback release");
                            }
                        }, false);
                assertTrue("job was blocked by manager lock", callbackStarted.await(5, TimeUnit.SECONDS));
                DownloadManager.Status status = manager.status(id);
                assertEquals("postprocessing", status.phase);
                assertEquals(5, status.fetchedBytes);
                assertFalse(status.done);
                assertTrue(manager.cancel(id));
                assertTrue(cancellation.get().get());
            }
        } finally {
            releaseCallback.countDown();
        }
        DownloadManager.Status finished = waitFor(manager);
        assertTrue(finished.done);
        assertNull(finished.error);
        assertEquals("done", finished.phase);
        assertEquals("postprocessing", callbackStatus.get().phase);
        assertFalse(callbackStatus.get().done);
    }

    @Test
    public void cancellationAndSingleJob() throws Exception {
        CountDownLatch connected = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        server.on("/slow", (headers, output) -> {
            write(output, "HTTP/1.1 200 OK\r\nContent-Length: 100\r\n" +
                    "Connection: close\r\n\r\n");
            output.write(1);
            output.flush();
            connected.countDown();
            try {
                release.await(5, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        });
        DownloadManager manager = new DownloadManager();
        File target = new File(directory, "download");
        int id = manager.start(new URL(base, "slow"), target);
        try {
            assertTrue(connected.await(5, TimeUnit.SECONDS));
            try {
                manager.start(new URL(base, "slow"), target);
                fail("second download must be rejected");
            } catch (IllegalStateException expected) {
                assertTrue(expected.getMessage().contains("Already running"));
            }
            assertFalse(manager.cancel(id + 1));
            assertTrue(manager.cancel(id));
            DownloadManager.Status status = waitFor(manager);
            assertNotNull(status.error);
            assertFalse(target.exists());
        } finally {
            release.countDown();
        }
    }
}
