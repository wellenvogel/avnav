package de.wellenvogel.avnav.appapi;

import android.content.Context;
import android.net.Uri;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import de.wellenvogel.avnav.main.BuildConfig;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;

public class ScopedItemHandler implements INavRequestHandler{
    String systemDir=null; //base path at assets
    File userDir=null;
    Context context =null;
    private String prefix=null;
    private String type=null;
    static final String PREFIX="layout";

    private final HashMap<String,ItemInfo> systemItems=new HashMap<>();



    static class ItemInfo implements AvnUtil.IJsonObect {
        public static final String USERPREFIX="user.";
        public static final String SYSTEMPREFIX="system.";
        public String name;
        public long mtime;
        public long size=-1;
        public boolean isUser;
        private String prefix="";
        private String type="";
        private String fileName;
        @Override
        public JSONObject toJson() throws JSONException {
            JSONObject rt=new JSONObject();
            rt.put("name",name);
            rt.put("url",prefix+"/"+name+SUFFIX);
            rt.put("canDelete",isUser);
            rt.put("canDownload",true);
            rt.put("time",mtime/1000);
            rt.put("isServer",true);
            rt.put("downloadName",fileName);
            rt.put("extension",SUFFIX);
            if (isUser){
                //only items with this prefix are checkd for upload
                rt.put("checkPrefix",USERPREFIX);
            }
            if (size != -1) rt.put("size",size);
            rt.put("type",type);
            return rt;
        }
        public ItemInfo(String type, String prefix, String name, boolean isUser, long mtime){
            this.fileName=name;
            if (name != null){
                if (name.toLowerCase().endsWith(SUFFIX)){
                    name=name.substring(0,name.length()-SUFFIX.length());
                }
            }
            this.name=(isUser?USERPREFIX:SYSTEMPREFIX)+name;
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
        return fileNameFromName(fileName);
    }
    @Override
    public boolean handleUpload(PostVars postData, String name, boolean ignoreExisting) throws Exception {
        if (postData == null) throw new Exception("no data");
        if (!userDir.isDirectory()) throw new IOException("user dir is no directory");
        String fileName =nameToUserFileName(DirectoryRequestHandler.safeName(name,true),false);
        File of = new File(userDir, fileName);
        if (!userDir.canWrite()) throw new IOException("unable to write " + fileName);
        DirectoryRequestHandler.writeAtomic(of,postData.getStream(),ignoreExisting,postData.getContentLength());
        postData.closeInput();
        return true;
    }

    @Override
    public JSONArray handleList(Uri uri, RequestHandler.ServerInfo serverInfo) throws Exception{
            Map<String,ItemInfo> user=readDir(userDir);
            JSONArray li=new JSONArray();
            for (Map<String,ItemInfo> map: new Map[]{user,systemItems}){
                for (AvnUtil.IJsonObect o: map.values()){
                    li.put(o.toJson());
                }
            }
            return li;
    }

    @Override
    public JSONObject handleInfo(String name, Uri uri, RequestHandler.ServerInfo serverInfo) throws Exception {
        if (name == null) return new JSONObject();
        if (name.startsWith(ItemInfo.SYSTEMPREFIX)){
            AvnUtil.IJsonObect item=systemItems.get(name);
            if (item == null){
                return null;
            }
            return item.toJson();
        }
        Map<String,ItemInfo> items=readDir(userDir);
        ItemInfo item=items.get(name);
        if (item == null) return null;
        return item.toJson();
    }

    @Override
    public boolean handleDelete(String name, Uri uri) throws Exception {
        Map<String,ItemInfo> items=readDir(userDir);
        ItemInfo item=items.get(name);
        if (item == null) throw new IOException("no user item "+name);
        File userFile=new File(userDir,item.fileName);
        if (!userFile.exists() || !userFile.isFile()) {
            throw new IOException(userFile + " not found");
        }
        return userFile.delete();
    }

    public JSONObject handleRename(String oldName,String newName) throws Exception {
        return RequestHandler.getErrorReturn("rename not available");
    }

    @Override
    public JSONObject handleApiRequest(String command, Uri uri, PostVars postData, RequestHandler.ServerInfo serverInfo) throws Exception {
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

    private Map<String,ItemInfo> readDir(File dir) throws JSONException {
        HashMap<String,ItemInfo> rt=new HashMap<>();
        if (!dir.isDirectory()) return rt;
        for (File f: dir.listFiles()){
            if (!f.getName().endsWith(SUFFIX)) continue;
            if (! f.isFile()) continue;
            ItemInfo li=new ItemInfo(getType(), getPrefix(), f.getName(),true,f.lastModified());
            li.size=f.length();
            rt.put(li.name,li);
        }
        return rt;
    }


    public ScopedItemHandler(String type, Context context, String prefix, String systemDir, File userDir) {
        this.systemDir = systemDir;
        this.userDir = userDir;
        this.context = context;
        this.prefix = prefix;
        this.type = type;
        if (!userDir.isDirectory()) {
            userDir.mkdirs();
        }
        String[] list = null;
        try {
            list = context.getAssets().list(systemDir);
            if (list != null) {
                for (String name : list) {
                    if (!name.endsWith(SUFFIX)) continue;
                    if (name.equals("keys.json")) continue;
                    ItemInfo li = new ItemInfo(getType(), getPrefix(), name, false, BuildConfig.TIMESTAMP);
                    systemItems.put(li.name,li);
                }
            }
        } catch (IOException e) {
            AvnLog.e(type + ": unable to read system items", e);
        }
    }

    final static String SUFFIX=".json";
    private String fileNameFromName(String name){
        if (name.endsWith(SUFFIX)) return name;
        return name+SUFFIX;
    }
    public InputStream getItemForReading(String name) throws Exception {
        if (name.startsWith(ItemInfo.SYSTEMPREFIX)){
            ItemInfo info=systemItems.get(name);
            if (info == null) throw new IOException("system item "+name+" not found");
            return context.getAssets().open(systemDir+"/"+info.fileName);
        }
        if (name.startsWith(ItemInfo.USERPREFIX)){
            name=name.substring(ItemInfo.USERPREFIX.length());
            name=DirectoryRequestHandler.safeName(name,true);
            File ifile=new File(userDir,name+SUFFIX);
            if (! ifile.canRead()) throw new IOException("unable to read file: "+ifile.getAbsolutePath());
            return new FileInputStream(ifile);
        }
        throw new IOException("neither system nor user item: "+name);
    }




}
