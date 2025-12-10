package de.wellenvogel.avnav.appapi;
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


import android.net.Uri;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.PipedInputStream;
import java.io.PipedOutputStream;
import java.io.UnsupportedEncodingException;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.worker.GpsService;

public class PluginManager extends DirectoryRequestHandler {

    static final String UPLOAD_BASE ="__upload";
    public PluginManager(String type, GpsService ctx, File workDir, String urlPrefrix, IDeleteByUrl deleter) throws IOException {
        super(type, ctx, workDir, urlPrefrix, deleter);
        try{
            for (File f:workDir.listFiles()){
                if (f.isFile() && f.getName().startsWith(UPLOAD_BASE)){
                    f.delete();
                }
            }
        }catch (Throwable t){
            AvnLog.e("error cleaning up plugin dir",t);
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

    private void checkEntryPath(ZipEntry entry,String pname) throws Exception{
        String [] parts=entry.getName().split("/");
        if (parts.length < 1) throw new Exception("0 name parts in zip entry "+entry.getName());
        if (! pname.equals(parts[0])) throw new Exception("zip entry "+entry.getName()+" not below "+pname);
        if (!entry.isDirectory()){
            if (parts.length < 2) throw new Exception("file "+entry.getName()+" must be in subdir below "+pname);
        }
        for (String part:parts){
            safeName(part,true);
            if (part.indexOf(':')>=0) throw new Exception("no : allowed in names "+entry.getName());
        }
    }

    @Override
    public boolean handleUpload(PostVars postData, String name, boolean ignoreExisting, boolean completeName) throws Exception {
        File existing=super.findLocalFile(name); //also include normal files
        if (existing != null && ! ignoreExisting){
            throw new Exception("plugin "+name+" already exists");
        }
        name=safeName(name,true);
        if (name.startsWith(UPLOAD_BASE)) throw new Exception("plugin names must not start with "+UPLOAD_BASE);
        //we first upload everything before we unpack
        //the chance that something goes wrong during upload is bigger then during unpacking
        //so we try to keep the plugin intact if it already exists but the upload gets interrupted
        String uploadName= UPLOAD_BASE +Thread.currentThread().getId();
        boolean rt= super.handleUpload(postData, uploadName, true, true);
        if (! rt){
            throw new Error("unable to upload to "+uploadName);
        }
        File uploaded=new File(workDir,uploadName);
        ZipInputStream zis=new ZipInputStream(new FileInputStream(uploaded));
        //do some analysis of the zip
        ZipEntry e=zis.getNextEntry();
        while (e != null){
            checkEntryPath(e,name);
            e=zis.getNextEntry();
        }
        zis.close();
        zis=new ZipInputStream(new FileInputStream(uploaded));
        e=zis.getNextEntry();
        while (e != null) {
            File of = new File(workDir, e.getName());
            File dir = of.isDirectory() ? of : of.getParentFile();
            if (dir.exists() && !dir.isDirectory()) {
                AvnUtil.deleteRecursive(dir);
            }
            if (!dir.exists()) {
                dir.mkdirs();
            }
            if (! dir.isDirectory()){
                throw new Exception("unable to create directory "+dir.getAbsolutePath());
            }
            if (! e.isDirectory()){
                writeAtomic(of,zis,true,e.getSize());
            }
            e=zis.getNextEntry();
        }
        zis.close();
        return true;
    }

    @Override
    protected JSONObject fileToItem(File localFile) throws JSONException, UnsupportedEncodingException {
        if (!localFile.isDirectory()) return null;
        JSONObject jo= super.fileToItem(localFile);
        jo.put("canDownload",true);
        jo.put("downloadName",localFile.getName()+".zip");
        return jo;
    }

    @Override
    public JSONArray handleList(Uri uri, RequestHandler.ServerInfo serverInfo) throws Exception {
        JSONArray rt=new JSONArray();
        for (File localFile: workDir.listFiles()) {
            if (localFile.isDirectory()){
                JSONObject jo=fileToItem(localFile);
                if (jo != null) {
                    rt.put(jo);
                }
            }
        }
        return rt;
    }

    @Override
    public boolean handleDelete(String name, Uri uri) throws Exception {
        return super.handleDelete(name, uri);
    }

    @Override
    public boolean handleRename(String oldName, String newName) throws Exception {
        return super.handleRename(oldName, newName);
    }

    @Override
    protected JSONObject handleSpecialApiRequest(String command, Uri uri, PostVars postData, RequestHandler.ServerInfo serverInfo) throws Exception {
        return super.handleSpecialApiRequest(command, uri, postData, serverInfo);
    }

    @Override
    protected File findLocalFile(String name) throws IOException {
        if (workDir == null) throw new IOException("workdir for "+type+" not set");
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
    protected void run(int startSequence) throws JSONException, IOException {
        super.run(startSequence);
    }

    @Override
    public ExtendedWebResourceResponse handleDirectRequest(Uri uri, RequestHandler handler, String method) throws Exception {
        return super.handleDirectRequest(uri, handler, method);
    }
}
