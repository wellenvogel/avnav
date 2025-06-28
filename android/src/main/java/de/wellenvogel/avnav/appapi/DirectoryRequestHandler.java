package de.wellenvogel.avnav.appapi;

import android.net.Uri;
import android.os.Build;
import androidx.annotation.NonNull;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UnsupportedEncodingException;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.Date;
import java.util.Enumeration;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.worker.GpsService;
import de.wellenvogel.avnav.worker.Worker;

public class DirectoryRequestHandler extends Worker implements INavRequestHandler{
    protected File workDir;
    protected String urlPrefix;
    protected String type;
    protected IDeleteByUrl deleter;
    public DirectoryRequestHandler(String type, GpsService ctx,File workDir, String urlPrefrix, IDeleteByUrl deleter) throws IOException {
        super(type,ctx);
        this.type=type;
        this.urlPrefix=urlPrefrix;
        this.workDir=workDir;
        if (! workDir.exists()){
            workDir.mkdirs();
        }
        if (!workDir.exists() || ! workDir.isDirectory()){
            throw new IOException("directory "+workDir.getPath()+" does not exist and cannot be created");
        }
        this.deleter=deleter;
    }


    protected void setWorkDir(File workDir) throws IOException {
        this.workDir=workDir;
        if (! workDir.exists()){
            workDir.mkdirs();
        }
        if (!workDir.exists() || ! workDir.isDirectory()){
            throw new IOException("directory "+workDir.getPath()+" does not exist and cannot be created");
        }
    }

    @Override
    public ExtendedWebResourceResponse handleDownload(String name, Uri uri) throws Exception {
        File found=findLocalFile(name);
        if (found == null) return null;
        return new ExtendedWebResourceResponse(
            found.length(),
            "application/octet-stream",
            "",
            new FileInputStream(found)
        );
    }

    @Override
    public boolean handleUpload(PostVars postData, String name, boolean ignoreExisting) throws Exception {
        String safeName=safeName(name,true);
        if (postData == null) throw new Exception("no data");
        writeAtomic(new File(workDir,safeName),postData.getStream(),ignoreExisting,postData.getContentLength());
        postData.closeInput();
        return true;
    }

    protected String getUrlFromName(String name) throws UnsupportedEncodingException {
       return "/"+urlPrefix+"/"+
               URLEncoder.encode(name,"utf-8");
    }
    @Override
    public JSONArray handleList(Uri uri, RequestHandler.ServerInfo serverInfo) throws Exception {
        JSONArray rt=new JSONArray();
        for (File localFile: workDir.listFiles()) {
            if (localFile.isFile()){
                JSONObject el=new JSONObject();
                el.put("name",localFile.getName());
                el.put("size",localFile.length());
                el.put("time",localFile.lastModified()/1000);
                el.put("url",getUrlFromName(localFile.getName()));
                el.put("type",type);
                el.put("canDelete",true);
                rt.put(el);
            }
        }
        return rt;
    }

    @Override
    public boolean handleDelete(String name, Uri uri) throws Exception {
        File localFile=findLocalFile(name);
        boolean rt=false;
        if (localFile != null) {
            rt = localFile.delete();
            if (rt && deleter != null) {
                deleter.deleteByUrl(getUrlFromName(localFile.getName()));
            }
        }
        return rt;
    }

    @Override
    public JSONObject handleApiRequest(Uri uri, PostVars postData, RequestHandler.ServerInfo serverInfo) throws Exception {
        String command=AvnUtil.getMandatoryParameter(uri,"command");
        if (command.equals("list")){
            return RequestHandler.getReturn(new AvnUtil.KeyValue("items",handleList(uri, serverInfo)));
        }
        if (command.equals("delete")){
            String name=AvnUtil.getMandatoryParameter(uri,"name");
            boolean ok=handleDelete(name,uri);
            if (ok)  return RequestHandler.getReturn();
            return RequestHandler.getErrorReturn("delete failed");
        }
        if (command.equals("rename")){
            String name=AvnUtil.getMandatoryParameter(uri,"name");
            String newName=AvnUtil.getMandatoryParameter(uri,"newName");
            File found=findLocalFile(name);
            if (found == null){
                return RequestHandler.getErrorReturn("file "+name+" not found");
            }
            String safeNewName=safeName(newName,true);
            File newFile=new File(workDir,safeNewName);
            if (newFile.exists()){
                return RequestHandler.getErrorReturn("file "+safeNewName+" already exists");
            }
            if (found.renameTo(newFile)){
                return RequestHandler.getReturn();
            }
            return RequestHandler.getErrorReturn("rename failed");

        }
        return handleSpecialApiRequest(command,uri,postData,serverInfo);
    }

    protected JSONObject handleSpecialApiRequest(String command,Uri uri,PostVars postData,RequestHandler.ServerInfo serverInfo) throws Exception {
        return RequestHandler.getErrorReturn("unknonw api request "+command);
    }

    private File findLocalFile(String name) throws IOException {
        if (workDir == null) throw new IOException("workdir for "+type+" not set");
        for (File localFile: workDir.listFiles()) {
            if (localFile.isFile()
                    &&localFile.canRead()
                    && localFile.getName().equals(name)) {
                return localFile;
            }
        }
        return null;
    }

    @Override
    protected void run(int startSequence) throws JSONException, IOException {
    }

    static class CloseHelperStream extends InputStream {
        private InputStream is;
        private ZipFile zf;
        public CloseHelperStream(InputStream zi,ZipFile zf){
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
            zf.close();
        }
    }
    private ExtendedWebResourceResponse tryFallbackOrFail(Uri uri,RequestHandler handler) throws Exception {
        String fallback=uri.getQueryParameter("fallback");
        if (fallback == null || fallback.isEmpty()) return null;
        if (!fallback.startsWith("/")) {
            fallback=RequestHandler.INTERNAL_URL_PREFIX +RequestHandler.ROOT_PATH+"/"+fallback;
        }
        else{
            fallback=RequestHandler.INTERNAL_URL_PREFIX +fallback;
        }
        return handler.handleRequest(null,fallback);
    }
    @Override
    public ExtendedWebResourceResponse handleDirectRequest(Uri uri, RequestHandler handler, String method) throws Exception {
        String path = uri.getPath();
        if (path == null) return null;
        if (path.startsWith("/")) path = path.substring(1);
        if (!path.startsWith(urlPrefix)) return null;
        path = path.substring((urlPrefix.length() + 1));
        String[] parts = path.split("/");
        if (parts.length < 1) return null;

        if (parts[0].endsWith(".zip") || parts[0].endsWith(".kmz")) {
            String name = URLDecoder.decode(parts[0], "UTF-8");
            File foundFile = findLocalFile(name);
            if (foundFile == null)
                return tryFallbackOrFail(uri, handler);
            if (method.equalsIgnoreCase("GET")) {
                ZipFile zf = new ZipFile(foundFile);
                String entryPath = path.replaceFirst("[^/]*/", "");
                ZipEntry entry = zf.getEntry(entryPath);
                if (entry == null && entryPath.equals("doc.kml") && name.endsWith(".kmz")) {
                    Enumeration<? extends ZipEntry> entries = zf.entries();
                    while (entries.hasMoreElements()) {
                        ZipEntry ze = entries.nextElement();
                        if (!ze.getName().contains("/") && ze.getName().endsWith(".kml")) {
                            entry = ze;
                            break;
                        }
                    }
                }

                if (entry == null)
                    return tryFallbackOrFail(uri, handler);
                ExtendedWebResourceResponse rt = new ExtendedWebResourceResponse(entry.getSize(),
                        RequestHandler.mimeType(entry.getName()),
                        "", new CloseHelperStream(zf.getInputStream(entry), zf));
                rt.setDateHeader("Last-Modified", new Date(foundFile.lastModified()));
                return rt;
            } else {
                //this is for head requests - AvNav only uses this to check the last-modified
                //so we avoid reading the whole zip file each time
                //this way we would also answer head requests for non existing entries
                //but for the use case this should be ok
                ExtendedWebResourceResponse rt = new ExtendedWebResourceResponse(0,
                        RequestHandler.mimeType(path),
                        "", new ByteArrayInputStream(new byte[0]));
                rt.setDateHeader("Last-Modified", new Date(foundFile.lastModified()));
                return rt;
            }
        }
        String name = URLDecoder.decode(parts[parts.length - 1], "UTF-8");
        File foundFile = findLocalFile(name);
        if (foundFile != null) {
            ExtendedWebResourceResponse rt = new ExtendedWebResourceResponse(
                    foundFile.length(),
                    RequestHandler.mimeType(foundFile.getName()),
                    "", method.equalsIgnoreCase("GET") ? new FileInputStream(foundFile) : new ByteArrayInputStream(new byte[0]));
            rt.setDateHeader("Last-Modified", new Date(foundFile.lastModified()));
            return rt;
        }
        return null;
    }

    @Override
    public String getPrefix() {
        return urlPrefix;
    }

    public static String TMP_PRFX="__avn.";
    public static String safeName(String name,boolean throwError) throws Exception {
        if (name == null) throw new Exception("name is null");
        if (name.startsWith(TMP_PRFX)) throw new Exception("name cannot start with "+TMP_PRFX);
        //in principle we should forbid : in names as we could in theory run on an SD card
        //but older versions allowed this (accidently) and so e.g. plugin chart configs have a ':'
        //in the name - original regexp would be [\u0000-\u001f\u007f\"*/:<>?\\\\|]
        //see https://stackoverflow.com/questions/2679699/what-characters-allowed-in-file-names-on-android/28516488
        //but as we do not run on a FAT32 SD card any way (and have never been able to do so)
        //we just allow the :
        String safeName=name.replaceAll("[\u0000-\u001f\u007f\"*/<>?\\\\|]","");
        if (!name.equals(safeName) && throwError) throw new Exception("illegal filename "+name);
        return safeName;
    }


    static long tmpCount=0;

    static synchronized long getTmpCount(){
        tmpCount++;
        return tmpCount;
    }
    
    public static File getTmpFor(File original){
        if (original == null) return original;
        String tmp=TMP_PRFX+Long.toString(getTmpCount())+"."+original.getName();
        return new File(original.getParent(),tmp);
    }

    public static boolean deleteTmp(File original){
        if (original == null) return false;
        File tmp=getTmpFor(original);
        if (tmp.exists()) return tmp.delete();
        return false;
    }

    public static long writeAtomic(File out, InputStream is, boolean overwrite) throws Exception {
        return writeAtomic(out,is,overwrite,-1);
    }
    public static long writeAtomic(File out, InputStream is, boolean overwrite,long requestedLength) throws Exception {
        //first check to avoid useless writes
        long written=0;
        if (!overwrite && out.exists()) throw new Exception("File "+out+" already exists");
        File tmp=getTmpFor(out);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                written = Files.copy(is, tmp.toPath(), StandardCopyOption.REPLACE_EXISTING);
                if (requestedLength >= 0 && written != requestedLength) {
                    tmp.delete();
                    throw new IOException("not all bytes written (" + written + " from " + requestedLength + ")");
                }
                if (overwrite) {
                    Files.move(tmp.toPath(), out.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
                } else {
                    try {
                        Files.move(tmp.toPath(), out.toPath(), StandardCopyOption.ATOMIC_MOVE);
                    } catch (Throwable t) {
                        tmp.delete();
                        throw t;
                    }
                }
                is.close();
            } else {
                FileOutputStream os = new FileOutputStream(tmp);
                byte[] buffer = new byte[10240];
                int rd = is.read(buffer);
                while (rd >= 0) {
                    os.write(buffer, 0, rd);
                    written += rd;
                    rd = is.read(buffer);
                }
                os.close();
                is.close();
                if (requestedLength >= 0 && written != requestedLength) {
                    tmp.delete();
                    throw new IOException("not all bytes written (" + written + " from " + requestedLength + ")");
                }
                if (!tmp.renameTo(out)) {
                    tmp.delete();
                    throw new Exception("cannot rename " + tmp + " to " + out);
                }
            }
        } catch (Throwable t){
            tmp.delete();
            throw t;
        }
        return written;
    }

    public static void cleanupOldTmp(File dir){
        if (dir == null) return;
        if (! dir.isDirectory()) return;
        long removeTime=System.currentTimeMillis()-3600*1000;
        for (File f:dir.listFiles()){
            if (f.getName().startsWith(TMP_PRFX)){
                if (f.lastModified() <= removeTime){
                    if (! f.delete()){
                        AvnLog.e("unable to remove tmp file "+f);
                    }
                }
            }
        }
    }


}
