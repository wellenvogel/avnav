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
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Locale;
import java.util.TimeZone;

public class ExtendedWebResourceResponse extends WebResourceResponse {
    public static final String HTTP_RESPONSE_DATE_HEADER =
            "EEE, dd MMM yyyy HH:mm:ss zzz";

    public Object userData; //allow to store some user data here to correctly handle the life cycle
    DateFormat httpTimeFormat=null;
    long length;
    int statusCode=200;
    String reason="OK";

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
        applyRangeHeader(hdr.getValue());
    }
    public void applyRangeHeader(String header){
        if (isProxy() || header == null) return;
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return;
        if (this.statusCode == 206) return; //already applied
        try {
            if (this.getLength() < 0) throw new Exception("cannot seek, no length");
            if (header.toLowerCase().startsWith(BYTES)) header = header.substring(BYTES.length());
            String[] startEnd = header.split("-");
            long start = 0;
            long end=this.getLength()-1;
            if (startEnd.length >0 ){
                start=Long.parseLong(startEnd[0]);
            }
            if (startEnd.length > 1){
                end=Long.parseLong(startEnd[1]);
            }
            if (start < 0 || start >= this.getLength()) throw new Exception("invalid start");
            if (end < 0 || end < start || end >= this.getLength()) throw new Exception("invalid end");
            if (start > 0 || end < (this.getLength()-1)) {
                long res = this.getData().skip(start);
                if (res != start) throw new Exception("unable to seek to start");
                this.length=end-start+1;
                this.statusCode=206;
                setHeader("Content-Range",String.format("bytes %d-%d/%d",start,end,this.length));
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
