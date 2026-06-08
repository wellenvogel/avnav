package de.wellenvogel.avnav.worker;

import android.content.ComponentName;
import android.content.Intent;
import android.os.Build;
import android.os.SystemClock;
import android.util.Log;

import androidx.annotation.NonNull;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Objects;
import java.util.zip.ZipFile;

import de.wellenvogel.avnav.appapi.ExtendedWebResourceResponse;
import de.wellenvogel.avnav.charts.Chart;
import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.util.NmeaQueue;

public class ExternalPluginWorker extends Worker implements IPluginHandler{

    static class UrlWTimestamp{
        public String url;
        public long timestamp;
        public UrlWTimestamp(String url, long timestamp){
            this.url=url;
            this.timestamp=timestamp;
        }
    }
    private final Object pijLock=new Object();
    private JSONObject pluginJson;

    private HashMap<String,UrlWTimestamp> piFiles= new HashMap<>();

    private long lastModified=0;

    private void setPluginJson(JSONObject no,Intent received){
        boolean hasChanged=false;
        synchronized (pijLock) {
            if (no != null) {
                if (pluginJson != null) {
                    hasChanged = !no.toString().equals(pluginJson.toString());
                } else hasChanged = true;
            }
            else {
                if (pluginJson != null) hasChanged = true;
            }
            pluginJson = no;
            if (hasChanged || lastModified == 0){
                lastModified = SystemClock.uptimeMillis();
            }
            if (received == null){
                piFiles.clear();
            }
            else {
                for (String k: new String[]{FT_CSS,FT_MJS}){
                    AvnUtil.KeyValue<String> fname=PLUGINFILES.get(k);
                    if (fname == null) continue;
                    String url= received.getStringExtra(fname.value);
                    long ts=received.getLongExtra(fname.value+"-time",0);
                    if (url != null) {
                        piFiles.put(k, new UrlWTimestamp(url, ts));
                    }
                }
            }
        }

    }

    @Override
    public Kind getKind() {
        return Kind.PLUGINS;
    }

    @Override
    public JSONObject getFiles() throws JSONException {
        long lm=lastModified;
        JSONObject piJson=pluginJson;
        JSONObject rt=new JSONObject();
        rt.put(K_NAME, getKey());
        if (ENABLED_PARAMETER.fromJson(parameters)) {
            synchronized (pijLock) {
                if (piJson != null) {
                    JSONObject finfo = new JSONObject();
                    finfo.put(IK_FURL, PLUGINFILES.get(FT_CFG).value);
                    finfo.put(IK_FTS, lm);
                    rt.put(FT_CFG, finfo);
                }
                for (String k:piFiles.keySet()){
                    UrlWTimestamp fentry=piFiles.get(k);
                    AvnUtil.KeyValue<String> urlV = PLUGINFILES.get(k);
                    if (urlV != null) {
                        JSONObject finfo = new JSONObject();
                        finfo.put(IK_FURL,urlV.value );
                        finfo.put(IK_FTS, fentry.timestamp);
                        rt.put(k, finfo);
                    }
                }
            }
            rt.put(K_ACTIVE,true);
        }
        else{
            rt.put(K_ACTIVE,false);
        }
        return rt;
    }

    @Override
    public JSONObject getInfo() throws JSONException {
        JSONObject piJson=pluginJson;
        JSONObject rt=new JSONObject();
        rt.put(IK_NAME,getKey());
        rt.put(IK_ID,getId());
        rt.put(IK_EDIT,true);
        rt.put(IK_ACTIVE,(piJson != null) && ENABLED_PARAMETER.fromJson(parameters));
        return rt;
    }
    static class CloseHelperStream extends InputStream {
        private InputStream is;
        private HttpURLConnection zf;
        public CloseHelperStream(InputStream zi,HttpURLConnection zf){
            this.is=zi;
            this.zf=zf;
        }
        @Override
        public int read() throws IOException {
            return is.read();
        }

        @Override
        public int read(@NonNull byte[] b) throws IOException {
            return is.read(b);
        }

        @Override
        public int read(@NonNull byte[] b, int off, int len) throws IOException {
            return is.read(b, off, len);
        }

        @Override
        public void close() throws IOException {
            super.close();
            zf.disconnect();
        }
    }
    @Override
    public ExtendedWebResourceResponse openFile(String relativePath) throws Exception {
        if (relativePath == null) throw new Exception("empty path");
        String cfgName=PLUGINFILES.get(FT_CFG).value;
        if (relativePath.equals(cfgName)) {
            JSONObject piJson = pluginJson;
            if (piJson == null) throw new Exception("file " + relativePath + " not found");
            ByteArrayInputStream is = new ByteArrayInputStream(piJson.toString().getBytes(StandardCharsets.UTF_8));
            return new ExtendedWebResourceResponse(is.available(), "application/json", "UTF-8", is);
        }
        UrlWTimestamp found=null;
        synchronized (pijLock) {
            for (String k :piFiles.keySet()){
                AvnUtil.KeyValue<String> fname=PLUGINFILES.get(k);
                if (fname == null) continue;
                if (fname.value.equals(relativePath)){
                    found=piFiles.get(k);
                    break;
                }
            }
        }
        if (found == null){
            throw new Exception("file "+relativePath+" not found");
        }
        URL rurl=new URL(found.url);
        HttpURLConnection urlConnection = (HttpURLConnection) rurl.openConnection();
        try {
            InputStream in = urlConnection.getInputStream();
            String ct=urlConnection.getContentType();
            String ce=urlConnection.getContentEncoding();
            int len=urlConnection.getContentLength();
            ExtendedWebResourceResponse rt= new ExtendedWebResourceResponse(len,ct,ce,new CloseHelperStream(in,urlConnection));
            rt.setDateHeader("last-modified", new Date(found.timestamp));
            return rt;
        } catch (Throwable t) {
            urlConnection.disconnect();
            throw t;
        }
    }

    @Override
    public String getName() {
        return getKey();
    }


    static class Creator extends WorkerFactory.Creator{
        @Override
        IWorker create(String name, GpsService ctx, NmeaQueue queue) throws JSONException, IOException {
            return new ExternalPluginWorker(ctx);
        }

        @Override
        boolean canAdd(GpsService ctx) {
            return false;
        }
    }
    static final String NAME_PARAM="_name";
    public static final String TYPENAME="ExternalPlugin";
    static final EditableParameter.IntegerParameter TIMEOUT_PARAMETER=
            new EditableParameter.IntegerParameter("timeout", R.string.labelSettingsPluginTimeout,30);
    long lastUpdate=0;
    String pluginName=new String();
    String startPackage;
    String startAction;

    PluginHandlerBase phBase;
    private void setParameters(){
        parameterDescriptions.add(ENABLED_PARAMETER);
        parameterDescriptions.add(TIMEOUT_PARAMETER);
        phBase=new PluginHandlerBase(gpsService,this.status,null,0) {
            @Override
            protected String getKey() {
                return ExternalPluginWorker.this.getKey();
            }
        };
    }
    public ExternalPluginWorker(GpsService ctx){
        super(TYPENAME,ctx);
        this.status.canEdit=true;
        this.status.canDelete=true;
        setParameters();
    }
    public ExternalPluginWorker(GpsService ctx, String pluginName){
        super(TYPENAME,ctx);
        this.status.canEdit=true;
        this.status.canDelete=true;
        this.pluginName=pluginName;
        setParameters();
    }
    public ExternalPluginWorker(GpsService ctx, String pluginName, String startPackage, String startAction){
        super(TYPENAME,ctx);
        this.pluginName=pluginName;
        this.startAction=startAction;
        this.startPackage=startPackage;
        this.status.canEdit=true;
        this.status.canDelete=false;
        setParameters();
    }

    private synchronized void setLastUpdate(){
        lastUpdate= SystemClock.uptimeMillis();
    }
    private synchronized long getLastUpdate(){
        return lastUpdate;
    }

    public String getPluginName(boolean noPrefix){
        if (noPrefix) return pluginName;
        return EXTERNAL_PREFIX+pluginName;
    }

    @Override
    public synchronized void setParameters(String child, JSONObject newParam, boolean replace, boolean check) throws JSONException, IOException {
        super.setParameters(child, newParam, replace, check);
        if (pluginName.isEmpty()){
            if (newParam.has(NAME_PARAM)){
                pluginName=newParam.getString(NAME_PARAM);
            }
        }
        else{
            parameters.put(NAME_PARAM,pluginName);
        }
    }

    @Override
    protected String getSourceName() {
        return Constants.PLUGINPREFIX+ EXTERNAL_PREFIX+pluginName;
    }

    @Override
    public String getKey(){
        return getPluginName(false);
    }

    private void tryAutoStart(){
        if (startPackage != null && startAction != null) {
            Intent si = new Intent();
            si.setComponent(new ComponentName(startPackage, startAction));
            Log.i(Constants.LOGPRFX,"trying autostart "+startPackage+":"+startAction);
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    gpsService.startForegroundService(si);
                } else {
                    gpsService.startService(si);
                }
            }catch(Throwable t){
                Log.e(Constants.LOGPRFX,"unable to start plugin "+getPluginName(false),t);
            }
        }
    }
    @Override
    protected void run(int startSequence) throws JSONException, IOException {
        setStatus(WorkerStatus.Status.INACTIVE,"started");
        boolean active=false;
        try {
            phBase.onStart();
        }catch (Exception e){
            throw new JSONException(e.getMessage());
        }
        tryAutoStart();
        while (! shouldStop(startSequence)){
            sleep(1000);
            long last=getLastUpdate();
            if (shouldStop(startSequence)) break;
            if ( (last + 1000 *TIMEOUT_PARAMETER.fromJson(parameters)) < SystemClock.uptimeMillis()){
                setStatus(WorkerStatus.Status.INACTIVE,"timeout");
                phBase.onStop(true);
                setPluginJson(null,null);
            }
            else{
                setStatus(WorkerStatus.Status.NMEA,"plugin available");
            }
        }
        phBase.onStop(false);
        setPluginJson(null,null);
    }

    @Override
    public void stop() {
        super.stop();
        phBase.onStop(false);
        setPluginJson(null,null);
    }

    public void update(Intent intent){
        setLastUpdate();
        boolean enabled=false;
        try {
            enabled=ENABLED_PARAMETER.fromJson(parameters);
        } catch (JSONException e) {
            Log.d(Constants.LOGPRFX,"cannot read enabled state for "+getPluginName(false));
        }
        if (enabled) {
            //use some heuristics to decide if the timestamp we see
            //is in seconds or milliseconds
            long maxSeconds=(new Date("3000/01/01")).getTime()/1000;
            boolean updatedCharts = false;
            boolean updatedAddons = false;
            /*
            string extras: plugin.json: the content of a plugin.json
                           plugin.mjs: the URL of a plugin.mjs
                           plugin.css: the URL of a plugin.css
             */
            String pluginString = intent.getStringExtra(PLUGINFILES.get(FT_CFG).value);
            JSONObject piJson=null;
            if (pluginString != null) {
                try {
                    piJson = new JSONObject(pluginString);
                    if (piJson.has("charts")) {
                        JSONArray charts = piJson.getJSONArray("charts");
                        for (int i=0;i<charts.length();i++){
                            JSONObject chart=charts.getJSONObject(i);
                            //migrate old style config if the chart has chartKey
                            //chartKey -> name, name->displayName
                            if (chart.has(Chart.EXT_CKEY)){
                                String name=chart.getString(Chart.EXT_CKEY);
                                if (!chart.has(Chart.DPNAME_KEY)){
                                    if (chart.has(Chart.CKEY)){
                                        chart.put(Chart.DPNAME_KEY,chart.getString(Chart.CKEY));
                                    }
                                }
                                chart.put(Chart.CKEY,name);
                                chart.remove(Chart.EXT_CKEY);
                            }
                            if (chart.has(Chart.TIME_KEY)){
                                long ts=chart.getLong(Chart.TIME_KEY);
                                if (ts > maxSeconds) {
                                    ts=ts/1000;
                                    chart.put(Chart.TIME_KEY,ts);
                                }
                            }
                        }
                        phBase.registerCharts(charts);
                        updatedCharts = true;
                    }
                    if (piJson.has("userApps")) {
                        JSONArray userApps = piJson.getJSONArray("userApps");
                        phBase.registerAddons(userApps);
                        updatedAddons = true;
                    }
                } catch (Throwable t) {
                    Log.d(Constants.LOGPRFX, "unable to handle plugin.json", t);
                }
            }
            setPluginJson(piJson,
                    intent
            );
            if (! updatedCharts){
                phBase.unregisterCharts(true);
            }
            if (! updatedAddons){
                phBase.unregisterAddons(true);
            }
        }
        else{
            phBase.onStop(true);
        }
        if (enabled) {
            String heartBeat = intent.getStringExtra("heartbeat");
            if (heartBeat != null) {
                try {
                    Intent reply = new Intent(heartBeat);
                    gpsService.sendBroadcast(reply);
                } catch (Throwable t) {
                    Log.d(Constants.LOGPRFX, "unable to send heartbeat", t);
                }
            }
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        tryAutoStart();
    }
}
