package de.wellenvogel.avnav.charts;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.support.v4.provider.DocumentFile;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.util.HashMap;
import java.util.Iterator;

import de.wellenvogel.avnav.appapi.DirectoryRequestHandler;
import de.wellenvogel.avnav.appapi.ExtendedWebResourceResponse;
import de.wellenvogel.avnav.appapi.PostVars;
import de.wellenvogel.avnav.appapi.RequestHandler;
import de.wellenvogel.avnav.main.BuildConfig;
import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.appapi.INavRequestHandler;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;

import static de.wellenvogel.avnav.main.Constants.CHARTOVERVIEW;
import static de.wellenvogel.avnav.main.Constants.CHARTPREFIX;
import static de.wellenvogel.avnav.main.Constants.DEMOCHARTS;
import static de.wellenvogel.avnav.main.Constants.REALCHARTS;


public class ChartHandler implements INavRequestHandler {
    private static final String GEMFEXTENSION =".gemf";
    private static final String MBTILESEXTENSION =".mbtiles";
    private static final String XMLEXTENSION=".xml";
    private static final String TYPE_GEMF="gemf";
    private static final String TYPE_MBTILES="mbtiles";
    private static final String TYPE_XML="xml";
    public static final String INDEX_INTERNAL = "1";
    public static final String INDEX_EXTERNAL = "2";
    private Activity activity;
    private RequestHandler handler;
    //mapping of url name to char descriptors
    private HashMap<String, Chart> chartList =new HashMap<String, Chart>();
    private boolean isStopped=false;

    public ChartHandler(Activity a, RequestHandler h){
        handler=h;
        activity=a;

    }

    public void stop(){
        isStopped=true;
    }

    /**
     * create the name part for the content provider uri
     * @param fileName
     * @param url charts/charts/index/type/name/
     *            this is created by {@link Chart#toJson()}
     * @return basically the same url after some checks
     */
    public static String uriPath(String fileName, String url) throws Exception {
        if (url == null) return null;
        KeyAndParts kp=urlToKey(url,true);
        return CHARTPREFIX+"/"+REALCHARTS+"/"+kp.originalParts[2]+"/"+kp.originalParts[3]+"/"+DirectoryRequestHandler.safeName(kp.originalParts[4],true);
    }

    /**
     * open a file for download
     * @param uriPart - corresponds to the path we returned from {@link #uriPath(String, String)}
     *                chart/index/type/name/
     *                it is the same like the url returned by {@link Chart#toJson()}
     * @return
     */
    public static ParcelFileDescriptor getFileFromUri(String uriPart, Context ctx) throws Exception {
        if (uriPart == null) return null;
        KeyAndParts kp=urlToKey(uriPart,true);
        if (kp.originalParts[2].equals(INDEX_INTERNAL)){
            File chartBase=getInternalChartsDir(ctx);
            File chartFile=new File(chartBase,DirectoryRequestHandler.safeName(URLDecoder.decode(kp.originalParts[4],"UTF-8"),true));
            if (!chartFile.exists() || ! chartFile.canRead()) return null;
            return ParcelFileDescriptor.open(chartFile,ParcelFileDescriptor.MODE_READ_ONLY);
        }
        if (kp.originalParts[2].equals(INDEX_EXTERNAL)){
            String secondChartDirStr=AvnUtil.getSharedPreferences(ctx).getString(Constants.CHARTDIR,"");
            if (secondChartDirStr.isEmpty()) return null;
            if (!secondChartDirStr.startsWith("content:")) return null;
            DocumentFile dirFile=DocumentFile.fromTreeUri(ctx,Uri.parse(secondChartDirStr));
            DocumentFile chartFile=dirFile.findFile(DirectoryRequestHandler.safeName(URLDecoder.decode(kp.originalParts[4],"UTF-8"),true));
            if (chartFile == null) return null;
            return ctx.getContentResolver().openFileDescriptor(chartFile.getUri(),"r");
        }
        return null;
    }


    public synchronized void updateChartList(){
        HashMap<String, Chart> newGemfFiles=new HashMap<String, Chart>();
        SharedPreferences prefs=AvnUtil.getSharedPreferences(activity);
        File workDir=AvnUtil.getWorkDir(prefs,activity);
        File chartDir = getInternalChartsDir(activity);
        readChartDir(chartDir.getAbsolutePath(), INDEX_INTERNAL,newGemfFiles);
        String secondChartDirStr=prefs.getString(Constants.CHARTDIR,"");
        if (! secondChartDirStr.isEmpty()){
            if (! secondChartDirStr.equals(workDir.getAbsolutePath())){
                readChartDir(secondChartDirStr, INDEX_EXTERNAL,newGemfFiles);
            }
        }
        //now we have all current charts - compare to the existing list and create/delete entries
        //currently we assume only one thread to change the chartlist...
        boolean modified=false;
        for (String url : newGemfFiles.keySet()){
            Chart chart=newGemfFiles.get(url);
            long lastModified=chart.getLastModified();
            if (chartList.get(url) == null ){
                chartList.put(url,chart);
                modified=true;
            }
            else{
                if (chartList.get(url).getLastModified() < lastModified){
                    modified=true;
                    chartList.get(url).close();
                    chartList.put(url,chart);
                }
            }
        }
        Iterator<String> it= chartList.keySet().iterator();
        while (it.hasNext()){
            String url=it.next();
            if (newGemfFiles.get(url) == null){
                it.remove();
                modified=true;
            }
            else{
                Chart chart= chartList.get(url);
                if (chart.closeInactive()){
                    AvnLog.i("closing gemf file "+url);
                    modified=true;
                }
            }
        }
        if (modified){
            activity.sendBroadcast(new Intent(Constants.BC_RELOAD_DATA));
            Thread overviewCreator=new Thread(new Runnable() {
                @Override
                public void run() {
                    AvnLog.i("creating chart overviews");
                    for (Chart chart :chartList.values()){
                        try{
                            chart.computeOverview();
                        }catch (Throwable t){
                            AvnLog.e("error computing chart overview",t);
                        }
                        if (isStopped) break;
                    }
                    AvnLog.i("done creating chart overviews");
                }
            });
            overviewCreator.setDaemon(true);
            overviewCreator.start();
        }
    }

    public Chart getChartDescription(String url){
        return chartList.get(url);
    }

    private void readChartDir(String chartDirStr,String index,HashMap<String, Chart> arr) {
        if (chartDirStr == null) return;
        if (Build.VERSION.SDK_INT >= 21) {
            if (chartDirStr.startsWith("content:")) {
                //see https://github.com/googlesamples/android-DirectorySelection/blob/master/Application/src/main/java/com/example/android/directoryselection/DirectorySelectionFragment.java
                //and https://stackoverflow.com/questions/36862675/android-sd-card-write-permission-using-saf-storage-access-framework
                Uri dirUri = Uri.parse(chartDirStr);
                DocumentFile dirFile=DocumentFile.fromTreeUri(activity,dirUri);
                for (DocumentFile f : dirFile.listFiles()){
                    try {
                        if (f.getName().endsWith(GEMFEXTENSION)) {
                            String urlName = Constants.REALCHARTS + "/" + index + "/"+TYPE_GEMF+"/" + URLEncoder.encode(f.getName(), "UTF-8");
                            arr.put(urlName, new Chart(Chart.TYPE_GEMF,activity, f, urlName, f.lastModified()));
                            AvnLog.d(Constants.LOGPRFX, "readCharts: adding gemf url " + urlName + " for " + f.getUri());
                        }
                        if (f.getName().endsWith(MBTILESEXTENSION)){
                            //we cannot handle this!
                            AvnLog.e("unable to read mbtiles from external dir: "+f.getName());
                        }
                        if (f.getName().endsWith(XMLEXTENSION)) {
                            String name = f.getName();
                            String urlName = Constants.REALCHARTS + "/" + index + "/"+TYPE_XML+"/" + URLEncoder.encode(name, "UTF-8");
                            Chart newChart = new Chart(Chart.TYPE_XML,activity, f, urlName, f.lastModified());
                            arr.put(urlName, newChart);
                            AvnLog.d(Constants.LOGPRFX, "readCharts: adding xml url " + urlName + " for " + f.getUri());
                        }
                    }catch (Throwable t){
                        AvnLog.e("unable to handle chart "+f.getName()+": "+t.getLocalizedMessage());
                    }
                }
                return;
            }
        }
        File chartDir=new File(chartDirStr);
        if (! chartDir.isDirectory()) return;
        File[] files=chartDir.listFiles();
        if (files == null) return;
        for (File f : files) {
            try {
                if (f.getName().endsWith(GEMFEXTENSION)){
                    String gemfName = f.getName();
                    String urlName= Constants.REALCHARTS + "/"+index+"/"+TYPE_GEMF+"/" + URLEncoder.encode(gemfName,"UTF-8");
                    arr.put(urlName,new Chart(Chart.TYPE_GEMF,activity, f,urlName,f.lastModified()));
                    AvnLog.d(Constants.LOGPRFX,"readCharts: adding gemf url "+urlName+" for "+f.getAbsolutePath());
                }
                if (f.getName().endsWith(MBTILESEXTENSION)){
                    String name = f.getName();
                    String urlName= Constants.REALCHARTS + "/"+index+"/"+TYPE_MBTILES+"/" + URLEncoder.encode(name,"UTF-8");
                    arr.put(urlName,new Chart(Chart.TYPE_MBTILES,activity, f,urlName,f.lastModified()));
                    AvnLog.d(Constants.LOGPRFX,"readCharts: adding mbtiles url "+urlName+" for "+f.getAbsolutePath());

                }
                if (f.getName().endsWith(XMLEXTENSION)){
                    String name=f.getName();
                    String urlName=Constants.REALCHARTS+"/"+index+"/"+TYPE_XML+"/"+URLEncoder.encode(name,"UTF-8");
                    Chart newChart=new Chart(Chart.TYPE_XML,activity, f,urlName,f.lastModified());
                    arr.put(urlName,newChart);
                    AvnLog.d(Constants.LOGPRFX,"readCharts: adding xml url "+urlName+" for "+f.getAbsolutePath());
                }
            } catch (Exception e) {
                Log.e(Constants.LOGPRFX, "exception handling file " + f.getAbsolutePath());
            }
        }
    }

    /**
     * download chart - only works for single file charts
     * otherwise we would pick up only the first file
     * @param name - ignored
     * @param uri - we expect an url parameter that has been filled by {@link Chart#toJson()}
     *              so it has charts/charts/index/typ/name
     * @return
     * @throws Exception
     */
    @Override
    public ExtendedWebResourceResponse handleDownload(String name, Uri uri) throws Exception {
        String url=AvnUtil.getMandatoryParameter(uri,"url");
        ParcelFileDescriptor fd=getFileFromUri(url,activity);
        if (fd == null) return null;
        return new ExtendedWebResourceResponse(fd.getStatSize(),
                "application/octet-stream",
                "",
                new FileInputStream(fd.getFileDescriptor()));
    }

    @Override
    public boolean handleUpload(PostVars postData, String name, boolean ignoreExisting) throws Exception {
        String safeName= DirectoryRequestHandler.safeName(name,true);
        if (! safeName.endsWith(GEMFEXTENSION) && ! safeName.endsWith(MBTILESEXTENSION) && ! safeName.endsWith(XMLEXTENSION))
            throw new Exception("only "+GEMFEXTENSION+" or "+MBTILESEXTENSION+" or "+XMLEXTENSION+" files allowed");
        File outFile=new File(getInternalChartsDir(activity),safeName);
        if (outFile.exists() && !ignoreExisting){
            throw new Exception("file already exists");
        }
        if (postData == null) throw new Exception("no data in file");
        File tmpFile=new File(outFile.getParent(),outFile.getName()+".tmp");
        FileOutputStream os= new FileOutputStream(tmpFile);
        postData.writeTo(os);
        os.close();
        boolean rt=tmpFile.renameTo(outFile);
        updateChartList();
        return rt;
    }

    @Override
    public JSONArray handleList(Uri uri, RequestHandler.ServerInfo serverInfo) throws Exception {
        //here we will have more dirs in the future...
        JSONArray rt=new JSONArray();
        try {
            for (String url : chartList.keySet()) {
                Chart chart = chartList.get(url);
                rt.put(chart.toJson());
            }
        } catch (Exception e) {
            Log.e(Constants.LOGPRFX, "exception reading chartlist:", e);
        }
        if (handler.getSharedPreferences().getBoolean(Constants.SHOWDEMO,false)){
            String demoCharts[]=activity.getAssets().list("charts");
            for (String demo: demoCharts){
                if (! demo.endsWith(".xml")) continue;
                String name=demo.replaceAll("\\.xml$", "");
                AvnLog.d(Constants.LOGPRFX,"found demo chart "+demo);
                String url="/"+ Constants.CHARTPREFIX+"/"+Constants.DEMOCHARTS+"/"+URLEncoder.encode(name,"UTF-8");
                JSONObject e = new JSONObject();
                e.put("name", name);
                e.put("url",url);
                e.put("charturl",url);
                e.put("canDelete",false);
                e.put("time", BuildConfig.TIMESTAMP/1000);
                rt.put(e);
            }
        }
        return rt;
    }

    @Override
    public boolean handleDelete(String name, Uri uri) throws Exception {
        if (uri == null){
            //only delete single files from internal dir
            String safeName= DirectoryRequestHandler.safeName(name,true);
            if (! safeName.endsWith(TYPE_GEMF) && ! safeName.endsWith(TYPE_MBTILES)) throw new Exception("only chart files allowed");
            for (Chart f: chartList.values()){
                if (f.isName(safeName)){
                    f.deleteFile();
                    updateChartList();
                }
            }
        }
        String charturl=AvnUtil.getMandatoryParameter(uri,"url");
        KeyAndParts kp=urlToKey(charturl,true);
        Chart chart= getChartDescription(kp.key);
        if (chart == null){
            return false;
        }
        else {
            File chartfile=chart.deleteFile();
            updateChartList();
            return chartfile != null;
        }
    }

    @Override
    public JSONObject handleApiRequest(Uri uri, PostVars postData, RequestHandler.ServerInfo serverInfo) throws Exception {
        String command=AvnUtil.getMandatoryParameter(uri,"command");
        if (command.equals("scheme")){
            String scheme=AvnUtil.getMandatoryParameter(uri,"newScheme");
            String url=AvnUtil.getMandatoryParameter(uri,"url");
            KeyAndParts kp=urlToKey(url,true);
            Chart chart= getChartDescription(kp.key);
            if (chart == null){
                return RequestHandler.getErrorReturn("chart not found");
            }
            chart.setScheme(scheme);
            return RequestHandler.getReturn();
        }
        return RequestHandler.getErrorReturn("unknown request");
    }




    @Override
    public ExtendedWebResourceResponse handleDirectRequest(String url) throws Exception {
        return handleChartRequest(url);
    }

    @Override
    public String getPrefix() {
        return CHARTPREFIX;
    }

    public static File getInternalChartsDir(Context ctx){
        File workDir=AvnUtil.getWorkDir(null,ctx);
        File chartDir = new File(workDir, "charts");
        return chartDir;
    }

    // charts/charts/index/type/name/avnav.xml|/src/z/x/y


    static class KeyAndParts{
        String key;
        String parts[];
        String originalParts[];
        boolean isDemo=false;
        KeyAndParts(String key,String parts[],int start){
            this.key=key;
            this.originalParts=parts;
            if (parts.length <= start){
                this.parts=new String[0];
            }
            else{
                this.parts=new String[parts.length-start];
                for (int i=0;i< parts.length-start;i++){
                    this.parts[i]=parts[i+start];
                }
            }
        }

    }

    /**
     * get the key and the remaining parts from the (decoded) url
     * @param url
     * @return
     * @throws Exception
     */
    private static KeyAndParts urlToKey(String url, boolean noDemo) throws Exception {
        url=url.replaceAll("^//*","");
        url=url.replaceAll("\\?.*", "");
        String parts[]=url.split("/");
        if (parts.length < 3) {
            throw new Exception("no chart url");
        }
        if (!parts[0].equals(CHARTPREFIX)){
            throw new Exception("no chart url");
        }
        if (parts[1].equals(DEMOCHARTS)){
            if (noDemo) throw new Exception("not permitted for demo charts");
            if (parts.length < 4) throw new Exception("invaldi chart url");
            KeyAndParts rt=new KeyAndParts(null,parts,2);
            rt.isDemo=true;
            return rt;
        }
        if (!parts[1].equals(REALCHARTS)){
            throw new Exception("no chart url");
        }
        if (!parts[3].equals(TYPE_MBTILES) && ! parts[3].equals(TYPE_GEMF) && ! parts[3].equals(TYPE_XML))
            throw new Exception("invalid chart type "+parts[3]);
        if (!parts[2].equals(INDEX_EXTERNAL) && ! parts[2].equals(INDEX_INTERNAL))
            throw new Exception("invalid chart index "+parts[2]);
        if (parts.length < 5) throw new Exception("invalid chart request " + url);
        //the name is url encoded in the key
        String key=parts[1]+"/"+parts[2]+"/"+parts[3]+"/"+parts[4];
        return new KeyAndParts(key,parts,5);
    }

    private ExtendedWebResourceResponse handleChartRequest(String fname) throws Exception {
        InputStream rt = null;
        KeyAndParts kp = urlToKey(fname,false);
        String mimeType = handler.mimeType(fname);
        int len = 0;
        try {
            if (kp.isDemo) {
                if (kp.parts[1].equals(CHARTOVERVIEW)) {
                    AvnLog.d(Constants.LOGPRFX, "overview request " + fname);
                    String safeName = DirectoryRequestHandler.safeName(kp.parts[0], true);
                    safeName += ".xml";
                    rt = activity.getAssets().open(Constants.CHARTPREFIX + "/" + safeName);
                    len = -1;
                    return new ExtendedWebResourceResponse(len, mimeType, "", rt);
                } else
                    throw new FileNotFoundException("unable to handle demo request for " + fname);
            }
            Chart chart = getChartDescription(kp.key);
            if (chart == null) {
                throw new Exception("request a file that is not in the list: " + fname);
            }
            if (kp.parts[0].equals(CHARTOVERVIEW)) {
                try {
                    return chart.getOverview();
                } catch (Exception e) {
                    Log.e(Constants.LOGPRFX, "unable to read chart file " + fname + ": " + e.getLocalizedMessage());
                }
            } else {
                if (chart.isXml()) throw new Exception("only overview for xml charts");
                if (kp.parts.length < 4) {
                    throw new Exception("invalid parameter for chart call " + fname);
                }
                int z = Integer.parseInt(kp.parts[1]);
                int x = Integer.parseInt(kp.parts[2]);
                int y = Integer.parseInt(kp.parts[3].replaceAll("\\.png", ""));
                return chart.getChartData(x, y, z, Integer.parseInt(kp.parts[0]));
            }

            Log.e(Constants.LOGPRFX, "unknown chart path " + fname);
        } catch (Exception e) {
            Log.e(Constants.LOGPRFX, "chart file " + fname + " not found: " + e.getLocalizedMessage());
        }
        return null;
    }
}
