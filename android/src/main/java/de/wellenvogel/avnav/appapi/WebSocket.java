package de.wellenvogel.avnav.appapi;

import android.util.Base64;

import org.apache.http.HttpException;
import org.apache.http.HttpRequest;
import org.apache.http.HttpResponse;
import org.apache.http.protocol.ExecutionContext;
import org.apache.http.protocol.HttpContext;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

import de.wellenvogel.avnav.util.AvnLog;


public class WebSocket implements IWebSocket{
    private static final String GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

    private static final int MAXLEN=8000000; //max message len
    private HttpRequest httpRequest;
    private HttpResponse httpResponse;
    private HttpContext httpContext;
    private WebServer.AvNavHttpServerConnection connection;
    private WebSocketHandler handler;
    private final Object outLock=new Object();
    WebSocket(HttpRequest httpRequest, HttpResponse httpResponse, HttpContext httpContext,WebSocketHandler handler){
        this.httpRequest=httpRequest;
        this.httpResponse=httpResponse;
        this.httpContext=httpContext;
        this.handler=handler;
        this.connection=(WebServer.AvNavHttpServerConnection)httpContext.getAttribute(ExecutionContext.HTTP_CONNECTION);
    }
    private void handshake() throws NoSuchAlgorithmException, IOException, HttpException {
        connection.setSocketTimeout(0);
        String key=httpRequest.getFirstHeader("Sec-WebSocket-Key").getValue();
        String accept= Base64.encodeToString(MessageDigest.getInstance("SHA-1").digest((key + GUID).getBytes(StandardCharsets.UTF_8)),Base64.NO_WRAP);
        byte[] response = ("HTTP/1.1 101 Switching Protocols\r\n"
                + "Connection: Upgrade\r\n"
                + "Upgrade: websocket\r\n"
                + "Sec-WebSocket-Accept: "
                + accept
                + "\r\n\r\n").getBytes(StandardCharsets.UTF_8);
        connection.avOutputBuffer.write(response);
        connection.avOutputBuffer.flush();
        handler.onConnect(this);
    }

    private int readWException() throws IOException {
        int rt=connection.avInputBuffer.read();
        if (rt < 0) throw new IOException("EOF");
        return rt;
    }
    private void sendClose() throws IOException {
        synchronized (outLock){
            byte [] msg=new byte[2];
            msg[0]=(byte)(0x80 + opcodeClose);
            msg[1]=0x00;
            connection.avOutputBuffer.write(msg);
            connection.avOutputBuffer.flush();
        }
    }
    private void sendMessage(int opCode, byte [] msg) throws IOException {
        synchronized (outLock){
            connection.avOutputBuffer.write(new byte[]{(byte)(0x80+opCode)});
            int len=msg.length;
            if (len <= 125){
                connection.avOutputBuffer.write(new byte[]{(byte)(len)});
            }
            else if (len >= 126 && len <= 65535){
                connection.avOutputBuffer.write(new byte[]{126,(byte)((len >> 8) &0xff),(byte)(len & 0xff)});
            }
            else{
                connection.avOutputBuffer.write(new byte[]{127,
                        (byte)((len >> 24) &0xff),
                        (byte)((len >> 16) &0xff),
                        (byte)((len >> 8) &0xff),
                        (byte)(len & 0xff)});
            }
            if (len > 0) {
                connection.avOutputBuffer.write(msg);
            }
            connection.avOutputBuffer.flush();
        }
    }
    private boolean readNextMessage() throws IOException {
        int opcode=readWException() & 0x0f;
        int len=readWException() & 0x7f;
        if (len == 126){
            len=(readWException() <<8) +  readWException();
        }
        else if (len == 127){
            len=(readWException() <<24) +
                    (readWException() << 16) +
                    (readWException() << 8) +
                    readWException();
        }
        if ( len > MAXLEN) throw new IOException("max len of "+MAXLEN+" bytes exceeded");
        byte [] masks= new byte[4];
        if (connection.avInputBuffer.read(masks,0,4) != 4){
            throw new IOException("unable to read mask bytes");
        }
        byte[] buffer=new byte[len];
        int toRead=len;
        while (toRead > 0){
            int rd=connection.avInputBuffer.read(buffer,len-toRead,toRead);
            if (rd <= 0) throw new IOException("EOF in data");
            toRead-=rd;
        }
        for (int i=0;i<len;i++){
            buffer[i]=(byte)(buffer[i] ^ masks[ i % 4]);
        }
        if (opcode == opcodeClose){
            try {
                sendClose();
            }catch (Throwable t){
                AvnLog.dfs("Error closing ws: %s",t.getMessage());
            }
            connection.close();
            handler.onClose(this);
            return false;
        }
        if (opcode == opcodePing){
            sendMessage(opcodePong,buffer);
            return true;
        }
        if (opcode == opcodeBinary || opcode == opcodeText || opcode == opcodeContinue){
            handler.onReceive(opcode,buffer,this);
        }
        return true;
    }
    void handle() throws NoSuchAlgorithmException, IOException, HttpException {
        AvnLog.dfs("WebSocket starting for %s",httpRequest.getRequestLine());
        handshake();
        AvnLog.dfs("Websocket handshake complete");
        while (true){
            if (! readNextMessage()){
                AvnLog.dfs("finished websocket");
                connection.setClosed();
                return;
            }
        }
    }

    @Override
    public void send(String msg) throws IOException {
        sendMessage(opcodeText,msg.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    public long getId() {
        return 0;
    }
}
