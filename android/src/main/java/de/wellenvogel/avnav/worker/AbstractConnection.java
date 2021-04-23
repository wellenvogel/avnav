package de.wellenvogel.avnav.worker;

import android.support.annotation.NonNull;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

import de.wellenvogel.avnav.util.AvnLog;

/**
 * Created by andreas on 12.03.15.
 * a class to unify Bluetooth sockets and IP sockets
 */
public abstract class AbstractConnection {
    protected ConnectionReaderWriter.ConnectionProperties properties;
    private GuardedInputStream inputStream;
    private GuardedOutputStream outputStream;
    private boolean closed=true;

    /**
     * connect the socket
     * @throws IOException
     */
    public void connect() throws IOException{
        connectImpl();
        closed=false;
    }
    abstract protected void connectImpl() throws IOException;

    private static class GuardedInputStream extends InputStream{
        //not thread safe!
        private InputStream impl;
        private long lastReadStart=0;
        private int timeout=0;
        GuardedInputStream(InputStream impl,int timeout){
            this.timeout=timeout;
            this.impl=impl;
        }
        @Override
        public int read() throws IOException {
            if (timeout > 0){
                lastReadStart=System.currentTimeMillis();
            }
            try{
                return impl.read();
            }finally{
                lastReadStart=0;
            }
        }

        @Override
        public int read(@NonNull byte[] b) throws IOException {
            if (timeout > 0){
                lastReadStart=System.currentTimeMillis();
            }
            try{
                return impl.read(b);
            }finally{
                lastReadStart=0;
            }

        }

        @Override
        public int read(@NonNull byte[] b, int off, int len) throws IOException {
            if (timeout > 0){
                lastReadStart=System.currentTimeMillis();
            }
            try{
                return impl.read(b,off,len);
            }finally{
                lastReadStart=0;
            }
        }

        public boolean hasTimeout(long now){
            long lastStart=lastReadStart;
            if (timeout <= 0 || lastStart <= 0) return false;
            return ((lastStart+timeout*1000) < now);
        }

    }
    public synchronized InputStream getInputStream() throws IOException{
        if (inputStream != null) return  inputStream;
        inputStream=new GuardedInputStream(getInputStreamImpl(),properties.closeOnReadTimeout?properties.noDataTime:0);
        return inputStream;
    };
    abstract InputStream getInputStreamImpl() throws IOException;

    private static class GuardedOutputStream extends OutputStream{
        //not thread safe!
        OutputStream impl;
        long lastWriteStart=0;
        int timeout=0;
        GuardedOutputStream(OutputStream impl,int timeout){
            this.impl=impl;
            this.timeout=timeout;
        }
        @Override
        public void write(int b) throws IOException {
            if (timeout > 0){
                lastWriteStart=System.currentTimeMillis();
            }
            try{
                impl.write(b);
            }finally {
                lastWriteStart=0;
            }
        }

        @Override
        public void write(@NonNull byte[] b) throws IOException {
            if (timeout > 0){
                lastWriteStart=System.currentTimeMillis();
            }
            try{
                impl.write(b);
            }finally {
                lastWriteStart=0;
            }
        }

        public boolean hasTimeout(long now){
            long writeStart=lastWriteStart;
            if (timeout <=0 || writeStart <=0) return false;
            return ((writeStart+timeout*1000) < now);
        }

    }
    public synchronized  OutputStream getOutputStream() throws IOException{
        if (outputStream != null) return outputStream;
        outputStream=new GuardedOutputStream(getOutputStreamImpl(),properties.writeTimeout);
        return outputStream;
    }
    protected abstract OutputStream getOutputStreamImpl() throws IOException;

    public void setProperties(ConnectionReaderWriter.ConnectionProperties properties){
        this.properties=properties;
    }

    /**
     * give the abstract connection a chance to let the retry connect loop finally fail
     * @return true if no connect retries any more
     */
    public boolean shouldFail(){return false;}
    /**
     * write timeout check
     * closes the socket on timeout
     * @return true if closed
     */
    public boolean check(){
        long now=System.currentTimeMillis();
        boolean hasTimeout=false;
        synchronized (this) {
            if (outputStream != null && outputStream.hasTimeout(now)) {
                AvnLog.e("connection " + getId() + ": write timeout");
                hasTimeout = true;
            }
            if (inputStream != null && inputStream.hasTimeout(now)) {
                AvnLog.e("connection " + getId() + ": read timeout");
                hasTimeout = true;
            }
        }
        if (hasTimeout){
            AvnLog.e("connection "+getId()+" closing due to timeout");
            try {
                close();
            } catch (IOException e) {
            }
            return true;
        }
        return false;
    }
    public void close() throws IOException{
        try{
            if (inputStream != null) inputStream.close();
        }catch(Throwable t){}
        inputStream=null;
        try{
            if (outputStream != null) outputStream.close();
        }catch (Throwable t){}
        outputStream=null;
        closed=true;
        closeImpl();
    }
    abstract protected void closeImpl() throws IOException;

    abstract public String getId();

    public boolean isClosed(){
        return closed;
    }

}
