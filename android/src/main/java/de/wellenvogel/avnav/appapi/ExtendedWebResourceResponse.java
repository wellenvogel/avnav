package de.wellenvogel.avnav.appapi;

import android.webkit.WebResourceResponse;

import java.io.InputStream;
import java.util.HashMap;

public class ExtendedWebResourceResponse extends WebResourceResponse {
    long length;
    private HashMap<String,String> headers=new HashMap<String, String>();
    public ExtendedWebResourceResponse(long length, String mime, String encoding, InputStream is){
        super(mime,encoding,is);
        this.length=length;
    }
    public long getLength(){
        return length;
    }
    public void setHeader(String name,String value){
        headers.put(name,value);
    }
    public HashMap<String,String> getHeaders() {
        return headers;
    }
}
