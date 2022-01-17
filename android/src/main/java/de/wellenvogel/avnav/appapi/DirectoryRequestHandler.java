package de.wellenvogel.avnav.appapi;

import android.net.Uri;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UnsupportedEncodingException;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.util.Date;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

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
        FileOutputStream os=openForWrite(name,ignoreExisting);
        if (postData == null) throw new Exception("no data");
        postData.writeTo(os);
        os.close();
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
        if (localFile == null) return false;
        boolean rt=localFile.delete();
        if (rt && deleter != null){
            deleter.deleteByUrl(getUrlFromName(localFile.getName()));
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
        String path=uri.getPath();
        if (path == null) return null;
        if (path.startsWith("/")) path=path.substring(1);
        if (!path.startsWith(urlPrefix)) return null;
        path = path.substring((urlPrefix.length()+1));
        String[] parts = path.split("/");
        if (parts.length < 1) return null;
        if (method.equalsIgnoreCase("GET")) {
            if (parts[0].endsWith(".zip") || parts[0].endsWith(".kmz")) {
                String name = URLDecoder.decode(parts[0], "UTF-8");
                File foundFile = findLocalFile(name);
                if (foundFile == null) return tryFallbackOrFail(uri, handler);
                ZipFile zf = new ZipFile(foundFile);
                String entryPath = path.replaceFirst("[^/]*/", "");
                ZipEntry entry = zf.getEntry(entryPath);
                if (entry == null) return tryFallbackOrFail(uri, handler);
                return new ExtendedWebResourceResponse(entry.getSize(),
                        RequestHandler.mimeType(entryPath),
                        "", new CloseHelperStream(zf.getInputStream(entry), zf));
            }
        }
        String name= URLDecoder.decode(parts[parts.length - 1],"UTF-8");
        File foundFile = findLocalFile(name);
        if (foundFile != null) {
            ExtendedWebResourceResponse rt=new ExtendedWebResourceResponse(
                    foundFile.length(),
                    RequestHandler.mimeType(foundFile.getName()),
                    "", method.equalsIgnoreCase("GET")?new FileInputStream(foundFile):null);
            rt.setDateHeader("Last-Modified",new Date(foundFile.lastModified()));
            return rt;
        }
        return null;
    }

    @Override
    public String getPrefix() {
        return urlPrefix;
    }


    public static String safeName(String name,boolean throwError) throws Exception {
        if (name == null) throw new Exception("name is null");
        String safeName=name.replaceAll("[^\\w. ()+-@]","");
        if (!name.equals(safeName) && throwError) throw new Exception("illegal filename "+name);
        return safeName;
    }

    private FileOutputStream openForWrite(String name, boolean overwrite) throws Exception {
        String safeName=safeName(name,true);
        File outFile=new File(workDir,safeName);
        if (outFile.exists() && !overwrite) throw new Exception("file "+name+" already exists");
        return new FileOutputStream(outFile);
    }

}
