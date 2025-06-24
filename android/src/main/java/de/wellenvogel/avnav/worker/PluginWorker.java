package de.wellenvogel.avnav.worker;

import android.content.ComponentName;
import android.content.Intent;
import android.os.Build;
import android.os.SystemClock;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import de.wellenvogel.avnav.appapi.AddonHandler;
import de.wellenvogel.avnav.charts.ChartHandler;
import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.util.NmeaQueue;

public class PluginWorker extends Worker{
    static class Creator extends WorkerFactory.Creator{
        @Override
        IWorker create(String name, GpsService ctx, NmeaQueue queue) throws JSONException, IOException {
            return new PluginWorker(ctx);
        }

        @Override
        boolean canAdd(GpsService ctx) {
            return false;
        }
    }
    static final String NAME_PARAM="_name";
    static final String TYPENAME="Plugin";
    private static final String C_CHARTS="charts";
    private static final String C_ADDONS="addons";
    static final EditableParameter.IntegerParameter TIMEOUT_PARAMETER=
            new EditableParameter.IntegerParameter("timeout", R.string.labelSettingsPluginTimeout,30);
    long lastUpdate=0;
    String pluginName=new String();
    String startPackage;
    String startAction;
    private JSONArray charts=null;
    private JSONArray addons=null;

    private void setParameters(){
        parameterDescriptions.add(ENABLED_PARAMETER);
        parameterDescriptions.add(TIMEOUT_PARAMETER);
    }
    public PluginWorker(GpsService ctx){
        super(TYPENAME,ctx);
        this.status.canEdit=true;
        this.status.canDelete=true;
        setParameters();
    }
    public PluginWorker(GpsService ctx, String pluginName){
        super(TYPENAME,ctx);
        this.status.canEdit=true;
        this.status.canDelete=true;
        this.pluginName=pluginName;
        setParameters();
    }
    public PluginWorker(GpsService ctx, String pluginName, String startPackage, String startAction){
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

    public String getPluginName(){
        return pluginName;
    }

    @Override
    public synchronized void setParameters(JSONObject newParam, boolean replace, boolean check) throws JSONException, IOException {
        super.setParameters(newParam, replace, check);
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
        return pluginName;
    }

    private String getKey(){
        return TYPENAME+":"+pluginName;
    }
    private void unregisterCharts(boolean reset) {
        ChartHandler chartHandler = gpsService.getChartHandler();
        if (chartHandler != null) {
            chartHandler.removeExternalCharts(getKey());
        }
        if (reset) charts=null;
        status.unsetChildStatus(C_CHARTS);
    }
    private void unregisterAddons(boolean reset){
        AddonHandler addonHandler=gpsService.getAddonHandler();
        if (addonHandler != null){
            addonHandler.removeExternalAddons(getKey());
        }
        if (reset) addons=null;
        status.unsetChildStatus(C_ADDONS);
    }
    private void registerCharts(JSONArray charts){
        ChartHandler chartHandler=gpsService.getChartHandler();
        if (chartHandler == null) {
            status.unsetChildStatus(C_CHARTS);
            return;
        }
        chartHandler.addExternalCharts(getKey(),charts);
        this.charts=charts;
        status.setChildStatus(C_CHARTS, WorkerStatus.Status.NMEA,charts.length()+" registered");
    }

    private void registerAddons(JSONArray addonsJson) {
        AddonHandler addonHandler = gpsService.getAddonHandler();
        if (addonHandler != null) {
            ArrayList<AddonHandler.AddonInfo> addons = new ArrayList<>();
            for (int i = 0; i < addonsJson.length(); i++) {
                try {
                    JSONObject addon = addonsJson.getJSONObject(i);
                    AddonHandler.AddonInfo info = new AddonHandler.AddonInfo(addon.getString("name"));
                    info.icon = addon.getString("icon");
                    info.url = addon.getString("url");
                    if (addon.optBoolean("keepUrl", false)) {
                        info.adaptHttpUrls = true;
                    }
                    if (addon.has("title")) info.title = addon.getString("title");
                    info.newWindow = addon.optBoolean("newWindow", false) ? "true" : "false";
                    addons.add(info);
                } catch (Exception e) {
                    Log.e(Constants.LOGPRFX, "unable to handle addons for " + pluginName, e);
                }
            }
            addonHandler.addExternalAddons(getKey(), addons);
            status.setChildStatus(C_ADDONS, WorkerStatus.Status.NMEA,addons.size()+" registered");
            this.addons=addonsJson;
        }
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
                Log.e(Constants.LOGPRFX,"unable to start plugin "+pluginName,t);
            }
        }
    }
    @Override
    protected void run(int startSequence) throws JSONException, IOException {
        setStatus(WorkerStatus.Status.INACTIVE,"started");
        boolean active=false;
        JSONArray charts;
        JSONArray addons;
        charts=this.charts;
        addons=this.addons;
        if (charts != null) registerCharts(charts);
        if (addons != null) registerAddons(addons);
        tryAutoStart();
        while (! shouldStop(startSequence)){
            sleep(1000);
            long last=getLastUpdate();
            if (shouldStop(startSequence)) break;
            if ( (last + 1000 *TIMEOUT_PARAMETER.fromJson(parameters)) < SystemClock.uptimeMillis()){
                setStatus(WorkerStatus.Status.INACTIVE,"timeout");
                unregisterCharts(true);
                unregisterAddons(true);
            }
            else{
                setStatus(WorkerStatus.Status.NMEA,"plugin available");
            }
        }
        unregisterAddons(false);
        unregisterCharts(false);
    }

    @Override
    public void stop() {
        super.stop();
        unregisterAddons(false);
        unregisterCharts(false);
    }

    public void update(Intent intent){
        setLastUpdate();
        boolean enabled=false;
        try {
            enabled=ENABLED_PARAMETER.fromJson(parameters);
        } catch (JSONException e) {
            Log.d(Constants.LOGPRFX,"cannot read enabled state for "+pluginName);
        }
        if (enabled) {
            boolean updatedCharts = false;
            boolean updatedAddons = false;
            String pluginString = intent.getStringExtra("plugin.json");
            if (pluginString != null) {
                try {
                    JSONObject pluginJson = new JSONObject(pluginString);
                    if (pluginJson.has("charts")) {
                        JSONArray charts = pluginJson.getJSONArray("charts");
                        registerCharts(charts);
                        updatedCharts = true;
                    }
                    if (pluginJson.has("userApps")) {
                        JSONArray userApps = pluginJson.getJSONArray("userApps");
                        registerAddons(userApps);
                        updatedAddons = true;
                    }
                } catch (Throwable t) {
                    Log.d(Constants.LOGPRFX, "unable to handle plugin.json", t);
                }
            }
            if (! updatedCharts){
                unregisterCharts(true);
            }
            if (! updatedAddons){
                unregisterAddons(true);
            }
        }
        else{
            unregisterCharts(true);
            unregisterAddons(true);
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
