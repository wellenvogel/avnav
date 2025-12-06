package de.wellenvogel.avnav.charts;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FilenameFilter;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.net.URLDecoder;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Objects;

import androidx.documentfile.provider.DocumentFile;
import de.wellenvogel.avnav.appapi.DirectoryRequestHandler;
import de.wellenvogel.avnav.appapi.ExtendedWebResourceResponse;
import de.wellenvogel.avnav.appapi.PostVars;
import de.wellenvogel.avnav.appapi.RequestHandler;
import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;

import static de.wellenvogel.avnav.charts.Chart.CFG_EXTENSION;
import static de.wellenvogel.avnav.main.Constants.CHARTOVERVIEW;
import static de.wellenvogel.avnav.main.Constants.CHARTPREFIX;
import static de.wellenvogel.avnav.main.Constants.DEMOCHARTS;
import static de.wellenvogel.avnav.main.Constants.LOGPRFX;
import static de.wellenvogel.avnav.main.Constants.REALCHARTS;


public class ChartHandler extends RequestHandler.NavRequestHandlerBase {

    static class OverlayConfig{
        File file;
        public OverlayConfig(File f){
            file=f;
        }
    }

    static class ExternalChart implements IChartWithConfig{
        String key;
        String chartKey;
        JSONObject chart;
        boolean allowColon;
        String sourceName;
        public ExternalChart(String key,String sourceName,JSONObject chart,boolean allowColon) throws Exception {
            this.key=key;
            this.chart=new JSONObject(chart.toString());
            chartKey=keyFromExternalChart();
            if (this.chart.has(Chart.CKEY)){
                this.chart.put(Chart.DPNAME_KEY,this.chart.getString(Chart.CKEY));
                this.chart.remove(Chart.CKEY);
            }
            if (this.chart.has(Chart.EXT_CKEY)) {
                this.chart.put(Chart.CKEY, Constants.EXTERNALCHARTS + ":" + chartKey);
                this.chart.remove(Chart.EXT_CKEY);
            }
            this.chart.put("info",sourceName);
            this.allowColon=allowColon;
            this.sourceName=sourceName;
        }
        private String keyFromExternalChart() throws Exception {
            String original=null;
            if (chart.has(Chart.EXT_CKEY)) {
                original = chart.getString(Chart.EXT_CKEY);
            }
            else if(chart.has(Chart.CKEY)) {
                original = chart.getString(Chart.CKEY);
            }
            if (original == null) throw new JSONException("external chart without key"+ chart);
            String configName=key + "@" + DirectoryRequestHandler.safeName(original, false);
            return configName;
        }
        @Override
        public List<String> getChartCfgs() {
            ArrayList<String> rt=new ArrayList<>();
            try {
                String first=DirectoryRequestHandler.safeName(chartKey,false)+CFG_EXTENSION;
                if (!allowColon) first=first.replace(':','.');
                rt.add(first);
            } catch (Exception e) {
                //should never occur as safeName only throws when required
            }

            for (String ckey: new String[]{Chart.DPNAME_KEY}){
                if (! chart.has(ckey)) continue;
                String name= null;
                try {
                    name = key+"@"+ DirectoryRequestHandler.safeName(chart.getString(ckey),false);
                } catch (Exception e) {
                    continue;
                }
                if (!allowColon) name=name.replace(':','.');
                rt.add(name+CFG_EXTENSION);
            }
            return rt;
        }

        @Override
        public String getChartKey() {
            return chartKey;
        }

        @Override
        public JSONObject toJson() throws JSONException, UnsupportedEncodingException {
            return new JSONObject(chart.toString());
        }
    }
    private static final String GEMFEXTENSION =".gemf";
    private static final String MBTILESEXTENSION =".mbtiles";
    private static final String XMLEXTENSION=".xml";
    private static final String DEFAULT_CFG="default.cfg";
    private static final long MAX_CONFIG_SIZE=100000;
    private Context context;
    private RequestHandler handler;
    //mapping of url name to char descriptors
    private HashMap<String, Chart> chartList =new HashMap<String, Chart>();
    private HashMap<String,OverlayConfig> overlays=new HashMap<String,OverlayConfig>();
    private boolean isStopped=false;
    private final HashMap<String,List<ExternalChart>> externalCharts= new HashMap<>();
    private Thread chartUpdater;
    private final Object chartHandlerMonitor=new Object();
    private boolean loading=true;
    private long updateSequence=0;

    private boolean allowColon=true;
    File baseDir;

    public ChartHandler(Context a, RequestHandler h){
        handler=h;
        context =a;
        SharedPreferences sharedPrefs=context.getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        try{
            allowColon=!sharedPrefs.getBoolean(Constants.WORKDIR_NOCOLON,false);
        }catch (Throwable t){
            AvnLog.e("unable to get nocolon from prefs",t);
        }
        AvnLog.i(LOGPRFX,"ChartHandler: allowColon="+allowColon);
        baseDir=getInternalChartsDir(context);
        startUpdater();
    }

    private void triggerUpdate(boolean wait){
        long currentSequence=-1;
        synchronized (chartHandlerMonitor){
            currentSequence=updateSequence;
            chartHandlerMonitor.notifyAll();
        }
        if (! wait) return;
        long waitTime=30*50; //30s
        while (currentSequence == updateSequence){
            waitTime--;
            if (waitTime <= 0) return;
            synchronized (chartHandlerMonitor){
                try {
                    chartHandlerMonitor.wait(20);
                } catch (InterruptedException e) {
                    return;
                }
            }
        }
    }

    public void startUpdater(){
        if (chartUpdater != null){
            if (chartUpdater.isAlive()) {
                chartUpdater.interrupt();
            }
            chartUpdater=null;
        }
        chartUpdater = new Thread(new Runnable() {
            @Override
            public void run() {
                AvnLog.i("RequestHandler: chartHandler thread is starting");
                while (!isStopped) {
                    updateChartList();
                    try {
                        synchronized (chartHandlerMonitor){
                            updateSequence++;
                            chartHandlerMonitor.wait(5000);
                        }
                    } catch (InterruptedException e) {
                        break;
                    }
                }
                AvnLog.i("RequestHandler: chartHandler thread is stopping");
            }
        });
        chartUpdater.setDaemon(true);
        chartUpdater.start();
    }

    public void stop(){
        isStopped=true;
        triggerUpdate(false);
    }

    public void removeExternalCharts(String key){
        synchronized (externalCharts){
            externalCharts.remove(key);
        }
    }
    public void addExternalCharts(String key, JSONArray charts,String name){
        ArrayList<ExternalChart> extCharts=new ArrayList<>();
        for (int i=0;i<charts.length();i++){
            try{
                ExternalChart echart=new ExternalChart(key,name,charts.getJSONObject(i),allowColon);
                extCharts.add(echart);
            } catch (Exception e) {
                AvnLog.e("unable to add external chart ",e);
            }
        }
        synchronized (externalCharts){
            externalCharts.put(key,extCharts);
        }
    }

    /**
     * we rely on this method only be called with one thread
     */
    public void updateChartList(){
        HashMap<String, Chart> newGemfFiles=new HashMap<String, Chart>();
        HashMap<String, Chart> currentCharts=chartList; //atomic
        HashMap<String, Chart> workingCharts=new HashMap<>(currentCharts); //make a copy to save with atomic at the end
        HashMap<String,OverlayConfig> overlays=new HashMap<String,OverlayConfig>();
        SharedPreferences prefs=AvnUtil.getSharedPreferences(context);
        File workDir=AvnUtil.getWorkDir(prefs, context);
        File chartDir = baseDir;
        //read overlays
        try {
            if (chartDir.isDirectory()) {
                for (File f : Objects.requireNonNull(chartDir.listFiles(new FilenameFilter() {
                    @Override
                    public boolean accept(File dir, String name) {
                        return name.endsWith(CFG_EXTENSION);
                    }
                }))) {
                    overlays.put(f.getName(), new OverlayConfig(f));
                }
            }
        }catch (NullPointerException n){
            AvnLog.e("unable to read overlays",n);
        }
        this.overlays=overlays; //atomic replace
        readChartDir(chartDir.getAbsolutePath(), Chart.INDEX_INTERNAL,newGemfFiles);
        String secondChartDirStr=prefs.getString(Constants.CHARTDIR,"");
        if (! secondChartDirStr.isEmpty()){
            if (! secondChartDirStr.equals(workDir.getAbsolutePath())){
                readChartDir(secondChartDirStr, Chart.INDEX_EXTERNAL,newGemfFiles);
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
        final ArrayList<Chart> modifiedCharts=new ArrayList<>();
        synchronized (this) {
            //now we have all current charts - compare to the existing list and create/delete entries
            //currently we assume only one thread to change the chartlist...
            for (String url : newGemfFiles.keySet()) {
                Chart chart = newGemfFiles.get(url);
                long lastModified = chart.getLastModified();
                if (workingCharts.get(url) == null) {
                    workingCharts.put(url, chart);
                    modifiedCharts.add(chart);
                    modified = true;
                } else {
                    if (workingCharts.get(url).getLastModified() < lastModified) {
                        modified = true;
                        workingCharts.get(url).close();
                        workingCharts.put(url, chart);
                        modifiedCharts.add(chart);
                    }
                }
            }

            Iterator<String> it = workingCharts.keySet().iterator();
            while (it.hasNext()) {
                String url = it.next();
                if (newGemfFiles.get(url) == null) {
                    it.remove();
                    modified = true;
                } else {
                    Chart chart = workingCharts.get(url);
                    if (chart.closeInactive()) {
                        AvnLog.i("closing gemf file " + url);
                        modified = true;
                    }
                }
            }
        }
        if (modified){
            for (Chart chart:modifiedCharts){
                try {
                    //open the chart file - this can be time consuming
                    if (! chart.isXml()) chart.getChartFileReader();
                } catch (Exception e) {
                    AvnLog.e("error getting file reader for "+chart.getChartKey(),e);
                }
            }
            Thread overviewCreator=new Thread(new Runnable() {
                @Override
                public void run() {
                    AvnLog.i("creating chart overviews");
                    boolean readAgain=false;
                    for (Chart chart :modifiedCharts){
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
                        triggerUpdate(false);
                    }
                }
            });
            overviewCreator.setDaemon(true);
            overviewCreator.start();
        }
        chartList=workingCharts; //atomic replace of the current list
        loading=false;
    }

    /**
     * get an own chart
     * for global: getChartDescriptionByChartKey
     *
     * @param name the chart key
     * @return
     */
    public synchronized Chart getChartDescription(String name){
        HashMap<String,Chart> currentCharts=chartList; //atomic
        return currentCharts.get(name);
    }
    public synchronized IChartWithConfig getChartDescriptionByChartKey(String key) {
        if (key == null) return null;
        if (key.startsWith(Constants.EXTERNALCHARTS)){
            int el=Constants.EXTERNALCHARTS.length();
            if (key.length() < (el+2)) return null;
            key=key.substring(el+1);
            int sidx=key.indexOf('@');
            if (sidx < 0 || sidx >= (key.length()-1)) return null;
            String mapKey=key.substring(0,sidx);
            synchronized (externalCharts) {
                List<ExternalChart> charts =externalCharts.get(mapKey);
                if (charts == null) return null;
                for (ExternalChart e:charts){
                    if (key.equals(e.getChartKey())){
                        return e;
                    }
                }
            }
            return null;
        }
        else {
            Chart chart=getChartDescription(key);
            if (chart == null) return null;
            return chart;
        }
    }

    private JSONObject chartDescriptionToJson(IChartWithConfig chartDescription, RequestHandler.ServerInfo serverInfo){
        if (chartDescription == null) return null;
        try {
            JSONObject rt=chartDescription.toJson();
            if (serverInfo != null) {
                for (String ok : REPLACE_KEYS) {
                    if (rt.has(ok)) {
                        String value = rt.getString(ok);
                        value=serverInfo.replaceHostInUrl(value);
                        rt.put(ok, value);
                    }
                }
            }
            if (! rt.has(Chart.HASOVL_KEY)){
                rt.put(Chart.HASOVL_KEY,getChartCfg(chartDescription) != null);
            }
            return rt;
        } catch (Exception e) {
            return null;
        }
    }

    private void readChartDir(String chartDirStr,String index,HashMap<String, Chart> arr) {
        if (chartDirStr == null) return;
        if (Build.VERSION.SDK_INT >= 21) {
            if (chartDirStr.startsWith("content:")) {
                //see https://github.com/googlesamples/android-DirectorySelection/blob/master/Application/src/main/java/com/example/android/directoryselection/DirectorySelectionFragment.java
                //and https://stackoverflow.com/questions/36862675/android-sd-card-write-permission-using-saf-storage-access-framework
                Uri dirUri = Uri.parse(chartDirStr);
                DocumentFile dirFile = DocumentFile.fromTreeUri(context, dirUri);
                if (dirFile != null) {
                    for (DocumentFile f : dirFile.listFiles()) {
                        try {
                            Chart newChart=null;
                            if (f.getName() == null) continue;
                            if (f.getName().startsWith(DirectoryRequestHandler.TMP_PRFX)) continue;
                            if (f.getName().endsWith(GEMFEXTENSION)) {
                                newChart = new Chart(Chart.TYPE_GEMF, context, f, index, f.lastModified());
                            }
                            if (f.getName().endsWith(MBTILESEXTENSION)) {
                                //we cannot handle this!
                                AvnLog.e("unable to read mbtiles from external dir: " + f.getName());
                            }
                            if (f.getName().endsWith(XMLEXTENSION)) {
                                newChart = new Chart(Chart.TYPE_XML, context, f, index, f.lastModified());
                            }
                            if (newChart != null){
                                arr.put(newChart.getChartKey(), newChart);
                                AvnLog.d(Constants.LOGPRFX, "readCharts: adding chart" + newChart);
                            }
                        } catch (Throwable t) {
                            AvnLog.e("unable to handle chart " + f.getName() + ": " + t.getLocalizedMessage());
                        }
                    }
                    return;
                }
            }
        }
        File chartDir=new File(chartDirStr);
        if (! chartDir.isDirectory()) return;
        File[] files=chartDir.listFiles();
        if (files == null) return;
        for (File f : files) {
            if (f.getName().startsWith(DirectoryRequestHandler.TMP_PRFX)) continue;
            try {
                Chart newChart=null;
                if (f.getName().endsWith(GEMFEXTENSION)){
                    newChart=new Chart(Chart.TYPE_GEMF, context, f,index,f.lastModified());
                }
                if (f.getName().endsWith(MBTILESEXTENSION)){
                    newChart=new Chart(Chart.TYPE_MBTILES, context, f,index,f.lastModified());

                }
                if (f.getName().endsWith(XMLEXTENSION)){
                    newChart=new Chart(Chart.TYPE_XML, context, f,index,f.lastModified());
                }
                if (newChart != null){
                    arr.put(newChart.getChartKey(),newChart);
                    AvnLog.d(Constants.LOGPRFX,"readCharts: adding chart"+newChart.toString()+" for "+f.getAbsolutePath());
                }
            } catch (Exception e) {
                Log.e(Constants.LOGPRFX, "exception handling file " + f.getAbsolutePath());
            }
        }
    }

    /**
     * download chart - only works for single file charts
     * otherwise we would pick up only the first file
     * does not work for plugin charts
     * @param name - the chart key
     * @param uri - other parameters (ignored)
     * @return {{@link ExtendedWebResourceResponse}}
     * @throws Exception
     */
    @Override
    public ExtendedWebResourceResponse handleDownload(String name, Uri uri) throws Exception {
        Chart chart=getChartDescription(name);
        if (chart == null){
            throw new IOException("chart "+name+" not found for download");
        }
        return chart.getDownload(context);
    }

    @Override
    public boolean handleUpload(PostVars postData, String name, boolean ignoreExisting, boolean completeName) throws Exception {
        String safeName= DirectoryRequestHandler.safeName(name,true);
        if (! safeName.endsWith(GEMFEXTENSION) && ! safeName.endsWith(MBTILESEXTENSION)
                && ! safeName.endsWith(XMLEXTENSION) && ! safeName.endsWith(CFG_EXTENSION))
            throw new Exception("only "+GEMFEXTENSION+" or "+MBTILESEXTENSION+" or "+XMLEXTENSION+" or "+CFG_EXTENSION+" files allowed");
        File outFile=new File(baseDir,safeName);
        if (postData == null) throw new Exception("no data in file");
        DirectoryRequestHandler.writeAtomic(outFile,postData.getStream(),ignoreExisting,postData.getContentLength());
        postData.closeInput();
        triggerUpdate(true);
        return true;
    }

    @Override
    public JSONObject handleInfo(String name, Uri uri, RequestHandler.ServerInfo serverInfo) throws Exception {
        if (name == null) return new JSONObject();
        IChartWithConfig item=getChartDescriptionByChartKey(name);
        return chartDescriptionToJson(item,serverInfo);
    }

    private static final String[] REPLACE_KEYS=new String[]{"url","tokenUrl","icon"};

    private File getChartCfg(IChartWithConfig chart){
        HashMap<String,OverlayConfig> current=overlays; //atomic
        for (String s:chart.getChartCfgs()){
            OverlayConfig ovl=current.get(s);
            if (ovl != null) return ovl.file;
        }
        return null;
    }

    @Override
    public JSONObject handleListExtended(Uri uri, RequestHandler.ServerInfo serverInfo) throws Exception {
        //here we will have more dirs in the future...
        AvnLog.i(Constants.LOGPRFX,"start chartlist request "+Thread.currentThread().getId());
        JSONArray rt=new JSONArray();
        HashMap<String,Chart> currentCharts=chartList; //atomic
        try {
            for (Chart chart : currentCharts.values()) {
                try {
                    rt.put(chartDescriptionToJson(chart,serverInfo));
                }catch (Throwable t){
                    AvnLog.e("error reading chart "+chart,t);
                }
            }
        } catch (Exception e) {
            Log.e(Constants.LOGPRFX, "exception reading chartlist:", e);
        }
        try{
            synchronized (externalCharts){
                for (String key:externalCharts.keySet()){
                    try {
                        List<ExternalChart> charts = externalCharts.get(key);
                        if (charts == null) continue;
                        for (ExternalChart chartDescription:charts) {
                            try {
                                JSONObject o=chartDescriptionToJson(chartDescription,serverInfo);
                                rt.put(o);
                            }catch (Exception e){
                                AvnLog.e("error in external chart def "+chartDescription,e);
                            }
                        }
                    }catch (Exception x){
                        Log.e(Constants.LOGPRFX,"error in external charts for "+key,x);
                    }
                }
            }
        }catch (Exception e){
            Log.e(Constants.LOGPRFX,"exception adding external charts:",e);
        }
        AvnLog.i(Constants.LOGPRFX,"finish chartlist request "+Thread.currentThread().getId());
        return RequestHandler.getReturn(new AvnUtil.KeyValue<JSONArray>("items",rt), new AvnUtil.KeyValue<Boolean>("loading",loading));
    }

    @Override
    public boolean handleDelete(String name, Uri uri) throws Exception {
        if (name.endsWith(CFG_EXTENSION)){
            name=DirectoryRequestHandler.safeName(name,true);
            File cfgFile=new File(baseDir,name);
            if (cfgFile.isFile()){
                return cfgFile.delete();
            }
            return false;
        }
        Chart chart= getChartDescription(name);
        if (chart == null){
            return false;
        }
        else {
            if (! chart.canDelete()){
                throw new Exception("chart "+name+" cannot be deleted");
            }
            File chartfile=chart.deleteFile();
            List<String> cfgNames=chart.getChartCfgs();
            for (String cfgName:cfgNames) {
                File cfgFile = new File(baseDir, cfgName);
                if (cfgFile.exists()) cfgFile.delete();
            }
            triggerUpdate(true);
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
     * will migrate the naming and tries to replace chart names
     * no copy
     * @param config
     * @return
     */
    private JSONObject migrateConfig(String name,JSONObject config) throws JSONException {
            config.put("name",name);
            config.put("defaults",new JSONArray());
            if (config.has("overlays")){
                JSONArray overlays=config.getJSONArray("overlays");
                for (int i=0;i<overlays.length();i++){
                    JSONObject overlay=overlays.getJSONObject(i);
                    if ("chart".equals(overlay.optString("type"))){
                        String chartKey=overlay.optString("chartKey",null);
                        String cname=overlay.optString("name",null);
                        if (chartKey != null){
                            overlay.remove("chartKey");
                            if (cname != null && ! overlay.has("displayName")){
                                overlay.put("displayName",cname);
                            }
                            overlay.put("name",chartKey);
                        }
                    }
                }
            }
            return config;
    }
    private static String CGETCONFIG="getConfig";
    private static String CSAVECONFIG="saveConfig";
    private static String CDELCONFIG="deleteConfig";
    @Override
    public JSONObject handleApiRequest(String command, Uri uri, PostVars postData, RequestHandler.ServerInfo serverInfo) throws Exception {
        if (command.equals("scheme")){
            String name=AvnUtil.getMandatoryParameter(uri,"name");
            String scheme=AvnUtil.getMandatoryParameter(uri,"newScheme");
            Chart chart= getChartDescription(name);
            if (chart == null){
                return RequestHandler.getErrorReturn("chart not found");
            }
            chart.setScheme(scheme);
            return RequestHandler.getReturn();
        }
        if (command.equals(CGETCONFIG) || command.equals(CSAVECONFIG) || command.equals(CDELCONFIG)){
            String name=uri.getQueryParameter("name");
            File cfgFile=null;
            String configName=null;
            List<String> cfgNames= Collections.emptyList();
            if (name == null){
                //default
                configName=DEFAULT_CFG;
                cfgFile=new File(baseDir,configName);
                cfgNames=Collections.singletonList(configName);
            }
            else{
                IChartWithConfig description=getChartDescriptionByChartKey(name);
                if (description == null) {
                    return RequestHandler.getErrorReturn("chart "+name+" not found");
                }
                cfgNames=description.getChartCfgs();
                if (cfgNames.isEmpty())return RequestHandler.getErrorReturn("no config name for "+name);
                if (command.equals(CGETCONFIG)) {
                    if (cfgNames.size() > 0){
                        configName=cfgNames.get(0);
                    }
                    for (String n : cfgNames) {
                        OverlayConfig cfg = overlays.get(n);
                        if (cfg != null) {
                            cfgFile = cfg.file;
                            break;
                        }
                    }
                }
                else{
                    configName=cfgNames.get(0);
                    cfgFile=new File(baseDir,configName);
                }
            }
            if (command.equals(CDELCONFIG)){
                for (String oname:cfgNames){
                    OverlayConfig ovl=overlays.get(oname);
                    if (ovl != null){
                        ovl.file.delete();
                    }
                }
                triggerUpdate(true);
                return RequestHandler.getReturn();
            }
            if (configName == null){
                return RequestHandler.getErrorReturn("no config for chart "+name);
            }
            if (command.equals(CSAVECONFIG)){
                if (postData == null) throw new Exception("no data in file");
                DirectoryRequestHandler.writeAtomic(cfgFile,postData.getStream(),true,postData.getContentLength());
                postData.closeInput();
                if (cfgNames.size() > 1){
                    for (int i=1;i<cfgNames.size();i++){
                        File old=new File(baseDir,cfgNames.get(i));
                        if (old.exists()) old.delete();
                    }
                }
                triggerUpdate(true);
                return RequestHandler.getReturn();
            }
            else {
                JSONObject localConfig = new JSONObject();
                if (cfgFile != null && cfgFile.exists()) {
                    try {
                        localConfig = AvnUtil.readJsonFile(cfgFile, MAX_CONFIG_SIZE);
                    } catch (Exception e) {
                        AvnLog.e("unable to read chart config " + cfgFile.getAbsolutePath(), e);
                    }
                }
                migrateConfig(configName,localConfig);
                return RequestHandler.getReturn(new AvnUtil.KeyValue<JSONObject>("data", localConfig));
            }
        }
        if (command.equals("listOverlays")){
           JSONArray rt=new JSONArray();
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
    private static KeyAndParts urlToKey(String url, boolean noDemo,boolean needsDecode) throws Exception {
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
        if (!parts[3].equals(Chart.STYPE_MBTILES) && ! parts[3].equals(Chart.STYPE_GEMF) && ! parts[3].equals(Chart.STYPE_XML))
            throw new Exception("invalid chart type "+parts[3]);
        if (!parts[2].equals(Chart.INDEX_EXTERNAL) && ! parts[2].equals(Chart.INDEX_INTERNAL))
            throw new Exception("invalid chart index "+parts[2]);
        if (parts.length < 5) throw new Exception("invalid chart request " + url);
        //the name is url encoded in the key
        String name=needsDecode?URLDecoder.decode(parts[4], "UTF-8"):parts[4];
        String key=parts[1]+"/"+parts[2]+"/"+parts[3]+"/"+ name;
        return new KeyAndParts(key,parts,5);
    }

    private ExtendedWebResourceResponse handleChartRequest(Uri uri) throws Exception {
        String fname=uri.getPath();
        if (fname == null) return null;
        KeyAndParts kp = urlToKey(fname,false,false);
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
