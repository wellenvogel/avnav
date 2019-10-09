package de.wellenvogel.avnav.gemf;

import android.app.Activity;
import android.os.ParcelFileDescriptor;
import android.support.v4.provider.DocumentFile;
import android.view.inputmethod.ExtractedText;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;

import de.wellenvogel.avnav.main.RequestHandler;
import de.wellenvogel.avnav.util.AvnLog;

public class GemfChart {
    private static final long INACTIVE_CLOSE=100000; //100s
    private Activity activity;
    private File realFile;
    private DocumentFile documentFile; //alternative to realFile
    private GemfHandler gemf;
    private  String key;
    private long lastModified;
    private long lastTouched;
    private boolean isXml=false;
    public GemfChart(Activity activity, File f, String key, long last){
        this.activity=activity;
        realFile=f;
        this.key=key;
        this.lastModified=last;
        this.lastTouched=System.currentTimeMillis();
    }
    public GemfChart(Activity activity, DocumentFile f, String key, long last){
        this.activity = activity;
        documentFile =f;
        this.key=key;
        this.lastModified=last;
        this.lastTouched=System.currentTimeMillis();
    }
    public void setIsXml(){
        isXml=true;
    }
    public synchronized  GemfHandler getGemf() throws IOException {
        if (isXml)
            throw new IOException("unable to get GEMF file from xml");
        if (gemf == null){
            AvnLog.i("RequestHandler","open gemf file "+key);
            if (documentFile != null){
                gemf=new GemfHandler(new GEMFFile(documentFile, activity),key);
            }
            else {
                gemf = new GemfHandler(new GEMFFile(realFile), key);
            }
        }
        this.lastTouched=System.currentTimeMillis();
        return gemf;
    }
    synchronized void close(){
        if (gemf != null){
            gemf.close();
            gemf=null;
        }
    }

    synchronized boolean closeInactive(){
        if (gemf == null) return false;
        if (lastTouched < (System.currentTimeMillis() -INACTIVE_CLOSE)) {
            this.close();
            return true;
        }
        return false;
    }

    public synchronized void update(Long lastModified) {
        close();
        this.lastModified=lastModified;
    }

    public long getLastModified(){
        return lastModified;
    }

    public boolean canDelete(){
        return realFile != null;
    }
    public File deleteFile(){
        if (realFile == null) return null;
        realFile.delete();
        return realFile;
    }
    public boolean isXml(){
        return isXml;
    }
    public RequestHandler.ExtendedWebResourceResponse getOverview() throws IOException {
        if (isXml){
            if (realFile != null){
                return new RequestHandler.ExtendedWebResourceResponse((int)realFile.length(),"text/xml","",new FileInputStream(realFile));
            }
            else{
                InputStream is=activity.getContentResolver().openInputStream(documentFile.getUri());
                return new RequestHandler.ExtendedWebResourceResponse(-1,"text/xml","",is);
            }
        }
        else{
            GemfHandler f = getGemf();
            InputStream rt=f.gemfOverview();
            return new RequestHandler.ExtendedWebResourceResponse(-1,"text/xml","",rt);
        }
    }
}
