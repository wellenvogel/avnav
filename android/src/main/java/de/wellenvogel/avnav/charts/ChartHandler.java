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
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Objects;

import androidx.documentfile.provider.DocumentFile;
import de.wellenvogel.avnav.appapi.DirectoryRequestHandler;
import de.wellenvogel.avnav.appapi.ExtendedWebResourceResponse;
import de.wellenvogel.avnav.appapi.IPluginAware;
import de.wellenvogel.avnav.appapi.PostVars;
import de.wellenvogel.avnav.appapi.RequestHandler;
import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.util.MeasureTimer;
import de.wellenvogel.avnav.worker.IPluginHandler;

import static de.wellenvogel.avnav.charts.Chart.CFG_DELIM;
import static de.wellenvogel.avnav.charts.Chart.CFG_EXTENSION;
import static de.wellenvogel.avnav.main.Constants.CHARTOVERVIEW;
import static de.wellenvogel.avnav.main.Constants.CHARTPREFIX;
import static de.wellenvogel.avnav.main.Constants.DEMOCHARTS;
import static de.wellenvogel.avnav.main.Constants.LOGPRFX;
import static de.wellenvogel.avnav.main.Constants.REALCHARTS;
import static de.wellenvogel.avnav.main.Constants.TYPE_CHART;


public class ChartHandler extends RequestHandler.NavRequestHandlerBase implements IPluginAware {

    static class OverlayConfig{
        File file;
        public OverlayConfig(File f){
            file=f;
        }
    }

    static class ExternalChart implements IChartWithConfig{
        String key; //the plugin
        String chartKey;
        String name;
        JSONObject chart;
        static final String OLDPREFIX="Plugin:";

        /**
         * method to convert old chart names (only available from the ocharts-plugin)
         * to the new generic plugin chart naming scheme
         * @param oldName the old name
         * @return the converted name or null if the name does not start with external:Plugin:
         */
        public static String oldChartNameToNew(String oldName){
            //old: external:Plugin:ocharts@name
            //new: external/ext-ocharts@name
            String op=Constants.EXTERNALCHARTS+":"+OLDPREFIX;
            if (oldName == null || ! oldName.startsWith(op)) return null;
            String name=Constants.EXTERNALCHARTS+"/"+IPluginHandler.EXTERNAL_PREFIX+oldName.substring(op.length());
            return name;
        }
        public static String getChartPrefix(String key){
            return Constants.EXTERNALCHARTS + "/"+key+"@";
        }
        public static String configPrefixFromKey(String key){
            return getChartPrefix(key).replace('/',CFG_DELIM);
        }
        public static String configFromChartName(String name) throws Exception {
            if (name == null) return name;
            if (!name.startsWith(Constants.EXTERNALCHARTS+"/")){
                return null;
            }
            String rt=DirectoryRequestHandler.safeName(name.replace('/',CFG_DELIM),false)+CFG_EXTENSION;
            return rt;
        }
        public ExternalChart(String key,JSONObject chart) throws Exception {
            this.key=key;
            this.chart=new JSONObject(chart.toString());
            if (! chart.has(Chart.CKEY)){
                throw new JSONException("external chart without key" + chart);
            }
            name=chart.getString(Chart.CKEY);
            chartKey=getChartPrefix(key)+DirectoryRequestHandler.safeName(name, false);
            if (!this.chart.has(Chart.DPNAME_KEY)){
                this.chart.put(Chart.DPNAME_KEY, name);
            }
            this.chart.put(Chart.CKEY,  chartKey);
        }

        @Override
        public List<String> getChartCfgs() {
            ArrayList<String> rt=new ArrayList<>();
            try {
                String first=configFromChartName(chartKey);
                rt.add(first);
            } catch (Exception e) {
                //should never occur as safeName only throws when required
            }
            //we need a migration for the old ocharts plugin charts overlays
            //they where named Plugin:ocharts@<name>.cfg name is the old chartKey as directly provided externally
            //now they are named external/ext-ocharts@<ck>.cfg
            //and we only need to migrate if the config is on internal storage with colons
            //as otherwise the config has not worked any way
            if (key.startsWith(IPluginHandler.EXTERNAL_PREFIX)) {
                String piname=key.substring(IPluginHandler.EXTERNAL_PREFIX.length());
                for (String n: new String[]{name,chart.optString(Chart.DPNAME_KEY)}){
                    if (!n.isEmpty()) {
                        try {
                            String cfgname = OLDPREFIX + piname + "@" + DirectoryRequestHandler.safeName(n + CFG_EXTENSION, false);
                            if (rt.size() < 1 || !name.equals(rt.get(0))) {
                                //we only add if the name differs from the first name
                                //otherwise we always delete the new config when writing
                                rt.add(cfgname);
                            }
                        } catch (Exception e) {
                        }
                    }
                }
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

    File baseDir;

    public ChartHandler(Context a, RequestHandler h){
        handler=h;
        context =a;
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
                    cleanupInternalOverlays();
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

    public String getExternalChartsPrefix(String key){
        return ExternalChart.getChartPrefix(key);
    }

    @Override
    public void removePluginItems(String pluginName,boolean removeOverlays) {
        synchronized (externalCharts){
            externalCharts.remove(pluginName);
        }
        if (removeOverlays){
            boolean hasRemoved=false;
            HashMap<String,OverlayConfig> current=overlays;
            String prefix=ExternalChart.configPrefixFromKey(pluginName);
            for (String name:current.keySet() ){
                if (name.startsWith(prefix)){
                    try {
                        hasRemoved=true;
                        current.get(name).file.delete();
                    }catch (Throwable e){
                        AvnLog.e("unable to remove overlay "+name,e);
                    }
                }
            }
            if (hasRemoved) triggerUpdate(false);
        }
    }

    @Override
    public void setPluginItems(String pluginName, List<PluginItem> items) throws Exception {
        ArrayList<ExternalChart> extCharts=new ArrayList<>();
        for (PluginItem item:items){
            try{
                ExternalChart echart=new ExternalChart(pluginName,item.toJson());
                extCharts.add(echart);
            } catch (Exception e) {
                AvnLog.e("unable to add external chart ",e);
            }
        }
        synchronized (externalCharts){
            externalCharts.put(pluginName,extCharts);
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
            String mapKey=key.substring(el+1);
            int sidx=mapKey.indexOf('@');
            if (sidx < 0 || sidx >= (key.length()-1)) return null;
            mapKey=mapKey.substring(0,sidx);
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
        MeasureTimer timer=new MeasureTimer();
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
        timer.add("internal");
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
        timer.add("external");
        AvnLog.i(Constants.LOGPRFX,"finish chartlist request "+Thread.currentThread().getId()+" "+timer);
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
            HashMap<String,OverlayConfig> current=overlays;
            for (String cfgName:cfgNames) {
                OverlayConfig cfg=current.get(cfgName);
                if (cfg != null){
                    if (cfg.file.exists()) cfg.file.delete();
                }
            }
            triggerUpdate(true);
            return chartfile != null;
        }
    }

    @Override
    public boolean handleRename(String oldName, String newName) throws Exception {
        throw new Exception("not available");
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
                            cname=chartKey;
                            overlay.put("name",chartKey);
                        }
                        if (cname != null){
                            String newName=ExternalChart.oldChartNameToNew(cname);
                            if (newName != null){
                                overlay.put("name",newName);
                            }
                        }
                    }
                }
            }
            return config;
    }
    private static final String CGETCONFIG="getConfig";
    private static final String CSAVECONFIG="saveConfig";
    private static final String CDELCONFIG="deleteConfig";
    private static final String CLISTCONFIG="listConfig";
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
        if (command.equals(CGETCONFIG) || command.equals(CSAVECONFIG) || command.equals(CDELCONFIG)) {
            String name = uri.getQueryParameter("name");
            File cfgFile = null;
            String configName = null;
            List<String> cfgNames = Collections.emptyList();
            if (name == null) {
                //either config name directly given - or default
                //if a configName is given (retrieved by listConfig) we allow only existing overlays
                //as the JS part does not know how to construct overlay names
                configName = uri.getQueryParameter("configName");
                if (configName != null) {
                    if (overlays.get(configName) == null) {
                        return RequestHandler.getErrorReturn("overlay " + configName + " not found");
                    }
                }
                if (configName == null) configName = DEFAULT_CFG;
                cfgNames = Collections.singletonList(configName);
            } else {
                IChartWithConfig description = getChartDescriptionByChartKey(name);
                if (description == null) {
                    if (name.startsWith(Constants.EXTERNALCHARTS)) {
                        //could be a non existing plugin chart
                        cfgNames = Collections.singletonList(ExternalChart.configFromChartName(name));
                    } else {
                        return RequestHandler.getErrorReturn("chart " + name + " not found");
                    }
                } else {
                    cfgNames = description.getChartCfgs();
                }
            }
            if (cfgNames.isEmpty())
                return RequestHandler.getErrorReturn("no config name for " + name);
            if (command.equals(CGETCONFIG)) {
                configName = cfgNames.get(0);
                for (String n : cfgNames) {
                    OverlayConfig cfg = overlays.get(n);
                    if (cfg != null) {
                        cfgFile = cfg.file;
                        break;
                    }
                }
            } else {
                configName = cfgNames.get(0);
                cfgFile = new File(baseDir, configName);
            }
            if (command.equals(CDELCONFIG)) {
                for (String oname : cfgNames) {
                    OverlayConfig ovl = overlays.get(oname);
                    if (ovl != null) {
                        ovl.file.delete();
                    }
                }
                triggerUpdate(true);
                return RequestHandler.getReturn();
            }
            if (configName == null) {
                return RequestHandler.getErrorReturn("no config for chart " + name);
            }
            if (command.equals(CSAVECONFIG)) {
                if (postData == null) throw new Exception("no data in file");
                DirectoryRequestHandler.writeAtomic(cfgFile, postData.getStream(), true, postData.getContentLength());
                postData.closeInput();
                if (cfgNames.size() > 1) {
                    for (int i = 1; i < cfgNames.size(); i++) {
                        File old = new File(baseDir, cfgNames.get(i));
                        if (old.exists()) old.delete();
                    }
                }
                triggerUpdate(true);
                return RequestHandler.getReturn();
            } else {
                JSONObject localConfig = new JSONObject();
                if (cfgFile != null && cfgFile.exists()) {
                    try {
                        localConfig = AvnUtil.readJsonFile(cfgFile, MAX_CONFIG_SIZE);
                    } catch (Exception e) {
                        AvnLog.e("unable to read chart config " + cfgFile.getAbsolutePath(), e);
                    }
                }
                migrateConfig(configName, localConfig);
                return RequestHandler.getReturn(new AvnUtil.KeyValue<JSONObject>("data", localConfig));
            }
        }
        if (command.equals(CLISTCONFIG)){
           JSONArray rt=new JSONArray();
           for (String cfgname: overlays.keySet()){
               rt.put(cfgname);
           }
           return RequestHandler.getReturn(new AvnUtil.KeyValue("items",rt));

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

    @Override
    public String getType() {
        return TYPE_CHART;
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

    public boolean isLoading(){
        return loading;
    }
    private void cleanupInternalOverlays(){
        HashMap<String,OverlayConfig> current=overlays; //atomic
        HashMap<String,Chart> currentCharts=chartList;
        HashSet<String> activeOverlays=new HashSet<>();
        for (Chart c:currentCharts.values()){
            activeOverlays.addAll(c.getChartCfgs());
        }
        ArrayList<File> toDelete=new ArrayList<>();
        for (String ovlname:current.keySet()){
            if (activeOverlays.contains(ovlname)) continue;
            if (ovlname.equals(DEFAULT_CFG)) continue;
            if (ovlname.startsWith(Constants.EXTERNALCHARTS)) continue;
            if (ovlname.startsWith(ExternalChart.OLDPREFIX)) continue;
            toDelete.add(current.get(ovlname).file);
        }
        for (File f:toDelete){
            AvnLog.i("deleting unused overlay "+f.getName());
            f.delete();
        }
    }
    /**
     * cleanup overlay files
     * we only keep overlays from existing charts
     * and overlays that belong to one of the existing prefixes (keys from addExternalCharts)
     * @param existingPrefixes the list of existing external chart prefixes
     */
    public void cleanupExternalOverlays(List<String> existingPrefixes){
        ArrayList<File> toDelete=new ArrayList<>();
        HashMap<String,OverlayConfig> current=overlays; //atomic
        HashSet<String> activeOverlays=new HashSet<>();
        ArrayList<String> prefixes=new ArrayList<>();
        for (String ep:existingPrefixes){
            prefixes.add(ExternalChart.configPrefixFromKey(ep));
        }
        //to be sure just build a list of all currently active
        //external charts
        synchronized (externalCharts){
            for (String key:externalCharts.keySet()){
                try {
                    List<ExternalChart> charts = externalCharts.get(key);
                    if (charts == null) continue;
                    for (ExternalChart chartDescription:charts) {
                        activeOverlays.addAll(chartDescription.getChartCfgs());
                    }
                }catch (Exception x){
                    Log.e(Constants.LOGPRFX,"error in external charts for "+key,x);
                }
            }
        }

        for (String ovlname:current.keySet()){
            if (activeOverlays.contains(ovlname)) continue;
            if (ovlname.equals(DEFAULT_CFG)) continue;
            String nameForCheck=ovlname;
            if (ovlname.startsWith(ExternalChart.OLDPREFIX)){
                //no problem with ; vs. . as old names can only occur if the system can handle :
                nameForCheck=ExternalChart.oldChartNameToNew(Constants.EXTERNALCHARTS+":"+ovlname);
                if (nameForCheck == null) continue;
            }
            else{
                if (! ovlname.startsWith(Constants.EXTERNALCHARTS)) continue;
            }
            boolean existing=false;
            for (String p:prefixes){
                if (nameForCheck.startsWith(p)) {
                    existing=true;
                    break;
                }
            }
            if (! existing){
                toDelete.add(current.get(ovlname).file);
            }
        }
        for (File f:toDelete){
            AvnLog.i("deleting unused overlay "+f.getName());
            f.delete();
        }
        triggerUpdate(false);
    }
}
