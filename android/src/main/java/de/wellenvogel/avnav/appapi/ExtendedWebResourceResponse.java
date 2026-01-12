package de.wellenvogel.avnav.appapi;

import android.os.Build;
import android.webkit.WebResourceResponse;

import org.apache.http.Header;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Locale;
import java.util.TimeZone;

import de.wellenvogel.avnav.util.AvnLog;

public class ExtendedWebResourceResponse extends WebResourceResponse {
    public static final String HTTP_RESPONSE_DATE_HEADER =
            "EEE, dd MMM yyyy HH:mm:ss zzz";

    public Object userData; //allow to store some user data here to correctly handle the life cycle
    DateFormat httpTimeFormat=null;
    long length;
    int statusCode=200;
    String reason="OK";

    static class LengthLimitedStream extends InputStream {
        InputStream impl;
        long length=0;
        public LengthLimitedStream(InputStream impl, long length){
            this.impl=impl;
            this.length=length;
        }
        @Override
        public int read() throws IOException {
            if (length <0) return -1;
            length--;
            return impl.read();
        }

        @Override
        public int available() throws IOException {
            //if we have really large files (not unlikely with pmtiles)
            //we use 0 here (this will be translated to content-length by the webview)
            //and content-length 0 seems to be no problem at least for the pmtiles
            if (length > Integer.MAX_VALUE) return 0;
            return (int) length;
        }


        @Override
        public int read(byte[] b, int off, int len) throws IOException {
            if (len > length) len=(int)length;
            if (len < 0 || length == 0) {
                impl.close();
                return -1;
            }
            int rt=impl.read(b, off, len);
            if (rt > 0) length-=rt;
            if (rt < 0) length=-1;
            return rt;
        }

        @Override
        public void close() throws IOException {
            impl.close();
        }

        @Override
        public long skip(long n) throws IOException {
            AvnLog.e("range skip"+n);
            long res=impl.skip(n);
            length-=n;
            return res;
        }

        @Override
        public synchronized void reset() throws IOException {
            int dummy=1;
        }

    }

    public boolean isProxy() {
        return isProxy;
    }

    public void setProxy(boolean proxy) {
        isProxy = proxy;
    }

    static final String BYTES="bytes=";
    public static final String RANGE_HDR="range";
    public void applyRangeHeader(Header hdr){
        if (hdr == null) return;
        applyRangeHeader(hdr.getValue(),false);
    }

    /**
     * handle range requests
     * for webview access refer to
     * https://issues.chromium.org/issues/40739128
     * @param header
     */
    public void applyRangeHeader(String header,boolean local){
        if (isProxy() || header == null) return;
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return;
        if (this.statusCode == 206) return; //already applied
        try {
            long oriLength=this.getLength();
            if (oriLength < 0) throw new Exception("cannot seek, no length");
            if (header.toLowerCase().startsWith(BYTES)) header = header.substring(BYTES.length());
            String[] startEnd = header.split("-");
            long start = 0;
            long end=oriLength-1;
            if (startEnd.length >0 ){
                start=Long.parseLong(startEnd[0]);
            }
            if (startEnd.length > 1){
                end=Long.parseLong(startEnd[1]);
            }
            if (start < 0 || start >= oriLength) throw new Exception("invalid start");
            if (end < 0 || end < start || end >= oriLength) throw new Exception("invalid end");
            if (start > 0 || end < (oriLength-1)) {
                long rangeLen=end+1;
                if (! local) {
                    long res = this.getData().skip(start);
                    if (res != start) throw new Exception("unable to seek to start");
                    this.length = end - start + 1;
                }
                else{
                    //the android webview implementation is really strange - see the issue link above
                    //it will skip to start by it's own but will read till the end of the stream
                    //if we let this pass it will slow down things a lot as PMTiles files are typically
                    //rather big
                    //so we "clamp" the stream to the end of the range but do not skip by our own
                    this.length=rangeLen;
                }
                this.statusCode=206;
                setHeader("Content-Range",String.format("bytes %d-%d/%d",start,end,oriLength));
                this.setData(new LengthLimitedStream(this.getData(),this.length));
            }
        }catch (Exception e){
            this.setStatusCodeAndReasonPhrase(416,e.getMessage());
        }
    }
    private void setAccepHeader(){
        if (this.length >= 0){
            setHeader("Accept-Ranges", "bytes");
        }
    }

    boolean isProxy=false;
    private HashMap<String,String> headers=new HashMap<String, String>();
    public ExtendedWebResourceResponse(long length, String mime, String encoding, InputStream is){
        super(mime,encoding,is);
        this.length=length;
        setAccepHeader();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            setResponseHeaders(headers);
        }
    }
    public ExtendedWebResourceResponse(File f,String mime, String encoding) throws IOException {
        super(mime,encoding, new FileInputStream(f));
        this.length=f.length();
        setAccepHeader();
        this.setDateHeader("Last-Modified",new Date(f.lastModified()));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            setResponseHeaders(headers);
        }
    }
    public ExtendedWebResourceResponse(int statusCode,String error){
        super("text/html",StandardCharsets.UTF_8.toString(),new ByteArrayInputStream(new byte[]{}));
        this.length=0;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            setResponseHeaders(headers);
        }
        setHeader("Cache-Control","no-store");
        this.statusCode=statusCode;
        reason=error;
    }
    public long getLength(){
        return length;
    }
    public void setHeader(String name,String value){
        headers.put(name,value);
    }
    public void setDateHeader(String name, Date date){
        if (httpTimeFormat == null){
            httpTimeFormat=new SimpleDateFormat(HTTP_RESPONSE_DATE_HEADER, Locale.US);
            httpTimeFormat.setTimeZone(TimeZone.getTimeZone("GMT"));
        }
        String value=httpTimeFormat.format(date);
        headers.put(name,value);
    }
    public HashMap<String,String> getHeaders() {
        return headers;
    }

    @Override
    public int getStatusCode() {
        return statusCode;
    }

    @Override
    public String getReasonPhrase() {
        return reason;
    }
}
