package de.wellenvogel.avnav.gemf;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.support.v4.provider.DocumentFile;
import android.util.Log;

import org.apache.http.HttpEntity;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;

import de.wellenvogel.avnav.appapi.DirectoryRequestHandler;
import de.wellenvogel.avnav.appapi.ExtendedWebResourceResponse;
import de.wellenvogel.avnav.appapi.IDirectoryHandler;
import de.wellenvogel.avnav.appapi.JsonWrapper;
import de.wellenvogel.avnav.appapi.PostVars;
import de.wellenvogel.avnav.appapi.RequestHandler;
import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.appapi.INavRequestHandler;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;

import static de.wellenvogel.avnav.main.Constants.CHARTOVERVIEW;
import static de.wellenvogel.avnav.main.Constants.DEMOCHARTS;


public class GemfHandler implements INavRequestHandler, IDirectoryHandler {
    private static final String GEMFEXTENSION =".gemf";
    private Activity activity;
    private RequestHandler handler;
    //mapping of url name to char descriptors
    private HashMap<String, GemfChart> gemfFiles =new HashMap<String, GemfChart>();

    public GemfHandler(Activity a,RequestHandler h){
        handler=h;
        activity=a;

    }
    public synchronized void updateChartList(){
        HashMap<String, GemfChart> newGemfFiles=new HashMap<String, GemfChart>();
        SharedPreferences prefs=AvnUtil.getSharedPreferences(activity);
        File workDir=AvnUtil.getWorkDir(prefs,activity);
        File chartDir = getInternalChartsDir();
        readChartDir(chartDir.getAbsolutePath(),"1",newGemfFiles);
        String secondChartDirStr=prefs.getString(Constants.CHARTDIR,"");
        if (! secondChartDirStr.isEmpty()){
            if (! secondChartDirStr.equals(workDir.getAbsolutePath())){
                readChartDir(secondChartDirStr,"2",newGemfFiles);
            }
        }
        //now we have all current charts - compare to the existing list and create/delete entries
        //currently we assume only one thread to change the chartlist...
        boolean modified=false;
        for (String url : newGemfFiles.keySet()){
            GemfChart chart=newGemfFiles.get(url);
            long lastModified=chart.getLastModified();
            if (gemfFiles.get(url) == null ){
                gemfFiles.put(url,chart);
                modified=true;
            }
            else{
                if (gemfFiles.get(url).getLastModified() < lastModified){
                    modified=true;
                    gemfFiles.get(url).close();
                    gemfFiles.put(url,chart);
                }
            }
        }
        Iterator<String> it=gemfFiles.keySet().iterator();
        while (it.hasNext()){
            String url=it.next();
            if (newGemfFiles.get(url) == null){
                it.remove();
                modified=true;
            }
            else{
                GemfChart chart=gemfFiles.get(url);
                if (chart.closeInactive()){
                    AvnLog.i("closing gemf file "+url);
                    modified=true;
                }
            }
        }
        if (modified){
            activity.sendBroadcast(new Intent(Constants.BC_RELOAD_DATA));
        }
    }

    public GemfChart getChartDescription(String url){
        return gemfFiles.get(url);
    }

    private void readChartDir(String chartDirStr,String index,HashMap<String,GemfChart> arr) {
        if (chartDirStr == null) return;
        if (Build.VERSION.SDK_INT >= 21) {
            if (chartDirStr.startsWith("content:")) {
                //see https://github.com/googlesamples/android-DirectorySelection/blob/master/Application/src/main/java/com/example/android/directoryselection/DirectorySelectionFragment.java
                //and https://stackoverflow.com/questions/36862675/android-sd-card-write-permission-using-saf-storage-access-framework
                Uri dirUri = Uri.parse(chartDirStr);
                DocumentFile dirFile=DocumentFile.fromTreeUri(activity,dirUri);
                for (DocumentFile f : dirFile.listFiles()){
                    if (f.getName().endsWith(".gemf")){
                        String urlName = Constants.REALCHARTS + "/" + index + "/gemf/" + f.getName();
                        arr.put(urlName, new GemfChart(activity, f, urlName, f.lastModified()));
                        AvnLog.d(Constants.LOGPRFX,"readCharts: adding gemf url "+urlName+" for "+f.getUri());
                    }
                    if (f.getName().endsWith(".xml")){
                        String name=f.getName().substring(0,f.getName().length()-".xml".length());
                        String urlName=Constants.REALCHARTS+"/"+index+"/avnav/"+name;
                        GemfChart newChart=new GemfChart(activity, f,urlName,f.lastModified());
                        newChart.setIsXml();
                        arr.put(urlName,newChart);
                        AvnLog.d(Constants.LOGPRFX,"readCharts: adding xml url "+urlName+" for "+f.getUri());
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
                    gemfName = gemfName.substring(0, gemfName.length() - GEMFEXTENSION.length());
                    String urlName= Constants.REALCHARTS + "/"+index+"/gemf/" + gemfName;
                    arr.put(urlName,new GemfChart(activity, f,urlName,f.lastModified()));
                    AvnLog.d(Constants.LOGPRFX,"readCharts: adding gemf url "+urlName+" for "+f.getAbsolutePath());
                }
                if (f.getName().endsWith(".xml")){
                    String name=f.getName().substring(0,f.getName().length()-".xml".length());
                    String urlName=Constants.REALCHARTS+"/"+index+"/avnav/"+name;
                    GemfChart newChart=new GemfChart(activity, f,urlName,f.lastModified());
                    newChart.setIsXml();
                    arr.put(urlName,newChart);
                    AvnLog.d(Constants.LOGPRFX,"readCharts: adding xml url "+urlName+" for "+f.getAbsolutePath());
                }
            } catch (Exception e) {
                Log.e(Constants.LOGPRFX, "exception handling file " + f.getAbsolutePath());
            }
        }
    }


    @Override
    public ExtendedWebResourceResponse handleDownload(String name, Uri uri) throws Exception {
        throw new Exception("download chart not supported");
    }

    @Override
    public boolean handleUpload(PostVars postData, String name, boolean ignoreExisting) throws Exception {
        FileOutputStream os =openForWrite(name,!ignoreExisting);
        if (postData == null) throw new Exception("no data in file");
        postData.writeTo(os);
        os.close();
        return true;
    }

    @Override
    public JSONArray handleList() throws Exception {
        //here we will have more dirs in the future...
        JSONArray rt=new JSONArray();
        try {
            for (String url : gemfFiles.keySet()) {
                GemfChart chart = gemfFiles.get(url);
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
                JSONObject e = new JSONObject();
                e.put("name", name);
                e.put("url", "/"+ Constants.CHARTPREFIX+"/"+Constants.DEMOCHARTS+"/" + name);
                e.put("charturl","/"+ Constants.CHARTPREFIX+"/"+Constants.DEMOCHARTS+"/" + name);
                e.put("canDelete",false);
                rt.put(e);
            }
        }
        return rt;
    }

    @Override
    public boolean handleDelete(String name, Uri uri) throws Exception {
        String charturl=uri.getQueryParameter("url");
        if (charturl == null) return false;
        GemfChart chart= getChartDescription(charturl.substring(Constants.CHARTPREFIX.length()+2));
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
    public JSONObject handleApiRequest(Uri uri, PostVars postData) throws Exception {
        return null;
    }

    @Override
    public String getUrlPrefix() {
        return Constants.CHARTPREFIX;
    }

    @Override
    public FileOutputStream openForWrite(String name, boolean noOverwrite) throws Exception {
        String safeName= DirectoryRequestHandler.safeName(name,true);
        if (! safeName.endsWith(".gemf")) throw new Exception("only .gemf files allowed");
        File outFile=new File(getInternalChartsDir(),safeName);
        if (outFile.exists() && noOverwrite){
            throw new Exception("file already exists");
        }
        return new FileOutputStream(outFile) {
            @Override
            public void close() throws IOException {
                super.close();
                updateChartList();
            }
        };
    }

    @Override
    public ExtendedWebResourceResponse handleDirectRequest(String url) throws FileNotFoundException {
        return handleChartRequest(url);
    }

    public File getInternalChartsDir(){
        File workDir=AvnUtil.getWorkDir(null,activity);
        File chartDir = new File(workDir, "charts");
        return chartDir;
    }

    @Override
    public String getDirName() {
        return getInternalChartsDir().getAbsolutePath();
    }

    @Override
    public void deleteFile(String name) throws Exception {
        handleDelete(name,null);
    }


    private ExtendedWebResourceResponse handleChartRequest(String fname) {
        fname = fname.substring(Constants.CHARTPREFIX.length() + 1);
        InputStream rt = null;
        fname = fname.replaceAll("\\?.*", "");
        String mimeType = handler.mimeType(fname);
        int len = 0;
        try {
            if (fname.startsWith(DEMOCHARTS)) {
                fname = fname.substring(DEMOCHARTS.length() + 1);
                if (fname.endsWith(CHARTOVERVIEW)) {
                    AvnLog.d(Constants.LOGPRFX, "overview request " + fname);
                    fname = fname.substring(0, fname.length() - CHARTOVERVIEW.length() - 1); //just the pure name
                    fname += ".xml";
                    rt = activity.getAssets().open(Constants.CHARTPREFIX + "/" + fname);
                    len = -1;
                } else throw new Exception("unable to handle demo request for " + fname);
            }
            if (fname.startsWith(Constants.REALCHARTS)) {
                //the name will be REALCHARTS/index/type/name/param
                //type being either avnav or gemf
                String baseAndUrl[] = fname.split("/", 5);
                if (baseAndUrl.length < 5) throw new Exception("invalid chart request " + fname);
                String key = baseAndUrl[0] + "/" + baseAndUrl[1] + "/" + baseAndUrl[2] + "/" + baseAndUrl[3];
                GemfChart chart = getChartDescription(key);
                if (chart == null)
                    throw new Exception("request a file that is not in the list: " + fname);
                if (baseAndUrl[2].equals("gemf")) {
                    if (baseAndUrl[4].equals(CHARTOVERVIEW)) {
                        try {
                            return chart.getOverview();
                        } catch (Exception e) {
                            Log.e(Constants.LOGPRFX, "unable to read gemf file " + fname + ": " + e.getLocalizedMessage());
                        }
                    } else {
                        GemfFileReader f = chart.getGemf();
                        //we have source/z/x/y in baseAndUrl[1]
                        String param[] = baseAndUrl[4].split("/");
                        if (param.length < 4) {
                            throw new Exception("invalid parameter for gemf call " + fname);
                        }
                        int z = Integer.parseInt(param[1]);
                        int x = Integer.parseInt(param[2]);
                        int y = Integer.parseInt(param[3].replaceAll("\\.png", ""));
                        return f.getChartData(x, y, z, Integer.parseInt(param[0]));
                    }
                } else if (baseAndUrl[2].equals("avnav")) {
                    if (!baseAndUrl[4].equals(CHARTOVERVIEW)) {
                        throw new Exception("only overview supported for xml files: " + fname);
                    }
                    return chart.getOverview();
                } else {
                    Log.e(Constants.LOGPRFX, "invalid chart request " + fname);
                }
            }
            if (rt == null) {
                Log.e(Constants.LOGPRFX, "unknown chart path " + fname);


            }

            return new ExtendedWebResourceResponse(len, mimeType, "", rt);
        } catch (Exception e) {
            Log.e(Constants.LOGPRFX, "chart file " + fname + " not found: " + e.getLocalizedMessage());
        }
        return null;
    }
}
