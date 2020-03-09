package de.wellenvogel.avnav.gemf;

import android.app.Activity;
import android.support.v4.provider.DocumentFile;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;

import de.wellenvogel.avnav.appapi.ExtendedWebResourceResponse;
import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.appapi.INavRequestHandler;
import de.wellenvogel.avnav.util.AvnLog;

public class GemfChart implements INavRequestHandler.IJsonObect {
    private static final long INACTIVE_CLOSE=100000; //100s
    private Activity activity;
    private File realFile;
    private DocumentFile documentFile; //alternative to realFile
    private GemfFileReader gemf;
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
    public synchronized GemfFileReader getGemf() throws IOException {
        if (isXml)
            throw new IOException("unable to get GEMF file from xml");
        if (gemf == null){
            AvnLog.i("RequestHandler","open gemf file "+key);
            if (documentFile != null){
                gemf=new GemfFileReader(new GEMFFile(documentFile, activity),key);
            }
            else {
                gemf = new GemfFileReader(new GEMFFile(realFile), key);
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
    public ExtendedWebResourceResponse getOverview() throws IOException {
        if (isXml){
            if (realFile != null){
                return new ExtendedWebResourceResponse((int)realFile.length(),"text/xml","",new FileInputStream(realFile));
            }
            else{
                InputStream is=activity.getContentResolver().openInputStream(documentFile.getUri());
                return new ExtendedWebResourceResponse(-1,"text/xml","",is);
            }
        }
        else{
            GemfFileReader f = getGemf();
            InputStream rt=f.gemfOverview();
            return new ExtendedWebResourceResponse(-1,"text/xml","",rt);
        }
    }

    public JSONObject toJson() throws JSONException {
        JSONObject e = new JSONObject();
        e.put("name", key.replaceAll(".*/", ""));
        e.put("time", getLastModified() / 1000);
        e.put("url", "/"+ Constants.CHARTPREFIX + "/"+key);
        e.put("canDelete",canDelete());
        return e;
    }
}
