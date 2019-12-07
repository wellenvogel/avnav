package de.wellenvogel.avnav.gemf;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.support.v4.provider.DocumentFile;
import android.util.Log;

import java.io.File;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.Iterator;

import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.INavRequestHandler;
import de.wellenvogel.avnav.main.RequestHandler;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;


public class GemfReader implements INavRequestHandler {
    private static final String GEMFEXTENSION =".gemf";
    private Activity activity;
    //mapping of url name to char descriptors
    private HashMap<String, GemfChart> gemfFiles =new HashMap<String, GemfChart>();

    public GemfReader(Activity a){
        activity=a;
    }
    public synchronized void updateChartList(){
        HashMap<String, GemfChart> newGemfFiles=new HashMap<String, GemfChart>();
        SharedPreferences prefs=AvnUtil.getSharedPreferences(activity);
        File workDir=AvnUtil.getWorkDir(prefs,activity);
        File chartDir = new File(workDir, "charts");
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
    public RequestHandler.ExtendedWebResourceResponse handleDownload(String name, Uri uri) throws Exception {
        throw new Exception("download chart not supported");
    }

    @Override
    public boolean handleUpload(String postData, String name, boolean ignoreExisting) throws Exception {
        throw new Exception("upload chart not supported");
    }

    @Override
    public Collection<? extends IJsonObect> handleList() throws Exception {
        //here we will have more dirs in the future...
        ArrayList<GemfChart> rt=new ArrayList<>();
        try {
            for (String url : gemfFiles.keySet()) {
                GemfChart chart = gemfFiles.get(url);
                rt.add(chart);
            }
        } catch (Exception e) {
            Log.e(Constants.LOGPRFX, "exception readind chartlist:", e);
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
}
