package de.wellenvogel.avnav.charts;

import android.content.Context;
import android.support.v4.provider.DocumentFile;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UnsupportedEncodingException;

import de.wellenvogel.avnav.appapi.ExtendedWebResourceResponse;
import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;

public class Chart implements AvnUtil.IJsonObect {
    static final int TYPE_GEMF=1;
    static final int TYPE_MBTILES=2;
    static final int TYPE_XML=3;
    static final String CFG_EXTENSION=".cfg";
    private static final long INACTIVE_CLOSE=100000; //100s
    protected Context context;
    private File realFile;
    private DocumentFile documentFile; //alternative to realFile
    private ChartFileReader chartReader;
    private  String key;
    private long lastModified;
    private long lastTouched;
    private int type;
    public Chart(int type, Context context, File f, String key, long last){
        this.context = context;
        realFile=f;
        this.key=key;
        this.lastModified=last;
        this.lastTouched=System.currentTimeMillis();
        this.type=type;
    }
    public Chart(int type, Context context, DocumentFile f, String key, long last){
        this.context = context;
        documentFile =f;
        this.key=key;
        this.lastModified=last;
        this.lastTouched=System.currentTimeMillis();
        this.type=type;
    }

    protected Chart(Context ctx) {
        this.context=ctx;
    }

    private synchronized ChartFileReader getChartFileReader() throws Exception {
        if (isXml())
            throw new IOException("unable to get chart file from xml");
        if (chartReader == null){
            AvnLog.i("RequestHandler","open chart file "+key);
            if (documentFile != null){
                ChartFile cf=(type == TYPE_MBTILES)?null:new GEMFFile(documentFile, context);
                chartReader =new ChartFileReader(cf,key);
            }
            else {
                ChartFile cf=(type == TYPE_MBTILES)?new MbTilesFile(realFile):new GEMFFile(realFile);
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
        }if ("chart".equals(type)) {

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
            return realFile != null && (isXml() || (type == TYPE_MBTILES) || (getChartFileReader().numFiles() == 1));
        }catch (Exception e){
            AvnLog.e("unable to get num of chartReader files",e);
            return false;
        }
    }


    public File deleteFile() throws Exception {
        if (!canDelete()) return null;
        if (! isXml()) {
            try {
                getChartFileReader().close();
            }catch (Throwable t){
                AvnLog.e("unable to close chart file before delete",t);
            }
        }
        realFile.delete();
        return realFile;
    }
    public boolean isXml(){
        return (type == TYPE_XML);
    }
    public ExtendedWebResourceResponse getOverview() throws Exception {
        if (isXml()){
            if (realFile != null){
                return new ExtendedWebResourceResponse((int)realFile.length(),"text/xml","",new FileInputStream(realFile));
            }
            else{
                InputStream is= context.getContentResolver().openInputStream(documentFile.getUri());
                return new ExtendedWebResourceResponse(-1,"text/xml","",is);
            }
        }
        else{
            ChartFileReader f = getChartFileReader();
            InputStream rt=f.chartOverview();
            return new ExtendedWebResourceResponse(-1,"text/xml","",rt);
        }
    }
    public ExtendedWebResourceResponse getChartData(int x, int y, int z, int sourceIndex) throws IOException {
        return chartReader.getChartData(x,y,z,sourceIndex);
    }

    public JSONObject toJson() throws JSONException, UnsupportedEncodingException {
        JSONObject e = new JSONObject();
        int numFiles=0;
        long sequence=0;
        String scheme="";
        String orignalScheme=null;
        try {
            if (isXml()) {
                numFiles=1;
            }
            else {
                numFiles= getChartFileReader().numFiles();
                sequence=getChartFileReader().getSequence();
                scheme=getChartFileReader().getScheme();
                orignalScheme=getChartFileReader().getOriginalScheme();
            }
        }catch (Exception ex){
            throw new JSONException(ex.getLocalizedMessage());
        }
        e.put("name", (realFile!=null)?realFile.getName():documentFile.getName());
        e.put("time", getLastModified() / 1000);
        e.put("url", "/"+ Constants.CHARTPREFIX + "/"+key);
        e.put("canDelete",canDelete());
        e.put("info",numFiles+" files");
        e.put("canDownload",isXml() || (numFiles == 1));
        e.put("sequence",sequence);
        e.put("scheme",scheme);
        e.put("chartKey",key);
        e.put("overlayConfig",getConfigName());
        if (orignalScheme != null){
            e.put("originalScheme",orignalScheme);
        }
        return e;
    }

    public String getConfigName(){
        return key.replace('/','@')+CFG_EXTENSION;
    }

    public String getChartKey(){
        return key;
    }

    public boolean setScheme(String newScheme) throws Exception {
        return getChartFileReader().setSchema(newScheme);
    }
    public void computeOverview() throws Exception {
        if (isXml()) return;
        getChartFileReader().getOverview();
    }
    public long getSequence() throws Exception {
        if (isXml()) return 0;
        return getChartFileReader().getSequence();
    }
}
