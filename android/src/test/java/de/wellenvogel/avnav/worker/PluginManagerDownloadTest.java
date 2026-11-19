package de.wellenvogel.avnav.worker;

import android.net.Uri;

import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import de.wellenvogel.avnav.appapi.PostVars;
import de.wellenvogel.avnav.appapi.RequestHandler;

import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class PluginManagerDownloadTest {
    private File workDir;
    private GpsService gpsService;
    private TestPluginManager manager;
    private TestServer server;

    @Before
    public void setUp() throws Exception {
        workDir = Files.createTempDirectory(new File(".").toPath(), "plugin-download-test-").toFile();
        gpsService = mock(GpsService.class);
        when(gpsService.findWorkersByType(ExternalPluginWorker.TYPENAME)).thenReturn(
                new java.util.ArrayList<IWorker>());
        manager = new TestPluginManager(gpsService, workDir);
    }

    @After
    public void tearDown() throws Exception {
        try {
            if (server != null) server.close();
        } finally {
            if (workDir != null) {
                deleteRecursively(workDir);
            }
        }
    }

    @Test
    public void externalDownloadInstallsPluginAndReportsStatus() throws Exception {
        byte[] archive = pluginArchive("sample", "content.txt", "installed");
        server = new TestServer((socket, request) -> writeResponse(socket.getOutputStream(), 200, archive));

        JSONObject started = manager.request("externalDownload", params(
                "name", "sample", "url", server.url()));
        assertEquals("OK", started.getString("status"));
        int id = started.getInt("id");

        JSONObject status = awaitStatus(id);
        assertEquals("OK", status.getString("status"));
        JSONObject data = status.getJSONObject("data");
        assertEquals(id, data.getInt("id"));
        assertEquals("sample", data.getString("info"));
        assertTrue(data.getBoolean("done"));
        assertEquals("done", data.getString("phase"));
        assertTrue(data.isNull("error"));
        assertEquals(archive.length, data.getLong("fetchedBytes"));
        assertEquals(100.0, data.getDouble("percent"), 0.001);
        assertEquals("installed", new String(Files.readAllBytes(
                new File(workDir, "sample/content.txt").toPath()), StandardCharsets.UTF_8));
        verify(gpsService).updateConfigSequence();
        assertNoTemporaryArchives();

        JSONObject withoutId = manager.request("downloadStatus", params());
        assertEquals("OK", withoutId.getString("status"));
        assertTrue(withoutId.getJSONObject("data").getBoolean("done"));
        JSONObject byId = manager.request("downloadStatus", params("id", Integer.toString(id)));
        assertEquals(id, byId.getJSONObject("data").getInt("id"));
    }

    @Test
    public void downloadStatusWithoutJobOrMatchingIdReturnsNoDownload() throws Exception {
        JSONObject noJob = manager.request("downloadStatus", params());
        assertEquals("OK", noJob.getString("status"));
        assertEquals("no download running", noJob.getString("info"));

        JSONObject unknownId = manager.request("downloadStatus", params("id", "9000"));
        assertEquals("OK", unknownId.getString("status"));
        assertEquals("no download running", unknownId.getString("info"));
    }

    @Test
    public void externalDownloadRejectsInvalidNameUrlAndExistingPlugin() throws Exception {
        server = new TestServer((socket, request) ->
                writeResponse(socket.getOutputStream(), 200, pluginArchive("sample", "new.txt", "new")));
        expectFailure(() -> manager.request("externalDownload",
                params("name", "../outside", "url", server.url())));
        expectFailure(() -> manager.request("externalDownload",
                params("name", "", "url", server.url())));
        expectFailure(() -> manager.request("externalDownload",
                params("name", "sample", "url", "file:///etc/passwd")));

        File existing = new File(workDir, "sample");
        assertTrue(existing.mkdir());
        assertTrue(new File(existing, "old.txt").createNewFile());
        expectFailure(() -> manager.request("externalDownload",
                params("name", "sample", "url", server.url())));

        JSONObject overwrite = manager.request("externalDownload", params(
                "name", "sample", "url", server.url(), "overwrite", "true"));
        assertTrue(awaitStatus(overwrite.getInt("id")).getJSONObject("data").isNull("error"));
        assertTrue(new File(existing, "old.txt").exists());
        assertEquals("new", new String(Files.readAllBytes(
                new File(existing, "new.txt").toPath()), StandardCharsets.UTF_8));
    }

    @Test
    public void cancelDownloadSignalsActiveRequestAndUnknownIdIsNotCancelled() throws Exception {
        CountDownLatch requestStarted = new CountDownLatch(1);
        CountDownLatch releaseResponse = new CountDownLatch(1);
        server = new TestServer((socket, request) -> {
            OutputStream output = socket.getOutputStream();
            output.write(("HTTP/1.1 200 OK\r\nContent-Length: 100\r\n" +
                    "Connection: close\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
            output.write(1);
            output.flush();
            requestStarted.countDown();
            releaseResponse.await(5, TimeUnit.SECONDS);
            try {
                output.write(new byte[99]);
                output.flush();
            } catch (IOException expectedAfterCancellation) {
                // Closing the client socket is the expected cancellation behavior.
            }
        });

        JSONObject started = manager.request("externalDownload", params(
                "name", "cancelled", "url", server.url()));
        int id = started.getInt("id");
        assertTrue(requestStarted.await(5, TimeUnit.SECONDS));

        JSONObject unknown = manager.request("cancelDownload", params("id", Integer.toString(id + 1)));
        assertFalse(unknown.getBoolean("cancelled"));
        JSONObject cancelled = manager.request("cancelDownload", params("id", Integer.toString(id)));
        assertTrue(cancelled.getBoolean("cancelled"));
        releaseResponse.countDown();

        JSONObject finalStatus = awaitStatus(id);
        assertTrue(finalStatus.getJSONObject("data").getBoolean("done"));
        assertFalse(finalStatus.getJSONObject("data").isNull("error"));
        assertFalse(new File(workDir, "cancelled").exists());
        assertNoTemporaryArchives();
    }

    @Test
    public void invalidArchiveFailureIsReportedByPostprocessingStatus() throws Exception {
        server = new TestServer((socket, request) ->
                writeResponse(socket.getOutputStream(), 200, "not a zip".getBytes(StandardCharsets.UTF_8)));
        int id = manager.request("externalDownload", params(
                "name", "broken", "url", server.url())).getInt("id");

        JSONObject status = awaitStatus(id);
        JSONObject data = status.getJSONObject("data");
        assertTrue(data.getBoolean("done"));
        assertFalse(data.isNull("error"));
        assertTrue(data.getString("error").contains("no files in zip"));
        assertFalse(new File(workDir, "broken").exists());
        assertNoTemporaryArchives();
    }

    @Test
    public void invalidZipEntryIsRejectedBeforeExtraction() throws Exception {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
            zip.putNextEntry(new ZipEntry("sample/good.txt"));
            zip.write("good".getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
            zip.putNextEntry(new ZipEntry("sample/../escape.txt"));
            zip.write("bad".getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
        }
        server = new TestServer((socket, request) -> writeResponse(socket.getOutputStream(), 200, bytes.toByteArray()));
        int id = manager.request("externalDownload", params("name", "sample", "url", server.url())).getInt("id");
        JSONObject data = awaitStatus(id).getJSONObject("data");
        assertFalse(data.isNull("error"));
        assertFalse(new File(workDir, "sample/good.txt").exists());
        assertFalse(new File(workDir, "escape.txt").exists());
        assertNoTemporaryArchives();
    }

    private void assertNoTemporaryArchives() {
        File[] archives = workDir.listFiles((dir, name) -> name.startsWith(PluginManager.UPLOAD_BASE));
        assertNotNull(archives);
        assertEquals(0, archives.length);
    }

    private JSONObject awaitStatus(int id) throws Exception {
        long deadline = System.currentTimeMillis() + 5000;
        JSONObject response;
        do {
            response = manager.request("downloadStatus", params("id", Integer.toString(id)));
            if (response.has("data") && response.getJSONObject("data").optBoolean("done")) return response;
            Thread.sleep(10);
        } while (System.currentTimeMillis() < deadline);
        fail("download " + id + " did not finish: " + response);
        return null;
    }

    private static byte[] pluginArchive(String pluginName, String fileName, String content) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
            zip.putNextEntry(new ZipEntry(pluginName + "/" + fileName));
            zip.write(content.getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
        }
        return bytes.toByteArray();
    }

    private static Map<String, String> params(String... pairs) {
        Map<String, String> result = new HashMap<>();
        for (int i = 0; i < pairs.length; i += 2) result.put(pairs[i], pairs[i + 1]);
        return result;
    }

    private static void expectFailure(ThrowingRunnable operation) throws Exception {
        try {
            operation.run();
            fail("expected request to fail");
        } catch (Exception expected) {
            // Invalid request, URL, or overwrite conflict.
        }
    }

    private static void writeResponse(OutputStream output, int status, byte[] body) throws IOException {
        String reason = status == 200 ? "OK" : "Not Found";
        output.write(("HTTP/1.1 " + status + " " + reason + "\r\nContent-Length: " + body.length +
                "\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
        output.write(body);
        output.flush();
    }

    private static void deleteRecursively(File file) {
        File[] children = file.listFiles();
        if (children != null) {
            for (File child : children) deleteRecursively(child);
        }
        assertTrue("unable to remove " + file, file.delete());
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }

    private static class TestPluginManager extends PluginManager {
        TestPluginManager(GpsService gpsService, File workDir) throws IOException {
            super("plugins", gpsService, workDir, "plugins");
        }

        JSONObject request(String command, Map<String, String> parameters) throws Exception {
            Uri uri = mock(Uri.class);
            when(uri.getQueryParameter(anyString())).thenAnswer(invocation ->
                    parameters.get(invocation.getArgument(0)));
            return handleSpecialApiRequest(command, uri, (PostVars) null, (RequestHandler.ServerInfo) null);
        }
    }

    @FunctionalInterface
    private interface RequestHandlerFunction {
        void handle(Socket socket, String request) throws Exception;
    }

    private static class TestServer implements AutoCloseable {
        private final ServerSocket listener;
        private final Thread thread;
        private final RequestHandlerFunction handler;
        private final AtomicReference<Throwable> failure = new AtomicReference<>();
        private volatile Socket current;

        TestServer(RequestHandlerFunction handler) throws IOException {
            this.handler = handler;
            listener = new ServerSocket();
            listener.bind(new InetSocketAddress("127.0.0.1", 0));
            thread = new Thread(this::serve, "plugin-download-test-server");
            thread.setDaemon(true);
            thread.start();
        }

        String url() {
            return "http://127.0.0.1:" + listener.getLocalPort() + "/plugin.zip";
        }

        private void serve() {
            while (!listener.isClosed()) {
                try (Socket socket = listener.accept()) {
                    current = socket;
                    socket.setSoTimeout(5000);
                    java.io.BufferedReader input = new java.io.BufferedReader(new java.io.InputStreamReader(
                            socket.getInputStream(), StandardCharsets.US_ASCII));
                    String request = input.readLine();
                    String line;
                    while ((line = input.readLine()) != null && !line.isEmpty()) { }
                    handler.handle(socket, request);
                } catch (Exception e) {
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
            assertNull("test server failed", failure.get());
        }
    }
}
