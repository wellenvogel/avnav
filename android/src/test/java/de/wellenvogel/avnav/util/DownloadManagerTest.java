package de.wellenvogel.avnav.util;

import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpsConfigurator;
import com.sun.net.httpserver.HttpsServer;

import org.apache.http.HttpResponse;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.KeyStore;
import java.util.Collections;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLHandshakeException;

import static org.junit.Assert.*;

public class DownloadManagerTest {
    private HttpServer server;
    private File directory;
    private URL base;

    @Before
    public void setUp() throws Exception {
        directory = Files.createTempDirectory("download-manager-test").toFile();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.start();
        base = new URL("http://127.0.0.1:" + server.getAddress().getPort() + "/");
    }

    @After
    public void tearDown() {
        server.stop(0);
        File[] files = directory.listFiles();
        if (files != null) {
            for (File file : files) assertTrue(file.delete());
        }
        assertTrue(directory.delete());
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
        HttpsServer tlsServer = HttpsServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        tlsServer.setHttpsConfigurator(new HttpsConfigurator(serverContext));
        AtomicInteger received = new AtomicInteger();
        tlsServer.createContext("/", exchange -> {
            received.incrementAndGet();
            exchange.sendResponseHeaders(200, -1);
            exchange.close();
        });
        tlsServer.start();
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
            int port = tlsServer.getAddress().getPort();
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
            tlsServer.stop(0);
        }
    }

    private static void restoreProperty(String key, String value) {
        if (value == null) System.clearProperty(key);
        else System.setProperty(key, value);
    }

    @Test
    public void downloadsRedirectAndReportsCallback() throws Exception {
        server.createContext("/redirect", exchange -> {
            exchange.getResponseHeaders().add("Location", "/data");
            exchange.sendResponseHeaders(302, -1);
            exchange.close();
        });
        server.createContext("/data", exchange -> {
            assertEquals("custom", exchange.getRequestHeaders().getFirst("X-Test"));
            byte[] data = "hello".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, data.length);
            exchange.getResponseBody().write(data);
            exchange.close();
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
        server.createContext("/stream", exchange -> {
            exchange.sendResponseHeaders(200, 0);
            exchange.getResponseBody().write("hello".getBytes(StandardCharsets.UTF_8));
            exchange.close();
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
        manager.start(url, target, "GET", null, null, 2L, null, false);
        status = waitFor(manager);
        assertTrue(status.error.contains("exceeds max 2"));
        assertFalse(target.exists());
    }

    @Test
    public void errorsReachCallbackAndCallbackErrorsReplaceThem() throws Exception {
        server.createContext("/missing", exchange -> {
            exchange.sendResponseHeaders(404, -1);
            exchange.close();
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
    public void cancellationAndSingleJob() throws Exception {
        CountDownLatch connected = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        server.createContext("/slow", exchange -> {
            exchange.sendResponseHeaders(200, 100);
            exchange.getResponseBody().write(1);
            exchange.getResponseBody().flush();
            connected.countDown();
            try {
                release.await(5, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } finally {
                exchange.close();
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
