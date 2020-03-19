package de.wellenvogel.avnav.charts;

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

public class Chart implements INavRequestHandler.IJsonObect {
    static final int TYPE_GEMF=1;
    static final int TYPE_MBTILES=2;
    static final int TYPE_XML=3;
    private static final long INACTIVE_CLOSE=100000; //100s
    private Activity activity;
    private File realFile;
    private DocumentFile documentFile; //alternative to realFile
    private ChartFileReader chartReader;
    private  String key;
    private long lastModified;
    private long lastTouched;
    private int type;
    public Chart(int type,Activity activity, File f, String key, long last){
        this.activity=activity;
        realFile=f;
        this.key=key;
        this.lastModified=last;
        this.lastTouched=System.currentTimeMillis();
        this.type=type;
    }
    public Chart(int type,Activity activity, DocumentFile f, String key, long last){
        this.activity = activity;
        documentFile =f;
        this.key=key;
        this.lastModified=last;
        this.lastTouched=System.currentTimeMillis();
        this.type=type;
    }
    private synchronized ChartFileReader getChartFileReader() throws IOException {
        if (isXml())
            throw new IOException("unable to get chart file from xml");
        if (chartReader == null){
            AvnLog.i("RequestHandler","open chart file "+key);
            if (documentFile != null){
                ChartFile cf=(type == TYPE_MBTILES)?null:new GEMFFile(documentFile, activity);
                chartReader =new ChartFileReader(cf,key);
            }
            else {
                ChartFile cf=(type == TYPE_MBTILES)?null:new GEMFFile(realFile);
                chartReader = new ChartFileReader(cf, key);
            }
        }
        this.lastTouched=System.currentTimeMillis();
        return chartReader;
    }
    synchronized void close(){
        if (chartReader != null){
            chartReader.close();
            chartReader =null;
        }
    }

    synchronized boolean closeInactive(){
        if (chartReader == null) return false;
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
        //TODO: move delete handling to GEMFfile
        try {
            return realFile != null && (getChartFileReader().numFiles() == 1);
        }catch (Exception e){
            AvnLog.e("unable to get num of chartReader files",e);
            return false;
        }
    }

    /**
     * check if this chart file belongs to the internal chart with the name provided
     * @param fileName
     * @return
     */
    public boolean isName(String fileName){
        if (realFile == null) return false;
        if (realFile.getName().equals(fileName)) return true;
        return false;
    }
    public File deleteFile() throws IOException {
        if (!canDelete()) return null;
        getChartFileReader().close();
        realFile.delete();
        return realFile;
    }
    public boolean isXml(){
        return (type == TYPE_XML);
    }
    public ExtendedWebResourceResponse getOverview() throws IOException {
        if (isXml()){
            if (realFile != null){
                return new ExtendedWebResourceResponse((int)realFile.length(),"text/xml","",new FileInputStream(realFile));
            }
            else{
                InputStream is=activity.getContentResolver().openInputStream(documentFile.getUri());
                return new ExtendedWebResourceResponse(-1,"text/xml","",is);
            }
        }
        else{
            ChartFileReader f = getChartFileReader();
            InputStream rt=f.chartOverview();
            return new ExtendedWebResourceResponse(-1,"text/xml","",rt);
        }
    }
    public ExtendedWebResourceResponse getChartData(int x, int y, int z, int sourceIndex) {
        return chartReader.getChartData(x,y,z,sourceIndex);
    }

    public JSONObject toJson() throws JSONException {
        JSONObject e = new JSONObject();
        int numFiles=0;
        try {
            numFiles= getChartFileReader().numFiles();
        }catch (Exception ex){
            throw new JSONException(ex.getLocalizedMessage());
        }
        e.put("name", key.replaceAll(".*/", ""));
        e.put("time", getLastModified() / 1000);
        e.put("url", "/"+ Constants.CHARTPREFIX + "/"+key);
        e.put("canDelete",canDelete());
        e.put("info",numFiles+" files");
        e.put("canDownload",!isXml() && (numFiles == 1));
        return e;
    }
}
