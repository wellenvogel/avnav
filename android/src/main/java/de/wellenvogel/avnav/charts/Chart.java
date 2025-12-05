package de.wellenvogel.avnav.charts;

import android.content.Context;
import android.os.ParcelFileDescriptor;

import androidx.annotation.NonNull;
import androidx.documentfile.provider.DocumentFile;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.util.Arrays;
import java.util.Collections;
import java.util.Date;
import java.util.List;

import de.wellenvogel.avnav.appapi.DirectoryRequestHandler;
import de.wellenvogel.avnav.appapi.ExtendedWebResourceResponse;
import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;

public class Chart implements IChartWithConfig {
    public static final String INDEX_INTERNAL = "1";
    public static final String INDEX_EXTERNAL = "2";
    static final int TYPE_GEMF=1;
    static final int TYPE_MBTILES=2;
    static final int TYPE_XML=3;
    static final String CFG_EXTENSION=".cfg";
    static final Character CFG_DELIM='@';
    private static final long INACTIVE_CLOSE=100000; //100s
    static final String STYPE_GEMF ="gemf";
    static final String STYPE_MBTILES ="mbtiles";
    static final String STYPE_XML ="xml";
    private String keyPrefix;
    private String name;
    protected Context context;
    private File realFile;
    private DocumentFile documentFile; //alternative to realFile
    private ChartFileReader chartReader;
    private long lastModified;
    private long lastTouched;
    private int type;
    private boolean isInternal=false;

    static String typeToStr(int type){
        switch (type){
            case TYPE_GEMF:
                return STYPE_GEMF;
            case TYPE_MBTILES:
                return STYPE_MBTILES;
            case TYPE_XML:
                return STYPE_XML;
        }
        return "UNKNOWN";
    }
    public Chart(int type, Context context, File f, String index, long last) throws UnsupportedEncodingException {
        this.context = context;
        realFile=f;
        this.keyPrefix=Constants.REALCHARTS + "/" + index + "/"+ typeToStr(type) +"/";
        this.name=f.getName();
        this.lastModified=last;
        this.lastTouched=System.currentTimeMillis();
        this.type=type;
        if (INDEX_INTERNAL.equals(index)){
            isInternal=true;
        }
    }
    public Chart(int type, Context context, DocumentFile f, String index, long last) throws Exception {
        this.context = context;
        documentFile =f;
        this.keyPrefix=Constants.REALCHARTS + "/" + index + "/"+ typeToStr(type) +"/";
        this.name=DirectoryRequestHandler.safeName(f.getName(),false);
        this.lastModified=last;
        this.lastTouched=System.currentTimeMillis();
        this.type=type;
        if (INDEX_INTERNAL.equals(index)){
            isInternal=true;
        }
    }

    protected Chart(Context ctx) {
        this.context=ctx;
    }

    synchronized ChartFileReader getChartFileReader() throws Exception {
        if (isXml())
            throw new IOException("unable to get chart file from xml");
        if (chartReader == null){
            AvnLog.i("RequestHandler","open chart file "+getChartKey());
            if (documentFile != null){
                ChartFile cf=(type == TYPE_MBTILES)?null:new GEMFFile(documentFile, context);
                chartReader =new ChartFileReader(cf,getChartKey());
            }
            else {
                ChartFile cf=(type == TYPE_MBTILES)?new MbTilesFile(realFile):new GEMFFile(realFile);
                chartReader = new ChartFileReader(cf, getChartKey());
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

    ExtendedWebResourceResponse getDownload(Context ctx) throws IOException {
        if (documentFile != null){
            ExtendedWebResourceResponse rt= new ExtendedWebResourceResponse(documentFile.length(),
                    "application/octet-stream",
                    "",
                    ctx.getContentResolver().openInputStream(documentFile.getUri()));
            rt.setDateHeader("Last-Modified",new Date(documentFile.lastModified()));
            return rt;
        }
        if (realFile != null){
            if (! realFile.exists() || ! realFile.canRead()){
                throw new FileNotFoundException("unable to read "+realFile.getName());
            }
            return new ExtendedWebResourceResponse(realFile,"application/octet-stream","");
        }
        throw new FileNotFoundException("no file found for "+name);
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
            return realFile != null && (isXml() || (type == TYPE_MBTILES) || (getChartFileReader().numFiles() == 1));
        }catch (Exception e){
            AvnLog.e("unable to get num of chartReader files",e);
            return false;
        }
    }


    public File deleteFile() {
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
        String displayName=(realFile!=null)?realFile.getName():documentFile.getName();
        e.put("displayName", isInternal?displayName:(displayName+" [ext]"));
        e.put("downloadName", (realFile!=null)?realFile.getName():documentFile.getName());
        e.put("time", getLastModified() / 1000);
        e.put("url", "/"+ Constants.CHARTPREFIX + "/"+keyPrefix+URLEncoder.encode(name, "UTF-8").replaceAll("\\+", "%20"));
        e.put("canDelete",canDelete());
        e.put("info",numFiles+" files");
        e.put("canDownload",isXml() || (numFiles == 1));
        e.put("sequence",sequence);
        e.put("scheme",scheme);
        e.put("name",getChartKey());
        if (orignalScheme != null){
            e.put("originalScheme",orignalScheme);
        }
        if (isInternal){
            e.put("checkPrefix",keyPrefix);
        }
        return e;
    }

    public String getConfigName(){
        return keyPrefix.replace('/',CFG_DELIM)+name+CFG_EXTENSION;
    }

    public String getChartKey(){
        return keyPrefix+name;
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

    @NonNull
    @Override
    public String toString() {
        return "Chart: t=" + typeToStr(type) + ",k=" + getChartKey();
    }

    @Override
    public List<String> getChartCfgs() {
        return Collections.singletonList(getConfigName());
    }
}
