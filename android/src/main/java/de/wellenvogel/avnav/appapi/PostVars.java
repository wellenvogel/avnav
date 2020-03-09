package de.wellenvogel.avnav.appapi;

import org.apache.http.HttpEntity;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

import de.wellenvogel.avnav.main.Constants;

public class PostVars {
    long len=-1;
    InputStream is;
    String strValue;
    boolean closed=false;
    public long getContentLength(){ return len;}
    public String getAsString() throws IOException {
        if (strValue != null) return strValue;
        if (is == null) throw new IOException("input closed");
        if (len < 0) throw new IOException("no len available");
        if (len > Constants.MAXFILESIZE) throw new IOException(" file to long, max "+Constants.MAXFILESIZE);
        byte[] buffer = new byte[(int) len];
        int rd = is.read(buffer);
        strValue=new String(buffer, 0, rd, StandardCharsets.UTF_8);
        return strValue;
    }
    public void writeTo(OutputStream os) throws Exception {
        if (strValue != null){
            os.write(strValue.getBytes(StandardCharsets.UTF_8));
        }
        else{
            if (is == null) throw new Exception("no input data");
            if (closed) throw new Exception("already closed");
            byte buffer[] = new byte[(int) (Constants.MAXFILESIZE/10)];
            int rd = 0;
            while ((rd = is.read(buffer)) > 0) {
                os.write(buffer,0,rd);
            }
            is.close();
            os.close();
            closed=true;
        }
    }

    public PostVars(String data){
        strValue=data;
    }
    public PostVars(HttpEntity entity) throws IOException {
        len=entity.getContentLength();
        is=entity.getContent();
    }
}
