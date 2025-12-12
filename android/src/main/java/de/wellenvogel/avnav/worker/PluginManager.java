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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

import de.wellenvogel.avnav.appapi.DirectoryRequestHandler;
import de.wellenvogel.avnav.appapi.ExtendedWebResourceResponse;
import de.wellenvogel.avnav.appapi.PostVars;
import de.wellenvogel.avnav.appapi.RequestHandler;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;

public class PluginManager extends DirectoryRequestHandler {

    static final String UPLOAD_BASE ="__upload";
    static final String USER_PREFIX="user-";
    EditableParameter.ParameterList childParameters=new EditableParameter.ParameterList(ENABLED_PARAMETER);

    JSONObject childParameterValues=new JSONObject();
    private final Object createLock=new Object();
    public PluginManager(String type, GpsService ctx, File workDir, String urlPrefrix) throws IOException {
        super(type, ctx, workDir, urlPrefrix, null);
    }


    @Override
    public void start(PermissionCallback permissionCallback) {
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
        for (File f:workDir.listFiles()){
            if (!f.isDirectory()) continue;
            setChildStatus(USER_PREFIX+f.getName());
        }
    }

    @Override
    public void stop() {
        super.stop();
    }

    @Override
    protected void run(int startSequence) throws JSONException, IOException {
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

    private void setChildStatus(String name){
        boolean enabled=true;
        synchronized (createLock){
            try{
                JSONObject jo=childParameterValues.getJSONObject(name);
                enabled=ENABLED_PARAMETER.fromJson(jo);
            }catch (Throwable t){}
        }
        if (enabled){
            status.setChildStatus(name, WorkerStatus.Status.NMEA,"running",true);
        }
        else{
            status.setChildStatus(name, WorkerStatus.Status.INACTIVE,"disabled",true);
        }
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
        File found=findLocalFile(name);
        if (found == null) return null;
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
        }catch (Throwable t){
            AvnLog.e("exception in plugin upload for "+name,t);
            throw t;
        }
        setChildStatus(USER_PREFIX+name);
        return true;
    }
    String pluginFileToName(File plugin){
        return USER_PREFIX+plugin.getName();
    }
    @Override
    protected JSONObject fileToItem(File localFile) throws JSONException, UnsupportedEncodingException {
        if (!localFile.isDirectory()) return null;
        String name=pluginFileToName(localFile);
        JSONObject jo= super.fileToItem(localFile);
        jo.put("name",name);
        jo.put("canDownload",true);
        jo.put("downloadName",localFile.getName()+".zip");
        jo.put("checkPrefix",USER_PREFIX);
        jo.put(IPluginHandler.IK_CHILD,name);
        jo.put(IPluginHandler.IK_ID,getId());
        jo.put(IPluginHandler.IK_ACTIVE,isActive(name));
        return jo;
    }

    @Override
    public JSONArray handleList(Uri uri, RequestHandler.ServerInfo serverInfo) throws Exception {
        JSONArray rt=new JSONArray();
        for (File localFile: workDir.listFiles()) {
            if (localFile.isDirectory()){
                JSONObject jo=fileToItem(localFile);
                if (jo != null) {
                    jo.put(IPluginHandler.IK_EDIT,serverInfo==null);
                    rt.put(jo);
                }
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
    private void removeChild(String name){
       status.unsetChildStatus(name);
       synchronized (createLock){
           if (childParameterValues.has(name)){
               childParameterValues.remove(name);
           }
       }
        try {
            gpsService.updateWorkerConfig(this,null,null);
        } catch (Exception e) {
            AvnLog.e("unable to update plugin config",e);
        }
    }

    @Override
    public boolean handleDelete(String name, Uri uri) throws Exception {
        File pdir=findLocalFile(name);
        if (pdir == null) throw new Exception("plugin "+name+" not found");
        boolean rt= AvnUtil.deleteRecursive(pdir);
        if (rt) removeChild(name);
        return rt;
    }

    @Override
    public boolean handleRename(String oldName, String newName) throws Exception {
        throw new Exception("cannot rename plugins");
    }

    static final AvnUtil.KeyValue<String>[] PLUGINFILES=new AvnUtil.KeyValue[]
    {
            new AvnUtil.KeyValue<String>("css","plugin.css"),
            new AvnUtil.KeyValue<String>("js","plugin.js")
    };
    @Override
    protected JSONObject handleSpecialApiRequest(String command, Uri uri, PostVars postData, RequestHandler.ServerInfo serverInfo) throws Exception {
        if ("listFiles".equals(command)){
            JSONArray rt=new JSONArray();
            for (File localFile: workDir.listFiles()) {
                if (localFile.isDirectory()) {
                    JSONObject po=new JSONObject();
                    po.put("name",pluginFileToName(localFile));
                    po.put("dir",localFile.getName());
                    for (AvnUtil.KeyValue<String> item:PLUGINFILES) {
                        File pf = new File(localFile, item.value);
                        if (pf.exists()) {
                            po.put(item.key, getUrlFromName(pluginFileToName(localFile) + "/" + pf.getName()));
                        }
                    }
                    rt.put(po);
                }
            }
            JSONArray finalList=new JSONArray();
            synchronized (createLock){
                for (int i=0;i<rt.length();i++){
                    JSONObject po=rt.getJSONObject(i);
                    String pname=po.getString("name");
                    try{
                        JSONObject cfg=childParameterValues.getJSONObject(pname);
                        if (!ENABLED_PARAMETER.fromJson(cfg)) continue;
                    }catch (Exception e){}
                    finalList.put(po);
                }
            }
            List<IPluginHandler> externals=getExternalPlugins();
            for (IPluginHandler ph:externals){
                JSONObject po=ph.getFiles();
                if (po != null && po.has(IPluginHandler.K_NAME)){
                    for (String k:IPluginHandler.PLUGINFILES.keySet()){
                        if (po.has(k)){
                            String relativePath=po.getString(k);
                            po.put(k,getUrlFromName(ph.getName()+"/"+relativePath));
                        }
                    }
                    finalList.put(po);
                }
            }
            return RequestHandler.getReturn(new AvnUtil.KeyValue<JSONArray>("data",finalList));
        }
        return RequestHandler.getErrorReturn("command "+command+" not available");
    }

    @Override
    protected File findLocalFile(String name) throws IOException {
        if (workDir == null) throw new IOException("workdir for "+type+" not set");
        if (! name.startsWith(USER_PREFIX)) throw new IOException("names must start with "+USER_PREFIX);
        name=name.substring(USER_PREFIX.length());
        for (File localFile: workDir.listFiles()) {
            if (localFile.isDirectory()
                    &&localFile.canRead()
                    && localFile.getName().equals(name)) {
                return localFile;
            }
        }
        return null;
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
            File base = findLocalFile(baseName);
            if (!base.isDirectory()) return null;
            String fpath = checkPathParts(parts, true, 1);
            File finalFile = new File(base, fpath);
            if (finalFile.isDirectory()) throw new Error(finalFile.getPath() + " is a directory");
            if (!finalFile.exists()) return null;
            return new ExtendedWebResourceResponse(finalFile, RequestHandler.mimeType(finalFile.getName()), "");
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

    private boolean isActive(String name){
        synchronized (createLock){
            if (! childParameterValues.has(name)) return true;
            try {
                JSONObject co=childParameterValues.getJSONObject(name);
                return ENABLED_PARAMETER.fromJson(co);
            } catch (JSONException e) {
                return true;
            }
        }
    }

    @Override
    public synchronized JSONObject getEditableParameters(String child, boolean includeCurrent, Context context) throws JSONException {
        if (child != null){
            JSONObject rt=super.getEditableParameters(null,false,context);
            rt.put("data",childParameters.toJson(context));
            if (includeCurrent) {
                synchronized (createLock) {
                    JSONObject cv=new JSONObject();
                    try{
                        cv=childParameterValues.getJSONObject(child);
                    }catch (Throwable t){}
                    rt.put("values", cv);
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
            synchronized (createLock){
                if (!childParameterValues.has(child)){
                    childParameterValues.put(child,new JSONObject());
                }
                JSONObject cv=childParameterValues.getJSONObject(child);
                for (EditableParameter.EditableParameterInterface p:childParameters){
                    if (newParam.has(p.getName())){
                        cv.put(p.getName(),newParam.get(p.getName()));
                    }
                }
                nv.put(CHILD_PARAM_NAME,childParameterValues);
            }
            super.setParameters(null,nv,false,false);
            return;
        }
        synchronized (createLock){
            if (newParam.has(CHILD_PARAM_NAME)){
                childParameterValues=newParam.getJSONObject(CHILD_PARAM_NAME);
            }
        }
        super.setParameters(null, newParam, replace, check);
    }

}
