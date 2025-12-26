package de.wellenvogel.avnav.worker;

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

import org.json.JSONException;
import org.json.JSONObject;

import de.wellenvogel.avnav.appapi.ExtendedWebResourceResponse;
import de.wellenvogel.avnav.util.AvnUtil;

/**
 * interface to be implemented by PluginWorkers
 * will be used by the plugin manager to access the information
 */
public interface IPluginHandler {
    public static final String FT_JS="js";
    public static final String FT_MJS="mjs";
    public static final String FT_CSS="css";
    public static final String FT_PYTHON="python";
    public static final String FT_CFG="cfg";
    static final AvnUtil.ItemMap<String> PLUGINFILES= new AvnUtil.ItemMap<>(
            new AvnUtil.KeyValue<String>(FT_CSS, "plugin.css"),
            new AvnUtil.KeyValue<String>(FT_JS, "plugin.js"),
            new AvnUtil.KeyValue<String>(FT_MJS, "plugin.mjs"),
            new AvnUtil.KeyValue<String>(FT_CFG, "plugin.json"),
            new AvnUtil.KeyValue<String>(FT_PYTHON, "plugin.py")
            );
    public static final String K_NAME="name";
    public static String K_ACTIVE="active";
    public static final String K_BASE="base"; //url base for plugin files
    public static final String K_CHARTPREFIX="chartPrefix";

    /**
     * return an json object with the keys K_NAME,K_DIR and for each existing file
     * of PLUGINFILES it returns an entry with the key and the value being the relative path
     * @return
     * @throws JSONException
     */
    JSONObject getFiles() throws JSONException;

    public static String IK_NAME=K_NAME;
    public static String IK_ID="handlerId";
    public static String IK_CHILD="child";
    public static String IK_EDIT="canEdit";
    public static String IK_DOWNLOAD="canDownload";
    public static String IK_ACTIVE=K_ACTIVE;

    //keys for the fileinfo object returned in getFiles
    public static String IK_FURL="url";
    public static String IK_FTS ="timestamp";

    /**
     * get the info item for this plugin for list and info requests
     * @return
     * @throws JSONException
     */
    JSONObject getInfo() throws JSONException;

    /**
     * open a file from the plugin
     * @param relativePath - the (OS dependent) relative path - already URL decoded
     * @return
     * @throws Exception
     */
    ExtendedWebResourceResponse openFile(String relativePath) throws Exception;

    /**
     * get the handler id
     * @return
     */
    int getId();

    String getName();

    String getKey();
}
