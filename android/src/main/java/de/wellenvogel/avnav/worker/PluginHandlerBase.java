package de.wellenvogel.avnav.worker;

import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

import de.wellenvogel.avnav.appapi.IPluginAware;
import de.wellenvogel.avnav.charts.Chart;
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
    private static final String C_LAYOUTS="layouts";
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
    protected List<IPluginAware.PluginItem> layouts=null;

    void onStart() throws Exception {
        JSONArray charts;
        JSONArray addons;
        charts=this.charts;
        addons=this.addons;
        registerCharts(charts);
        registerAddons(addons);
        List<IPluginAware.PluginItem> layouts=this.layouts;
        registerLayouts(layouts);
    }
    void onStop(boolean reset){
        unregisterCharts(reset);
        unregisterAddons(reset);
        unregisterLayouts(reset);
    }
    void onDelete(){
        onStop(true);
        IPluginAware chartHandler = gpsService.getPluginAwareHandler(Constants.TYPE_CHART);
        if (chartHandler != null) {
            chartHandler.removePluginItems(getKey(),true);
        }
    }
    void unregisterCharts(boolean reset) {
        IPluginAware chartHandler = gpsService.getPluginAwareHandler(Constants.TYPE_CHART);
        if (chartHandler != null) {
            chartHandler.removePluginItems(getKey(),false);
        }
        if (reset) charts=null;
        if (status != null) status.unsetChildStatus(C_CHARTS);
    }
    void unregisterAddons(boolean reset){
        IPluginAware addonHandler=gpsService.getPluginAwareHandler(Constants.TYPE_ADDON);
        if (addonHandler != null){
            addonHandler.removePluginItems(getKey(),false);
        }
        if (reset) addons=null;
        if (status != null)status.unsetChildStatus(C_ADDONS);
    }
    void unregisterLayouts(boolean reset){
        if (reset) this.layouts=null;
        IPluginAware layoutHandler = gpsService.getPluginAwareHandler(Constants.TYPE_LAYOUT);
        if (layoutHandler != null) {
            try {
                layoutHandler.removePluginItems(getKey(), false);
            } catch (Exception e) {
               AvnLog.e("unable to deregister layouts",e);
            }
            if (status != null) status.unsetChildStatus(C_LAYOUTS);
        }
    }
    void registerCharts(JSONArray charts){
        if (charts == null){
            unregisterCharts(true);
            return;
        }
        IPluginAware chartHandler = gpsService.getPluginAwareHandler(Constants.TYPE_CHART);
        if (chartHandler == null) {
            if (status != null)status.unsetChildStatus(C_CHARTS);
            return;
        }
        ArrayList<IPluginAware.PluginItem> pluginCharts=new ArrayList<>();
            try{
                for (int i=0;i<charts.length();i++){
                    JSONObject chart=charts.getJSONObject(i);
                    if (baseUrl != null) {
                        chart.put("baseUrl", baseUrl);
                    }
                    if (!chart.has(Chart.CKEY)) {
                        AvnLog.e("chart without name");
                        continue;
                    }
                    String name=chart.getString(Chart.CKEY);
                    pluginCharts.add(new IPluginAware.PluginItem(name,chart));
                }
            }catch (Exception e){
                AvnLog.d("error adding charts "+e);
            }
        try {
            chartHandler.setPluginItems (getKey(), pluginCharts);
            this.charts = charts;
            if (status != null)
                status.setChildStatus(C_CHARTS, WorkerStatus.Status.NMEA, charts.length() + " registered");
        }catch (Exception e){
            if (status != null){
                status.setChildStatus(C_CHARTS, WorkerStatus.Status.ERROR,e.getMessage());
            }
        }
    }

    void registerAddons(JSONArray addonsJson) throws Exception {
        if (addonsJson == null){
            unregisterAddons(true);
            return;
        }
        IPluginAware addonHandler = gpsService.getPluginAwareHandler(Constants.TYPE_ADDON);
        if (addonHandler != null) {
            ArrayList<IPluginAware.PluginItem> addons = new ArrayList<>();
            for (int i = 0; i < addonsJson.length(); i++) {
                try {
                    JSONObject addon = addonsJson.getJSONObject(i);
                    String name="addon"+i;
                    if (addon.has("name")) name=addon.getString("name");
                    IPluginAware.PluginItem pi=new IPluginAware.PluginItem(name,addon);
                    addons.add(pi);
                } catch (Exception e) {
                    Log.e(Constants.LOGPRFX, "unable to handle addons for " + getKey(), e);
                    throw e;
                }
            }
            try {
                addonHandler.setPluginItems(getKey(), addons);
                if (status != null)status.setChildStatus(C_ADDONS, WorkerStatus.Status.NMEA,addons.size()+" registered");
                this.addons=addonsJson;
            }catch (Exception e){
                AvnLog.e("error adding addons for "+getKey(),e);
                if (status != null) status.setChildStatus(C_ADDONS, WorkerStatus.Status.ERROR,e.getMessage());
                throw e;
            }
        }
    }

    public void registerLayouts(List<IPluginAware.PluginItem> layouts){
        this.layouts=null;
        if (layouts == null) {
            unregisterLayouts(false);
            return;
        }
        IPluginAware layoutHandler = gpsService.getPluginAwareHandler(Constants.TYPE_LAYOUT);
        if (layoutHandler != null){
            try {
                layoutHandler.setPluginItems(getKey(),layouts);
                if (status != null) status.setChildStatus(C_LAYOUTS, WorkerStatus.Status.NMEA,layouts.size()+" registered");
                this.layouts=layouts;
            } catch (Exception e) {
                AvnLog.e("unable to register layouts",e);
                if (status != null) status.setChildStatus(C_LAYOUTS, WorkerStatus.Status.ERROR,e.getMessage());

            }
        }
    }

    protected abstract String getKey();

}
