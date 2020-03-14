package de.wellenvogel.avnav.appapi;

import android.net.Uri;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;

import de.wellenvogel.avnav.util.AvnUtil;

public class DirectoryRequestHandler implements INavRequestHandler{
    private File subDir;
    private RequestHandler handler;
    private File workDir;
    private String urlPrefix;
    private String type;
    private IDeleteByUrl deleter;
    public DirectoryRequestHandler(RequestHandler handler, String type,File subDir,String urlPrefrix,IDeleteByUrl deleter) throws IOException {
        this.handler=handler;
        this.type=type;
        this.subDir=subDir;
        this.urlPrefix=urlPrefrix;
        this.workDir=new File(handler.getWorkDir(),subDir.getPath());
        if (! workDir.exists()){
            workDir.mkdirs();
        }
        if (!workDir.exists() || ! workDir.isDirectory()){
            throw new IOException("directory "+workDir.getPath()+" does not exist and cannot be created");
        }
        this.deleter=deleter;
    }

    @Override
    public ExtendedWebResourceResponse handleDownload(String name, Uri uri) throws Exception {
        File found=findLocalFile(name);
        if (found == null) return null;
        return new ExtendedWebResourceResponse(
            found.length(),
            handler.mimeType(found.getName()),
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

    private String getUrlFromName(String name) throws UnsupportedEncodingException {
       return "/"+urlPrefix+"/"+
               URLEncoder.encode(name,"utf-8");
    }
    @Override
    public JSONArray handleList() throws Exception {
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
    public JSONObject handleApiRequest(Uri uri,PostVars postData) throws Exception {
        String command=AvnUtil.getMandatoryParameter(uri,"command");
        if (command.equals("list")){
            return RequestHandler.getReturn(new RequestHandler.KeyValue("items",handleList()));
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
        return null;
    }

    private File findLocalFile(String name){
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
    public ExtendedWebResourceResponse handleDirectRequest(String url) throws FileNotFoundException {
        if (!url.startsWith(urlPrefix)) return null;
        url = url.substring((urlPrefix.length())).replaceAll("\\?.*", "");
        String[] parts = url.split("/");
        if (parts.length < 1) return null;
        File foundFile = findLocalFile(parts[parts.length - 1]);
        if (foundFile != null) {
            return new ExtendedWebResourceResponse(
                    foundFile.length(),
                    handler.mimeType(foundFile.getName()),
                    "", new FileInputStream(foundFile));

        }
        return null;
    }

    @Override
    public String getPrefix() {
        return urlPrefix;
    }


    public static String safeName(String name,boolean throwError) throws Exception {
        if (name == null) throw new Exception("name is null");
        String safeName=name.replaceAll("[^\\w. ()+-]","");
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
