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


import android.content.Context;
import android.net.Uri;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.PipedInputStream;
import java.io.PipedOutputStream;
import java.io.UnsupportedEncodingException;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

import de.wellenvogel.avnav.appapi.AddonHandler;
import de.wellenvogel.avnav.appapi.DirectoryRequestHandler;
import de.wellenvogel.avnav.appapi.ExtendedWebResourceResponse;
import de.wellenvogel.avnav.appapi.PostVars;
import de.wellenvogel.avnav.appapi.RequestHandler;
import de.wellenvogel.avnav.charts.ChartHandler;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;

public class PluginManager extends DirectoryRequestHandler {

    static class Plugin{
        static final long MAX_CFG=100000;
        public String name;
        long lastModified;
        File dir;
        JSONObject config=null;
        JSONObject currentValues=new JSONObject();
        EditableParameter.ParameterList parameters=new EditableParameter.ParameterList(ENABLED_PARAMETER);
        boolean ready=false;
        boolean prepared=false;
        GpsService gpsService;
        WorkerStatus status;
        JSONObject infoActive=new JSONObject();
        JSONObject infoInactive=new JSONObject();
        String pluginUrlBase;
        public Plugin(String name,File dir,WorkerStatus status,String urlPrefix){
            this.name=name;
            this.dir=dir;
            this.lastModified=dir.lastModified();
            this.status=status;
            this.pluginUrlBase=urlPrefix;
        }
        void prepare() throws Exception {
            for (JSONObject jo: new JSONObject[]{infoActive,infoInactive}){
                jo.put(IPluginHandler.K_NAME,name);
                jo.put(IPluginHandler.K_BASE,pluginUrlBase);
                for (AvnUtil.KeyValue<String> item : IPluginHandler.PLUGINFILES.values()) {
                    File pf = new File(dir, item.value);
                    if (pf.exists()) {
                        JSONObject info=new JSONObject();
                        info.put(IPluginHandler.IK_FURL,pluginUrlBase+ "/" + URLEncoder.encode(pf.getName(),"utf-8"));
                        info.put(IPluginHandler.IK_FTS,pf.lastModified());
                        jo.put(item.key, info);
                    }
                }
            }
            infoActive.put(IPluginHandler.IK_ACTIVE,true);
            infoInactive.put(IPluginHandler.IK_ACTIVE,false);
            String cfgName=IPluginHandler.PLUGINFILES.get(IPluginHandler.FT_CFG).value;
            File cfgFile=new File(dir,cfgName);
            if (cfgFile.exists() && cfgFile.canRead()){
                config=AvnUtil.readJsonFile(cfgFile,MAX_CFG);
            }
            prepared=true;
        }

        boolean mustUpdate(Plugin other){
            if (other == null) return true;
            return lastModified != other.lastModified;
        }

        void start(GpsService gpsService){
            this.gpsService = gpsService;
            if (!prepared) {
                try {
                    prepare();
                } catch (Exception e) {
                    status.setChildStatus(name, WorkerStatus.Status.ERROR, e.getMessage());
                }
                prepared = true;
                return;
            }
            if (config != null) {
                //todo register
            }
            setStatus();
        }
        void setStatus(){
            if (enabled()) {
                status.setChildStatus(name, WorkerStatus.Status.NMEA, "running", true);
            } else {
                status.setChildStatus(name, WorkerStatus.Status.INACTIVE, "disabled", true);
            }
        }
        boolean enabled(){
            try {
                return ENABLED_PARAMETER.fromJson(currentValues);
            } catch (JSONException e) {
                return true;
            }
        }
        void stop(boolean fin){
            ready=false;
            if (fin){
                status.unsetChildStatus(name);
            }
            if (gpsService == null) return;
            ChartHandler ch=gpsService.getChartHandler();
            if (ch != null) ch.removeExternalCharts(name);
            AddonHandler ah=gpsService.getAddonHandler();
            if (ah != null) ah.removeExternalAddons(name);
        }

        JSONObject toJson() throws JSONException {
            JSONObject rt=new JSONObject();
            rt.put(IPluginHandler.IK_NAME,name);
            rt.put(IPluginHandler.IK_DOWNLOAD,true);
            rt.put("time",lastModified/1000);
            rt.put("downloadName",dir.getName()+".zip");
            rt.put("checkPrefix",USER_PREFIX);
            rt.put(IPluginHandler.IK_CHILD,name);
            rt.put(IPluginHandler.IK_ID,status.id);
            rt.put(IPluginHandler.IK_ACTIVE,enabled());
            rt.put("type",RequestHandler.TYPE_PLUGINS);
            return rt;
        }

        JSONObject toInfo() throws JSONException {
            JSONObject rt;
            if (enabled()) rt=infoActive;
            else rt=infoInactive;
            ChartHandler ch=gpsService.getChartHandler();
            if (ch != null){
                rt.put(IPluginHandler.K_CHARTPREFIX,ch.getExternalChartsPrefix(name));
            }
            return rt;
        }

        void updateParameters(JSONObject newParam,boolean handleEnable) throws JSONException {
            if (newParam == null) return;
            boolean enabled=enabled();
            for (EditableParameter.EditableParameterInterface p:parameters){
                if (newParam.has(p.getName())){
                    currentValues.put(p.getName(),newParam.get(p.getName()));
                }
            }
            if (handleEnable){
                if (enabled != enabled()){
                    if (enabled()){
                        if (gpsService != null) start(gpsService);
                    }
                    else{
                        stop(false);
                    }
                }
            }
        }

    }

    static final String UPLOAD_BASE ="__upload";
    static final String USER_PREFIX="user-";

    HashMap<String,Plugin> plugins=new HashMap<>();
    JSONObject childParameterValues=new JSONObject();
    private final Object createLock=new Object();
    public PluginManager(String type, GpsService ctx, File workDir, String urlPrefrix) throws IOException {
        super(type, ctx, workDir, urlPrefrix, null);
    }

    private Plugin createPlugin(File pdir) throws UnsupportedEncodingException {
        String name=USER_PREFIX+pdir.getName();
        Plugin plugin=new Plugin(name,pdir,status,getUrlFromName(name));
        try {
            plugin.prepare();
            synchronized (createLock){
                plugin.updateParameters(childParameterValues.optJSONObject(plugin.name),false);
            }
        } catch (Exception e) {
            AvnLog.e("error preparing plugin "+name,e);
        }
        return plugin;
    }
    private HashMap<String,Plugin> readPlugins() throws UnsupportedEncodingException {
        HashMap<String,Plugin> rt=new HashMap<>();
        for (File f : workDir.listFiles()) {
            if (!f.isDirectory()) continue;
            Plugin plugin=createPlugin(f);
            rt.put(plugin.name,plugin);
        }
        return rt;
    }

    private void updatePlugins(HashMap<String,Plugin> newPlugins,boolean removeOther){
        ArrayList<Plugin> cleanups=new ArrayList<>();
        synchronized (createLock){
            for (String name:newPlugins.keySet()){
                Plugin newPlugin=newPlugins.get(name);
                Plugin oldPlugin=plugins.get(name);
                if (oldPlugin == null || oldPlugin.mustUpdate(newPlugin)){
                    if (oldPlugin != null) oldPlugin.stop(true);
                    try {
                        newPlugin.start(gpsService);
                    } catch (Exception e) {
                        AvnLog.e("unable to prepare plugin "+newPlugin.name,e);
                    }
                    plugins.put(newPlugin.name,newPlugin);
                }
                else{
                    oldPlugin.setStatus();
                }
            }
            if (removeOther){
                for (Plugin plugin:plugins.values()){
                    if (newPlugins.get(plugin.name) == null){
                        cleanups.add(plugin);
                    }
                }
                for (Plugin plugin:cleanups){
                    plugins.remove(plugin.name);
                }
            }
        }
    }
    private void updatePlugin(Plugin plugin){
        HashMap<String,Plugin> plugins=new HashMap<>();
        plugins.put(plugin.name,plugin);
        updatePlugins(plugins,false);
    }


    @Override
    public void start(PermissionCallback permissionCallback) {
        if (mainThread != null){
            stopAndWait();
        }
        gpsService.updateConfigSequence(); //TODO: could be more granular
        try{
            for (File f:workDir.listFiles()){
                if (f.isFile() && f.getName().startsWith(UPLOAD_BASE)){
                    f.delete();
                }
            }
        }catch (Throwable t){
            AvnLog.e("error cleaning up plugin dir",t);
        }
        setStatus(WorkerStatus.Status.NMEA,"running");
        super.start(permissionCallback);
    }

    @Override
    public void stop() {
        super.stop();
    }

    @Override
    protected void run(int startSequence) throws JSONException, IOException {
        while(! shouldStop(startSequence)){
            try{
                HashMap<String, Plugin> current = readPlugins();
                updatePlugins(current, true);
                setStatus(WorkerStatus.Status.NMEA,"running");
            }catch (Exception e){
                setStatus(WorkerStatus.Status.ERROR,"unable to read plugins "+e.getMessage());
            }
            sleep(60000);
        }
    }

    private List<IPluginHandler> getExternalPlugins(){
        List<IWorker> handler=gpsService.findWorkersByType(ExternalPluginWorker.TYPENAME);
        ArrayList<IPluginHandler> rt=new ArrayList<>();
        for (IWorker w:handler){
            try{
                IPluginHandler ph=(IPluginHandler) w;
                rt.add(ph);
            }catch (Exception e){}
        }
        return rt;
    }


    private void zip(File file, ZipOutputStream zos) throws IOException
    {
        zip(file, file.getName(), zos);
    }

    // name is the name for the file
    private void zip(File file, String name, ZipOutputStream zos) throws IOException
    {
        if (file.isDirectory())
        {
            boolean hasEntries=false;
            File[] files = file.listFiles();
            if (files != null) // always check, in case the folder can't be read
            {
                for (File f: files)
                {
                    String childName = name + "/" + f.getName();
                    zip(f, childName, zos);
                    hasEntries=true;
                }
            }
            if (! hasEntries){
                ZipEntry de=new ZipEntry(name+"/");
                zos.putNextEntry(de);
            }
        }
        else
        {
            AvnLog.d("zipping "+name);
            FileInputStream fis = new FileInputStream(file);
            ZipEntry zipEntry = new ZipEntry(name);
            zos.putNextEntry(zipEntry);
            byte[] bytes = new byte[4096];
            long written=0;
            int length;
            while((length = fis.read(bytes)) >= 0) {
                zos.write(bytes, 0, length);
                written+=length;
            }
            AvnLog.d("zip written "+written+" for "+name);
            zos.closeEntry();
            zos.flush();
            fis.close();
        }
    }

    @Override
    public ExtendedWebResourceResponse handleDownload(String name, Uri uri) throws Exception {
        Plugin plugin=null;
        synchronized (createLock){
            plugin=plugins.get(name);
            if (plugin == null) return null;
        }
        final File found=plugin.dir;
        PipedInputStream is=new PipedInputStream();
        ZipOutputStream zos=new ZipOutputStream(new PipedOutputStream(is));
        Thread writer=new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    AvnLog.d("start sending zip for "+name);
                    zip(found,zos);
                    AvnLog.d("zip done for "+name);
                    zos.close();
                } catch (IOException e) {
                    AvnLog.e("error zipping plugin "+name,e);
                    try {
                        is.close();
                    } catch (IOException ex) {
                        throw new RuntimeException(ex);
                    }
                }
            }
        });
        writer.setDaemon(true);
        writer.start();
        return new ExtendedWebResourceResponse(
                -1,
                "application/octet-stream",
                "",
                is
        );
    }

    private String checkPathParts(String [] parts,boolean decode) throws Exception{
        return checkPathParts(parts,decode,0);
    }
    private String checkPathParts(String [] parts,boolean decode,int start) throws Exception{
        StringBuilder rt=new StringBuilder();
        try {
            for (int i=start;i<parts.length;i++) {
                String part=parts[i];
                if (decode) part = URLDecoder.decode(part, "UTF-8");
                safeName(part, true);
                if (part.indexOf(':') >= 0)
                    throw new Exception("no : allowed");
                if (part.indexOf(File.separatorChar) >= 0){
                    throw new Exception("no "+File.separatorChar+" allowed in name parts");
                }
                if (rt.length() == 0) rt.append(part);
                else rt.append(File.separatorChar).append(part);
            }
        }
        catch (Throwable t){
            throw new Exception("error in "+String.join("/",parts)+" : "+t.getMessage());
            }
        return rt.toString();
    }
    private String checkEntryPath(ZipEntry entry,String pname) throws Exception{
        String [] parts=entry.getName().split("/");
        if (parts.length < 1) throw new Exception("0 name parts in zip entry "+entry.getName());
        if (! pname.equals(parts[0])) throw new Exception("zip entry "+entry.getName()+" not below "+pname);
        if (!entry.isDirectory()){
            if (parts.length < 2) throw new Exception("file "+entry.getName()+" must be in subdir below "+pname);
        }
        return checkPathParts(parts,false);
    }
    static class NoCloseWrapper extends InputStream {
        InputStream stream;
        public NoCloseWrapper(InputStream is){
            stream=is;
        }
        @Override
        public int read() throws IOException {
            return stream.read();
        }

        @Override
        public int available() throws IOException {
            return stream.available();
        }

        @Override
        public void close() throws IOException {
        }

        @Override
        public int read(byte[] b, int off, int len) throws IOException {
            return stream.read(b, off, len);
        }

        @Override
        public int read(byte[] b) throws IOException {
            return stream.read(b);
        }



        @Override
        public long skip(long n) throws IOException {
            return stream.skip(n);
        }

        @Override
        public synchronized void reset() throws IOException {
            stream.reset();
        }
    }
    @Override
    public boolean handleUpload(PostVars postData, String name, boolean ignoreExisting, boolean completeName) throws Exception {
        name=safeName(name,true);
        if (name.startsWith(UPLOAD_BASE)) throw new Exception("plugin names must not start with "+UPLOAD_BASE);
        File existing=new File(workDir,name);
        if (existing.exists() && ! ignoreExisting){
            throw new Exception("plugin "+name+" already exists");
        }
        if (existing.isFile()){
            throw new Exception("a file with name "+name+" exists in plugins directory");
        }
        //we first upload everything before we unpack
        //the chance that something goes wrong during upload is bigger then during unpacking
        //so we try to keep the plugin intact if it already exists but the upload gets interrupted
        String uploadName= UPLOAD_BASE +Thread.currentThread().getId();
        boolean rt= super.handleUpload(postData, uploadName, true, true);
        if (! rt){
            throw new Error("unable to upload to "+uploadName);
        }
        File uploaded=new File(workDir,uploadName);
        try {
            ZipInputStream zis = new ZipInputStream(new FileInputStream(uploaded));
            //do some analysis of the zip
            ZipEntry e = zis.getNextEntry();
            while (e != null) {
                checkEntryPath(e, name);
                e = zis.getNextEntry();
            }
            zis.close();
            zis = new ZipInputStream(new FileInputStream(uploaded));
            e = zis.getNextEntry();
            while (e != null) {
                File of = new File(workDir, checkEntryPath(e, name));
                File dir = e.isDirectory() ? of : of.getParentFile();
                if (dir.exists() && !dir.isDirectory()) {
                    AvnUtil.deleteRecursive(dir);
                }
                if (!dir.exists()) {
                    dir.mkdirs();
                }
                if (!dir.isDirectory()) {
                    throw new Exception("unable to create directory " + dir.getAbsolutePath());
                }
                if (!e.isDirectory()) {
                    writeAtomic(of, new NoCloseWrapper(zis), true, e.getSize());
                }
                e = zis.getNextEntry();
            }
            zis.close();
            existing.setLastModified(System.currentTimeMillis()); //ensure the plugin is considered to be new
        }catch (Throwable t){
            AvnLog.e("exception in plugin upload for "+name,t);
            throw t;
        }
        Plugin newPlugin=createPlugin(existing);
        updatePlugin(newPlugin);
        gpsService.updateConfigSequence();
        return true;
    }

    @Override
    public JSONArray handleList(Uri uri, RequestHandler.ServerInfo serverInfo) throws Exception {
        JSONArray rt=new JSONArray();
        synchronized (createLock){
            for (Plugin plugin:plugins.values()){
                JSONObject jo=plugin.toJson();
                jo.put(IPluginHandler.IK_EDIT,serverInfo==null);
                rt.put(jo);
            }
        }
        List<IPluginHandler> externals=getExternalPlugins();
        for (IPluginHandler ph:externals){
            JSONObject hi=ph.getInfo();
            if (hi != null && hi.has(IPluginHandler.IK_NAME)){
                hi.put(IPluginHandler.IK_EDIT,serverInfo == null);
                rt.put(hi);
            }
        }
        return rt;
    }

    @Override
    public boolean handleDelete(String name, Uri uri) throws Exception {
        File pdir;
        synchronized (createLock){
            Plugin plugin=plugins.get(name);
            if (plugin == null) throw new Exception("plugin "+name+" not found");
            plugin.stop(true);
            plugins.remove(name);
            pdir=plugin.dir;
        }
        boolean rt= AvnUtil.deleteRecursive(pdir);
        if (rt) {
            try {
                gpsService.updateWorkerConfig(this,null,null);
            } catch (Exception e) {
                AvnLog.e("unable to update plugin config",e);
            }
            gpsService.updateConfigSequence();
        }
        return rt;
    }

    @Override
    public boolean handleRename(String oldName, String newName) throws Exception {
        throw new Exception("cannot rename plugins");
    }

    @Override
    protected JSONObject handleSpecialApiRequest(String command, Uri uri, PostVars postData, RequestHandler.ServerInfo serverInfo) throws Exception {
        if ("pluginInfo".equals(command)){
            ChartHandler chartHandler = gpsService.getChartHandler();
            String rname=uri.getQueryParameter("name");
            JSONArray rt=new JSONArray();
            synchronized (createLock){
                for (Plugin plugin:plugins.values()){
                     if (rname != null && ! rname.equals(plugin.name)) continue;
                     JSONObject po=plugin.toInfo();
                     rt.put(po);
                }
            }
            List<IPluginHandler> externals=getExternalPlugins();
            for (IPluginHandler ph:externals){
                JSONObject po=ph.getFiles();
                if (po != null && po.has(IPluginHandler.K_NAME)){
                    if (rname != null) {
                        if (! rname.equals(po.getString(IPluginHandler.K_NAME))) continue;
                    }
                    for (String k:IPluginHandler.PLUGINFILES.keySet()){
                        try {
                            if (po.has(k)) {
                                JSONObject finfo=po.getJSONObject(k);
                                String relativePath = finfo.getString(IPluginHandler.IK_FURL);
                                finfo.put(IPluginHandler.IK_FURL, getUrlFromName(ph.getName() + "/" + relativePath));
                            }
                        }catch (Exception e){
                            AvnLog.e("invalid structure of getFiles from "+ph.getName(),e);
                        }
                    }
                    po.put(IPluginHandler.K_BASE,getUrlFromName(ph.getName()));
                    if (chartHandler != null) {
                        po.put(IPluginHandler.K_CHARTPREFIX, chartHandler.getExternalChartsPrefix(ph.getName()));
                    }
                    rt.put(po);
                }
            }
            return RequestHandler.getReturn(new AvnUtil.KeyValue<JSONArray>("data",rt));
        }
        return RequestHandler.getErrorReturn("command "+command+" not available");
    }


    @Override
    public ExtendedWebResourceResponse handleDirectRequest(Uri uri, RequestHandler handler, String method) throws Exception {
        String path = uri.getPath();
        if (path == null) return null;
        if (path.startsWith("/")) path = path.substring(1);
        if (!path.startsWith(urlPrefix)) return null;
        path = path.substring((urlPrefix.length() + 1));
        String[] parts = path.split("/");
        if (parts.length < 2) return null;
        String baseName=URLDecoder.decode(parts[0], "UTF-8");
        if (baseName.startsWith(USER_PREFIX)) {
            File base = null;
            synchronized (createLock) {
                Plugin plugin = plugins.get(baseName);
                if (plugin == null) return null;
                //allow to access plugin.json even if disabled
                if (!plugin.enabled() && !parts[1].equals(IPluginHandler.PLUGINFILES.get(IPluginHandler.FT_CFG).value)) return null;
                base = plugin.dir;
            }
            String fpath = checkPathParts(parts, true, 1);
            File finalFile = new File(base, fpath);
            if (finalFile.isDirectory()) throw new Error(finalFile.getPath() + " is a directory");
            if (!finalFile.exists()) return null;
            ExtendedWebResourceResponse rt=new ExtendedWebResourceResponse(finalFile, RequestHandler.mimeType(finalFile.getName()), "");
            rt.setHeader("Cache-Control","no-store");
            return rt;
        }
        else{
            List<IPluginHandler> externals=getExternalPlugins();
            for (IPluginHandler ep:externals){
                if (ep.getName().equals(baseName)){
                    return ep.openFile(checkPathParts(parts,true,1));
                }
            }
        }
        throw new Exception("no plugin "+baseName+" found");
    }

    @Override
    public synchronized JSONObject getEditableParameters(String child, boolean includeCurrent, Context context) throws JSONException {
        if (child != null) {
            JSONObject rt = super.getEditableParameters(null, false, context);
            synchronized (createLock) {
                Plugin plugin=plugins.get(child);
                if (plugin == null) throw new JSONException("plugin "+child+" not found");
                rt.put("data", plugin.parameters.toJson(context));
                if (includeCurrent) {
                    rt.put("values", plugin.currentValues);
                }
            }
            return rt;
        }
        return super.getEditableParameters(child, includeCurrent, context);
    }
    private final static String CHILD_PARAM_NAME="children";
    @Override
    public synchronized void setParameters(String child, JSONObject newParam, boolean replace, boolean check) throws JSONException, IOException {
        if (newParam == null) return;
        if (child != null){
            JSONObject nv=new JSONObject();
            synchronized (createLock) {
                Plugin plugin = plugins.get(child);
                if (plugin == null) throw new IOException("plugin " + child + " not found");
                plugin.updateParameters(newParam, true);
                childParameterValues.put(plugin.name, plugin.currentValues);
                nv.put(CHILD_PARAM_NAME, childParameterValues);
            }
            super.setParameters(null,nv,false,false);
            return;
        }
        synchronized (createLock){
            if (newParam.has(CHILD_PARAM_NAME)){
                childParameterValues=newParam.getJSONObject(CHILD_PARAM_NAME);
                for (Iterator<String> it = childParameterValues.keys(); it.hasNext(); ) {
                    String k = it.next();
                    Plugin plugin=plugins.get(k);
                    if (plugin != null){
                        try {
                            plugin.updateParameters(childParameterValues.getJSONObject(k),true);
                        }catch (Exception e){
                            AvnLog.e("unable to update plugin "+k,e);
                        }
                    }
                }
            }
        }
        super.setParameters(null, newParam, replace, check);
    }

}
