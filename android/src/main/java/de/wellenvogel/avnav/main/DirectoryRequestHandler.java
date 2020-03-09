package de.wellenvogel.avnav.main;

import android.net.Uri;
import android.webkit.WebResourceResponse;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;

public class DirectoryRequestHandler implements INavRequestHandler {
    class JsonWrapper implements IJsonObect{
        JSONObject o;
        JsonWrapper(JSONObject o){
            this.o=o;
        }
        @Override
        public JSONObject toJson() throws JSONException {
            return o;
        }
    }
    File subDir;
    MainActivity activity;
    File workDir;
    String urlPrefix;
    String type;
    public DirectoryRequestHandler(MainActivity activity, String type,File subDir,String urlPrefrix) throws IOException {
        this.activity=activity;
        this.type=type;
        this.subDir=subDir;
        this.urlPrefix=urlPrefrix;
        this.workDir=new File(AvnUtil.getWorkDir(null,activity),subDir.getPath());
        if (! workDir.exists()){
            workDir.mkdirs();
        }
        if (!workDir.exists() || ! workDir.isDirectory()){
            throw new IOException("directory "+workDir.getPath()+" does not exist and cannot be created");
        }
    }
    @Override
    public RequestHandler.ExtendedWebResourceResponse handleDownload(String name, Uri uri) throws Exception {
        File found=findLocalFile(name);
        if (found == null) return null;
        return new RequestHandler.ExtendedWebResourceResponse(
            found.length(),
            activity.getRequestHandler().mimeType(found.getName()),
            "",
            new FileInputStream(found)
        );
    }

    @Override
    public boolean handleUpload(String postData, String name, boolean ignoreExisting) throws Exception {
        String safeName=safeName(name,true);
        File out=new File(workDir,safeName);
        if (out.exists() && ! ignoreExisting) return false;
        FileOutputStream os=new FileOutputStream(out);
        os.write(postData.getBytes());
        os.close();
        return true;
    }

    @Override
    public Collection<? extends IJsonObect> handleList() throws Exception {
        ArrayList<JsonWrapper> rt=new ArrayList<JsonWrapper>();
        for (File localFile: workDir.listFiles()) {
            if (localFile.isFile()){
                JSONObject el=new JSONObject();
                el.put("name",localFile.getName());
                el.put("size",localFile.length());
                el.put("time",localFile.lastModified()/1000);
                el.put("url",urlPrefix+"/"+
                        URLEncoder.encode(localFile.getName(),"utf-8"));
                el.put("type",type);
                el.put("canDelete",true);
                rt.add(new JsonWrapper(el));
            }
        }
        return rt;
    }

    @Override
    public boolean handleDelete(String name, Uri uri) throws Exception {
        File localFile=findLocalFile(name);
        if (localFile == null) return false;
        return localFile.delete();
    }

    @Override
    public JSONObject handleApiRequest(Uri uri) throws Exception {
        String command=AvnUtil.getMandatoryParameter(uri,"command");
        if (command.equals("list")){
            Collection<? extends IJsonObect> files=handleList();
            JSONArray data=new JSONArray();
            for (IJsonObect el:files){
                data.put(el.toJson());
            }
            return RequestHandler.getReturn(new RequestHandler.KeyValue("items",data));
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

    public WebResourceResponse handleDirectRequest(String url) throws FileNotFoundException {
        if (!url.startsWith(urlPrefix)) return null;
        url = url.substring((urlPrefix.length())).replaceAll("\\?.*", "");
        String[] parts = url.split("/");
        if (parts.length < 1) return null;
        File foundFile = findLocalFile(parts[parts.length - 1]);
        if (foundFile != null) {
            return new WebResourceResponse(
                    activity.getRequestHandler().mimeType(foundFile.getName()),
                    "", new FileInputStream(foundFile));

        }
        return null;
    }
    public String getUrlPrefix(){
        return urlPrefix;
    }
    private String safeName(String name,boolean throwError) throws Exception {
        if (name == null) throw new Exception("name is null");
        String safeName=name.replaceAll("[^\\w.-]","");
        if (!name.equals(safeName) && throwError) throw new Exception("illegal filename "+name);
        return safeName;
    }
    public FileOutputStream openForWrite(String name,boolean noOverwrite) throws Exception {
        String safeName=safeName(name,true);
        File outFile=new File(workDir,safeName);
        if (outFile.exists() && noOverwrite) throw new Exception("file "+name+" already exists");
        return new FileOutputStream(outFile);
    }
    public String getDirName(){
        return workDir.getAbsolutePath();
    }
}
