package de.wellenvogel.avnav.worker;

import static de.wellenvogel.avnav.appapi.RequestHandler.TYPE_PLUGINS;

import android.content.ComponentName;
import android.content.Intent;
import android.os.Build;
import android.os.SystemClock;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;

import de.wellenvogel.avnav.appapi.AddonHandler;
import de.wellenvogel.avnav.appapi.RequestHandler;
import de.wellenvogel.avnav.charts.ChartHandler;
import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.util.NmeaQueue;

public class PluginWorker extends Worker{
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
    public static final String TYPENAME="Plugin";
    private static final String C_CHARTS="charts";
    private static final String C_ADDONS="addons";
    static final EditableParameter.IntegerParameter TIMEOUT_PARAMETER=
            new EditableParameter.IntegerParameter("timeout", R.string.labelSettingsPluginTimeout,30);
    static final EditableParameter.StringParameter PLUGIN_NAME= new EditableParameter.StringParameter("plugin",0,null);
    private JSONArray charts=null;
    private JSONArray addons=null;
    private File workDir;
    private boolean existing=false;

    private void setParameters(){
        parameterDescriptions.add(ENABLED_PARAMETER);
    }
    public PluginWorker(GpsService ctx){
        super(TYPENAME,ctx);
        this.status.canEdit=true;
        this.status.canDelete=true;
        setParameters();
        setWorkDir();
    }

    private void setWorkDir(){
        workDir= new File(AvnUtil.getWorkDir(null,gpsService),RequestHandler.typeDirs.get(TYPE_PLUGINS).value.getName());
    }

    public String getPluginName() throws JSONException {
        return PLUGIN_NAME.fromJson(this.parameters);
    }

    @Override
    public synchronized void setParameters(JSONObject newParam, boolean replace, boolean check) throws JSONException, IOException {
        super.setParameters(newParam, replace, check);
    }

    @Override
    protected void run(int startSequence) throws JSONException, IOException {

    }

    @Override
    public void start(PermissionCallback permissionCallback) {
        stop();
        try{
            String pluginDirStr=PLUGIN_NAME.fromJson(parameters);
            File pluginDir=new File(workDir,pluginDirStr);
            if (!pluginDir.isDirectory()){
                existing=false;
                setStatus(WorkerStatus.Status.ERROR,"dir "+pluginDir.getAbsolutePath()+" not found");
                return;
            }
            setStatus(WorkerStatus.Status.STARTED,"running in dir "+pluginDirStr);
            //TODO parse plugin.json
            existing=true;
            if (! ENABLED_PARAMETER.fromJson(parameters)){
                setStatus(WorkerStatus.Status.INACTIVE,"plugin disabled by config");
            }
        }catch (Exception e){
            setStatus(WorkerStatus.Status.ERROR,e.getMessage());
        }
    }

    public boolean isActive(){
        if (! existing) return false;
        try {
            return ENABLED_PARAMETER.fromJson(parameters);
        }catch (Exception e){}
        return false;
    }


    private String getKey() throws JSONException {
        return TYPENAME+":"+getPluginName();
    }
    private void unregisterCharts(boolean reset) throws JSONException {
        ChartHandler chartHandler = gpsService.getChartHandler();
        if (chartHandler != null) {
            chartHandler.removeExternalCharts(getKey());
        }
        if (reset) charts=null;
        status.unsetChildStatus(C_CHARTS);
    }
    private void unregisterAddons(boolean reset) throws JSONException {
        AddonHandler addonHandler=gpsService.getAddonHandler();
        if (addonHandler != null){
            addonHandler.removeExternalAddons(getKey());
        }
        if (reset) addons=null;
        status.unsetChildStatus(C_ADDONS);
    }
    private void registerCharts(JSONArray charts) throws JSONException {
        ChartHandler chartHandler=gpsService.getChartHandler();
        if (chartHandler == null) {
            status.unsetChildStatus(C_CHARTS);
            return;
        }
        chartHandler.addExternalCharts(getKey(),charts,"plugin: "+getPluginName());
        this.charts=charts;
        status.setChildStatus(C_CHARTS, WorkerStatus.Status.NMEA,charts.length()+" registered");
    }

    private void registerAddons(JSONArray addonsJson) throws JSONException {
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
                    Log.e(Constants.LOGPRFX, "unable to handle addons for " + getPluginName(), e);
                }
            }
            addonHandler.addExternalAddons(getKey(), addons);
            status.setChildStatus(C_ADDONS, WorkerStatus.Status.NMEA,addons.size()+" registered");
            this.addons=addonsJson;
        }
    }



    @Override
    public void stop() {
        super.stop();
        try {
            unregisterAddons(false);
            unregisterCharts(false);
        }catch (JSONException e){}
    }

    @Override
    public synchronized JSONObject getJsonStatus() throws JSONException {
        if (! existing) return null;
        return super.getJsonStatus();
    }
}
