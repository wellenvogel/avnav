package de.wellenvogel.avnav.charts;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.support.v4.provider.DocumentFile;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;

import de.wellenvogel.avnav.appapi.DirectoryRequestHandler;
import de.wellenvogel.avnav.appapi.ExtendedWebResourceResponse;
import de.wellenvogel.avnav.appapi.PostVars;
import de.wellenvogel.avnav.appapi.RequestHandler;
import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.appapi.INavRequestHandler;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;

import static de.wellenvogel.avnav.charts.Chart.CFG_EXTENSION;
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
    private static final String DEFAULT_CFG="default.cfg";
    private static final long MAX_CONFIG_SIZE=100000;
    private Context context;
    private RequestHandler handler;
    //mapping of url name to char descriptors
    private HashMap<String, Chart> chartList =new HashMap<String, Chart>();
    private boolean isStopped=false;

    public ChartHandler(Context a, RequestHandler h){
        handler=h;
        context =a;

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


    public void updateChartList(){
        HashMap<String, Chart> newGemfFiles=new HashMap<String, Chart>();
        SharedPreferences prefs=AvnUtil.getSharedPreferences(context);
        File workDir=AvnUtil.getWorkDir(prefs, context);
        File chartDir = getInternalChartsDir(context);
        readChartDir(chartDir.getAbsolutePath(), INDEX_INTERNAL,newGemfFiles);
        String secondChartDirStr=prefs.getString(Constants.CHARTDIR,"");
        if (! secondChartDirStr.isEmpty()){
            if (! secondChartDirStr.equals(workDir.getAbsolutePath())){
                readChartDir(secondChartDirStr, INDEX_EXTERNAL,newGemfFiles);
            }
        }
        if (handler.getSharedPreferences().getBoolean(Constants.SHOWDEMO,false)) {
            try {
                for (String demo : context.getAssets().list("charts")) {
                    if (!demo.endsWith(".xml")) continue;
                    String name = demo.replaceAll("\\.xml$", "");
                    DemoChart demoChart = new DemoChart(name, context);
                    newGemfFiles.put(demoChart.getChartKey(),demoChart);
                }
            }catch(Exception e){
                AvnLog.e("error when adding demo charts",e);
            }
        }
        boolean modified = false;
        synchronized (this) {
            //now we have all current charts - compare to the existing list and create/delete entries
            //currently we assume only one thread to change the chartlist...
            for (String url : newGemfFiles.keySet()) {
                Chart chart = newGemfFiles.get(url);
                long lastModified = chart.getLastModified();
                if (chartList.get(url) == null) {
                    chartList.put(url, chart);
                    modified = true;
                } else {
                    if (chartList.get(url).getLastModified() < lastModified) {
                        modified = true;
                        chartList.get(url).close();
                        chartList.put(url, chart);
                    }
                }
            }

            Iterator<String> it = chartList.keySet().iterator();
            while (it.hasNext()) {
                String url = it.next();
                if (newGemfFiles.get(url) == null) {
                    it.remove();
                    modified = true;
                } else {
                    Chart chart = chartList.get(url);
                    if (chart.closeInactive()) {
                        AvnLog.i("closing gemf file " + url);
                        modified = true;
                    }
                }
            }
        }
        if (modified){
            context.sendBroadcast(new Intent(Constants.BC_RELOAD_DATA));
            Thread overviewCreator=new Thread(new Runnable() {
                @Override
                public void run() {
                    AvnLog.i("creating chart overviews");
                    boolean readAgain=false;
                    for (Chart chart :chartList.values()){
                        try{
                            chart.computeOverview();
                        }catch (Throwable t){
                            AvnLog.e("error computing chart overview, deleting "+t);
                            if (chart.canDelete()){
                                try{
                                    chart.deleteFile();
                                    readAgain=true;
                                }catch (Throwable tdel){
                                    AvnLog.e("error deleting chart ",tdel);
                                }
                            }
                        }
                        if (isStopped) break;
                    }
                    AvnLog.i("done creating chart overviews");
                    if (readAgain){
                        AvnLog.i("errors when creating chart overview, files have been deleted - read again");
                        updateChartList();
                    }
                }
            });
            overviewCreator.setDaemon(true);
            overviewCreator.start();
        }
    }

    public Chart getChartDescription(String url){
        return chartList.get(url);
    }
    public Chart getChartDescriptionByChartKey(String key){
        if (key == null) return null;
        //we rely on the the key (url) being the same as our chart key
        return chartList.get(key);
    }

    private void readChartDir(String chartDirStr,String index,HashMap<String, Chart> arr) {
        if (chartDirStr == null) return;
        if (Build.VERSION.SDK_INT >= 21) {
            if (chartDirStr.startsWith("content:")) {
                //see https://github.com/googlesamples/android-DirectorySelection/blob/master/Application/src/main/java/com/example/android/directoryselection/DirectorySelectionFragment.java
                //and https://stackoverflow.com/questions/36862675/android-sd-card-write-permission-using-saf-storage-access-framework
                Uri dirUri = Uri.parse(chartDirStr);
                DocumentFile dirFile=DocumentFile.fromTreeUri(context,dirUri);
                for (DocumentFile f : dirFile.listFiles()){
                    try {
                        if (f.getName().endsWith(GEMFEXTENSION)) {
                            String urlName = Constants.REALCHARTS + "/" + index + "/"+TYPE_GEMF+"/" + URLEncoder.encode(f.getName(), "UTF-8");
                            arr.put(urlName, new Chart(Chart.TYPE_GEMF, context, f, urlName, f.lastModified()));
                            AvnLog.d(Constants.LOGPRFX, "readCharts: adding gemf url " + urlName + " for " + f.getUri());
                        }
                        if (f.getName().endsWith(MBTILESEXTENSION)){
                            //we cannot handle this!
                            AvnLog.e("unable to read mbtiles from external dir: "+f.getName());
                        }
                        if (f.getName().endsWith(XMLEXTENSION)) {
                            String name = f.getName();
                            String urlName = Constants.REALCHARTS + "/" + index + "/"+TYPE_XML+"/" + URLEncoder.encode(name, "UTF-8");
                            Chart newChart = new Chart(Chart.TYPE_XML, context, f, urlName, f.lastModified());
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
                    arr.put(urlName,new Chart(Chart.TYPE_GEMF, context, f,urlName,f.lastModified()));
                    AvnLog.d(Constants.LOGPRFX,"readCharts: adding gemf url "+urlName+" for "+f.getAbsolutePath());
                }
                if (f.getName().endsWith(MBTILESEXTENSION)){
                    String name = f.getName();
                    String urlName= Constants.REALCHARTS + "/"+index+"/"+TYPE_MBTILES+"/" + URLEncoder.encode(name,"UTF-8");
                    arr.put(urlName,new Chart(Chart.TYPE_MBTILES, context, f,urlName,f.lastModified()));
                    AvnLog.d(Constants.LOGPRFX,"readCharts: adding mbtiles url "+urlName+" for "+f.getAbsolutePath());

                }
                if (f.getName().endsWith(XMLEXTENSION)){
                    String name=f.getName();
                    String urlName=Constants.REALCHARTS+"/"+index+"/"+TYPE_XML+"/"+URLEncoder.encode(name,"UTF-8");
                    Chart newChart=new Chart(Chart.TYPE_XML, context, f,urlName,f.lastModified());
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
        ParcelFileDescriptor fd=getFileFromUri(url, context);
        if (fd == null) return null;
        return new ExtendedWebResourceResponse(fd.getStatSize(),
                "application/octet-stream",
                "",
                new FileInputStream(fd.getFileDescriptor()));
    }

    @Override
    public boolean handleUpload(PostVars postData, String name, boolean ignoreExisting) throws Exception {
        String safeName= DirectoryRequestHandler.safeName(name,true);
        if (! safeName.endsWith(GEMFEXTENSION) && ! safeName.endsWith(MBTILESEXTENSION)
                && ! safeName.endsWith(XMLEXTENSION) && ! safeName.endsWith(CFG_EXTENSION))
            throw new Exception("only "+GEMFEXTENSION+" or "+MBTILESEXTENSION+" or "+XMLEXTENSION+" or "+CFG_EXTENSION+" files allowed");
        File outFile=new File(getInternalChartsDir(context),safeName);
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
        AvnLog.i(Constants.LOGPRFX,"start chartlist request "+Thread.currentThread().getId());
        JSONArray rt=new JSONArray();
        try {
            for (String url : chartList.keySet()) {
                Chart chart = chartList.get(url);
                try {
                    rt.put(chart.toJson());
                }catch (Throwable t){
                    AvnLog.e("error reading chart "+url,t);
                }
            }
        } catch (Exception e) {
            Log.e(Constants.LOGPRFX, "exception reading chartlist:", e);
        }
        AvnLog.i(Constants.LOGPRFX,"finish chartlist request "+Thread.currentThread().getId());
        return rt;
    }

    @Override
    public boolean handleDelete(String name, Uri uri) throws Exception {
        if (name.endsWith(CFG_EXTENSION)){
            name=DirectoryRequestHandler.safeName(name,true);
            File cfgFile=new File(getInternalChartsDir(this.context),name);
            if (cfgFile.isFile()){
                return cfgFile.delete();
            }
            return false;
        }
        String charturl=AvnUtil.getMandatoryParameter(uri,"url");
        KeyAndParts kp=urlToKey(charturl,true);
        Chart chart= getChartDescription(kp.key);
        if (chart == null){
            return false;
        }
        else {
            File chartfile=chart.deleteFile();
            String cfgName=chart.getConfigName();
            File cfgFile=new File(getInternalChartsDir(this.context),cfgName);
            if (cfgFile.exists()) cfgFile.delete();
            deleteFromOverlays("chart",chart.getChartKey());
            updateChartList();
            return chartfile != null;
        }
    }

    private static void merge(JSONObject target, JSONObject source, List<String> blacklist) throws JSONException {
        for (Iterator<String> it = source.keys(); it.hasNext(); ) {
            String sk = it.next();
            if (blacklist.contains(sk)) continue;
            target.put(sk,source.get(sk));
        }
    }

    /**
     * delete an entry from the overlay configs
     * @param type
     * @param name
     */
    public int deleteFromOverlays(String type, String name){
        int numChanges=0;
        if (type == null || name == null) return numChanges;
        File baseDir=getInternalChartsDir(this.context);
        for (File f : baseDir.listFiles()){
            if (!f.getName().endsWith(CFG_EXTENSION)) continue;
            try{
                JSONObject config=AvnUtil.readJsonFile(f,MAX_CONFIG_SIZE);
                if (!config.has("overlays")) continue;
                JSONArray overlays=config.getJSONArray("overlays");
                JSONArray newOverlays=new JSONArray();
                boolean hasChanges=false;
                for (int i=0;i<overlays.length();i++){
                    JSONObject overlay=overlays.getJSONObject(i);
                    if (type.equals(overlay.optString("type"))) {
                        String overlayName = type.equals("chart") ? overlay.optString("chartKey") : overlay.optString("name");
                        if (name.equals(overlayName)){
                            AvnLog.d("removing overlay "+name+" from "+f.getAbsolutePath());
                            hasChanges=true;
                            continue;
                        }
                    }
                    newOverlays.put(overlay);
                }
                if (hasChanges){
                    config.put("overlays",newOverlays);
                    numChanges++;
                    FileOutputStream fout=new FileOutputStream(f);
                    fout.write(config.toString(2).getBytes(StandardCharsets.UTF_8));
                    fout.close();
                }
            } catch(Exception e){
                AvnLog.e("error reading/updating overlay config "+f.getAbsolutePath(),e);
                continue;
            }
        }
        return numChanges;
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
        if (command.equals("getConfig")){
            String configName=DirectoryRequestHandler.safeName(AvnUtil.getMandatoryParameter(uri,"overlayConfig"),true);
            boolean expandCharts=AvnUtil.getFlagParameter(uri,"expandCharts",false);
            boolean mergeDefault=AvnUtil.getFlagParameter(uri,"mergeDefault",false);
            if (configName.equals(DEFAULT_CFG)) mergeDefault=false;
            File cfgFile=new File(getInternalChartsDir(this.context),configName);
            JSONObject localConfig=new JSONObject();
            JSONObject globalConfig=new JSONObject();
            if (cfgFile.exists()){
                try{
                    localConfig=AvnUtil.readJsonFile(cfgFile,MAX_CONFIG_SIZE);
                }
                catch (Exception e){
                    AvnLog.e("unable to read chart config "+cfgFile.getAbsolutePath(),e);
                }
            }
            localConfig.put("name",configName);
            File globalCfgFile=new File(getInternalChartsDir(this.context),DEFAULT_CFG);
            if (mergeDefault && globalCfgFile.exists()){
                try{
                    globalConfig=AvnUtil.readJsonFile(globalCfgFile,MAX_CONFIG_SIZE);
                }
                catch (Exception e){
                    AvnLog.e("unable to read default chart config "+globalCfgFile.getAbsolutePath(),e);
                }
                if (globalConfig.has("overlays")){
                    localConfig.put("defaults",globalConfig.get("overlays"));
                }
            }
            if (expandCharts){
                List<String> blackList= Arrays.asList("type", "chartKey", "opacity", "chart");
                String[] expandKeys=new String[]{"overlays","defaults"};
                for (String key : expandKeys){
                    if (! localConfig.has(key)) continue;
                    JSONArray overlays=localConfig.getJSONArray(key);
                    JSONArray newOverlays=new JSONArray();
                    for (int idx=0;idx<overlays.length();idx++){
                        JSONObject overlay=overlays.getJSONObject(idx);
                        if (overlay.has("type") && "chart".equals(overlay.getString("type"))){
                            Chart chart=getChartDescriptionByChartKey(overlay.optString("chartKey"));
                            if (chart != null){
                                merge(overlay,chart.toJson(),blackList);
                            }
                            else{
                                continue; //skip this entry in the returned list
                            }
                        }
                        newOverlays.put(overlay);
                    }
                    localConfig.put(key,newOverlays);
                }
            }
            JSONObject rt=new JSONObject();
            rt.put("status","OK");
            rt.put("data",localConfig);
            return rt;
        }
        if (command.equals("listOverlays")){
           JSONArray rt=new JSONArray();
            File baseDir=getInternalChartsDir(this.context);
            for (File f : baseDir.listFiles()) {
                if (!f.getName().endsWith(CFG_EXTENSION)) continue;
                JSONObject overlay=new JSONObject();
                overlay.put("name",f.getName());
                rt.put(overlay);
            }
            return RequestHandler.getReturn(new AvnUtil.KeyValue("data",rt));

        }
        return RequestHandler.getErrorReturn("unknown request");
    }




    @Override
    public ExtendedWebResourceResponse handleDirectRequest(Uri uri, RequestHandler handler, String method) throws Exception {
        return handleChartRequest(uri);
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
            if (parts.length < 4) throw new Exception("invalid chart url");
            String key=parts[1]+"/"+parts[2];
            KeyAndParts rt=new KeyAndParts(key,parts,3);
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

    private ExtendedWebResourceResponse handleChartRequest(Uri uri) throws Exception {
        String fname=uri.getPath();
        if (fname == null) return null;
        KeyAndParts kp = urlToKey(fname,false);
        try {
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
            } else if (kp.parts[0].equals("sequence")){
                JSONObject sq= RequestHandler.getReturn(new AvnUtil.KeyValue("sequence",chart.getSequence()));
                byte o[]=sq.toString().getBytes("UTF-8");
                return new ExtendedWebResourceResponse(o.length,"application/json","UTF-8",new ByteArrayInputStream(o));
            }
            else{
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
