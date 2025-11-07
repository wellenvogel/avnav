package de.wellenvogel.avnav.appapi;

import android.os.Build;
import android.webkit.WebResourceResponse;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
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
    private HashMap<String,String> headers=new HashMap<String, String>();
    public ExtendedWebResourceResponse(long length, String mime, String encoding, InputStream is){
        super(mime,encoding,is);
        this.length=length;
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
