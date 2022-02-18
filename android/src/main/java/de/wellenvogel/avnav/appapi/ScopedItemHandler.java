package de.wellenvogel.avnav.appapi;

import android.content.Context;
import android.net.Uri;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;

import de.wellenvogel.avnav.main.BuildConfig;
import de.wellenvogel.avnav.util.AvnUtil;

public class ScopedItemHandler implements INavRequestHandler{
    String systemDir=null; //base path at assets
    File userDir=null;
    Context context =null;
    private String prefix=null;
    private String type=null;
    static final String PREFIX="layout";



    static class ItemInfo implements AvnUtil.IJsonObect {
        public static final String USERPREFIX="user.";
        public static final String SYSTEMPREFIX="system.";
        public String name;
        public long mtime;
        public long size=-1;
        public boolean isUser;
        private String prefix="";
        private String type="";
        @Override
        public JSONObject toJson() throws JSONException {
            JSONObject rt=new JSONObject();
            rt.put("name",(isUser?USERPREFIX:SYSTEMPREFIX)+name);
            rt.put("url",prefix+"/"+(isUser?USERPREFIX:SYSTEMPREFIX)+name+".json");
            rt.put("canDelete",isUser);
            rt.put("time",mtime/1000);
            rt.put("isServer",true);
            if (size != -1) rt.put("size",size);
            rt.put("type",type);
            return rt;
        }
        public ItemInfo(String type, String prefix, String name, boolean isUser, long mtime){
            this.name=name;
            this.isUser=isUser;
            this.mtime=mtime;
            this.prefix=prefix;
            this.type=type;
        }
    }

    String getType(){
        return type;
    }
    @Override
    public ExtendedWebResourceResponse handleDownload(String name, Uri uri) throws Exception {
        InputStream item= getItemForReading(name);
        return new ExtendedWebResourceResponse(-1,"application/json","",item);
    }

    String nameToUserFileName(String fileName, boolean hardCheck) throws Exception{
        if (fileName.startsWith(ItemInfo.USERPREFIX)){
            fileName=fileName.substring(ItemInfo.USERPREFIX.length());
        }
        else{
            if (hardCheck) throw new Exception("invalid name "+fileName+" must start with "+ItemInfo.USERPREFIX);
        }
        return fileName+".json";
    }
    @Override
    public boolean handleUpload(PostVars postData, String name, boolean ignoreExisting) throws Exception {
        if (postData == null) throw new Exception("no data");
        if (!userDir.isDirectory()) throw new IOException("user dir is no directory");
        String fileName =nameToUserFileName(DirectoryRequestHandler.safeName(name,true),false);
        File of = new File(userDir, fileName);
        if (!userDir.canWrite()) throw new IOException("unable to write " + fileName);
        FileOutputStream os = new FileOutputStream(of);
        postData.writeTo(os);
        os.close();
        return true;
    }

    @Override
    public JSONArray handleList(Uri uri, RequestHandler.ServerInfo serverInfo) throws Exception{
            JSONArray li=readDir(userDir);
            for (AvnUtil.IJsonObect o: readAssetsDir()){
                li.put(o.toJson());
            }
            return li;
    }

    @Override
    public boolean handleDelete(String name, Uri uri) throws Exception {
        File item = new File(userDir, nameToUserFileName(name,true));
        if (!item.exists() || !item.isFile()) {
            throw new IOException(name + " not found");
        }
        return item.delete();

    }

    public JSONObject handleRename(String oldName,String newName) throws Exception {
        return RequestHandler.getErrorReturn("rename not available");
    }

    @Override
    public JSONObject handleApiRequest(Uri uri, PostVars postData, RequestHandler.ServerInfo serverInfo) throws Exception {
        String command= AvnUtil.getMandatoryParameter(uri,"command");
        if (command.equals("list")){
            RequestHandler.getReturn(new AvnUtil.KeyValue("data",handleList(uri, serverInfo)));
        }
        if (command.equals("rename")){
            String name=DirectoryRequestHandler.safeName(AvnUtil.getMandatoryParameter(uri,"name"),true);
            String newName=DirectoryRequestHandler.safeName(AvnUtil.getMandatoryParameter(uri,"newName"),true);
            return handleRename(name,newName);
        }
        return null;
    }

    @Override
    public ExtendedWebResourceResponse handleDirectRequest(Uri uri, RequestHandler handler, String method) throws FileNotFoundException {
        return null;
    }

    @Override
    public String getPrefix() {
        return prefix;
    }

    private ArrayList<AvnUtil.IJsonObect> readAssetsDir() throws Exception {
        ArrayList<AvnUtil.IJsonObect> rt=new ArrayList<>();
        String [] list;
        list= context.getAssets().list(systemDir);
        for (String name :list){
            if (!name.endsWith(".json")) continue;
            if (name.equals("keys.json")) continue;
            ItemInfo li=new ItemInfo(getType(), getPrefix(), name.replaceAll("\\.json$",""), false,BuildConfig.TIMESTAMP);
            rt.add(li);
        }
        return rt;
    }
    private JSONArray readDir(File dir) throws JSONException {
        JSONArray rt=new JSONArray();
        if (!dir.isDirectory()) return rt;
        for (File f: dir.listFiles()){
            if (!f.getName().endsWith(".json")) continue;
            if (! f.isFile()) continue;
            ItemInfo li=new ItemInfo(getType(), getPrefix(), f.getName().replaceAll("\\.json$",""),true,f.lastModified());
            li.size=f.length();
            rt.put(li.toJson());
        }
        return rt;
    }


    public ScopedItemHandler(String type, Context context, String prefix, String systemDir, File userDir){
        this.systemDir=systemDir;
        this.userDir=userDir;
        this.context = context;
        this.prefix=prefix;
        this.type=type;
        if (! userDir.isDirectory()){
            userDir.mkdirs();
        }
    }

    public InputStream getItemForReading(String name) throws IOException {
        if (name.startsWith(ItemInfo.SYSTEMPREFIX)){
            name=name.substring(ItemInfo.SYSTEMPREFIX.length());
            String filename=name+".json";
            return context.getAssets().open(systemDir+"/"+filename);
        }
        if (name.startsWith(ItemInfo.USERPREFIX)){
            name=name.substring(ItemInfo.USERPREFIX.length());
            String filename=name+".json";
            File ifile=new File(userDir,filename);
            if (! ifile.canRead()) throw new IOException("unable to read layout file: "+ifile.getAbsolutePath());
            return new FileInputStream(ifile);
        }
        throw new IOException("neither system nor user layout: "+name);
    }




}
