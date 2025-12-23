package de.wellenvogel.avnav.worker;

import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;

import de.wellenvogel.avnav.appapi.AddonHandler;
import de.wellenvogel.avnav.charts.ChartHandler;
import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.util.AvnLog;

/*
# Copyright (c) 2022,2025 Andreas Vogel andreas@wellenvogel.net

#  Permission is hereby granted, free of charge, to any person obtaining a
#  copy of this software and associated documentation files (the "Software"),
#  to deal in the Software without restriction, including without limitation
#  the rights to use, copy, modify, merge, publish, distribute, sublicense,
#  and/or sell copies of the Software, and to permit persons to whom the
#  Software is furnished to do so, subject to the following conditions:
#
#  The above copyright notice and this permission notice shall be included
#  in all copies or substantial portions of the Software.
#
#  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
#  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
#  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
#  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
#  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
#  DEALINGS IN THE SOFTWARE.
*/
public abstract class PluginHandlerBase {
    private static final String C_CHARTS="charts";
    private static final String C_ADDONS="addons";
    private GpsService gpsService;
    private String baseUrl;
    private WorkerStatus status;
    protected PluginHandlerBase(GpsService ctx,WorkerStatus status,String baseUrl) {
        gpsService=ctx;
        this.status=status;
        this.baseUrl=baseUrl;
        if (this.baseUrl != null && ! this.baseUrl.endsWith("/")){
            this.baseUrl+="/";
        }
    }
    protected JSONArray charts=null;
    protected JSONArray addons=null;

    void onStart(){
        JSONArray charts;
        JSONArray addons;
        charts=this.charts;
        addons=this.addons;
        if (charts != null) registerCharts(charts);
        if (addons != null) registerAddons(addons);
    }
    void onStop(boolean reset){
        unregisterCharts(reset);
        unregisterAddons(reset);
    }
    void unregisterCharts(boolean reset) {
        ChartHandler chartHandler = gpsService.getChartHandler();
        if (chartHandler != null) {
            chartHandler.removeExternalCharts(getKey());
        }
        if (reset) charts=null;
        if (status != null) status.unsetChildStatus(C_CHARTS);
    }
    void unregisterAddons(boolean reset){
        AddonHandler addonHandler=gpsService.getAddonHandler();
        if (addonHandler != null){
            addonHandler.removeExternalAddons(getKey());
        }
        if (reset) addons=null;
        if (status != null)status.unsetChildStatus(C_ADDONS);
    }
    void registerCharts(JSONArray charts){
        ChartHandler chartHandler=gpsService.getChartHandler();
        if (chartHandler == null) {
            if (status != null)status.unsetChildStatus(C_CHARTS);
            return;
        }
        if (baseUrl != null){
            try{
                for (int i=0;i<charts.length();i++){
                    JSONObject chart=charts.getJSONObject(i);
                    chart.put("baseUrl",baseUrl);
                }
            }catch (Exception e){
                AvnLog.d("error inserting baseUrl in charts "+e);
            }
        }
        chartHandler.addExternalCharts(getKey(),charts);
        this.charts=charts;
        if (status != null)status.setChildStatus(C_CHARTS, WorkerStatus.Status.NMEA,charts.length()+" registered");
    }

    void registerAddons(JSONArray addonsJson) {
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
                    Log.e(Constants.LOGPRFX, "unable to handle addons for " + getKey(), e);
                }
            }
            addonHandler.addExternalAddons(getKey(), addons);
            if (status != null)status.setChildStatus(C_ADDONS, WorkerStatus.Status.NMEA,addons.size()+" registered");
            this.addons=addonsJson;
        }
    }

    protected abstract String getKey();

}
