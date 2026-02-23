package de.wellenvogel.avnav.appapi;

import android.content.Context;
import android.net.Uri;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import de.wellenvogel.avnav.main.BuildConfig;
import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;

public class ScopedItemHandler implements INavRequestHandler,IPluginAware{
    String systemDir=null; //base path at assets
    File userDir=null;
    Context context =null;
    private String prefix=null;
    private String type=null;

    private final HashMap<String,ItemInfo> systemItems=new HashMap<>();
    private final HashMap<String,ItemInfo> pluginItems=new HashMap<>();


    public static class ItemInfo implements AvnUtil.IJsonObect {
        public String name;
        public long mtime;
        public long size=-1;
        public String scope ;
        private String prefix="";
        private String type="";
        private String fileName;
        private IPluginAware.StreamProvider provider;
        @Override
        public JSONObject toJson() throws JSONException {
            JSONObject rt=new JSONObject();
            rt.put("name",name);
            rt.put("url",prefix+"/"+name+SUFFIX);
            rt.put("canDelete", Constants.USERPREFIX.equals(scope));
            rt.put("canDownload",provider != null);
            rt.put("time",mtime/1000);
            rt.put("isServer",true);
            rt.put("downloadName",(provider != null && provider.downloadName() != null)?provider.downloadName():fileName);
            rt.put("extension",SUFFIX);
            if (Constants.USERPREFIX.equals(scope)){
                //only items with this prefix are checkd for upload
                rt.put("checkPrefix", Constants.USERPREFIX);
            }
            if (size != -1) rt.put("size",size);
            rt.put("type",type);
            return rt;
        }
        public ItemInfo(String type, String prefix, String name, String scope, IPluginAware.StreamProvider provider){
            this.fileName=name;
            if (name != null){
                if (name.toLowerCase().endsWith(SUFFIX)){
                    name=name.substring(0,name.length()-SUFFIX.length());
                }
            }
            this.name=scope+name;
            this.scope=scope;
            this.mtime=(provider != null)?provider.lastModified():0;
            this.prefix=prefix;
            this.type=type;
            this.provider=provider;
        }

        public long getSize(){
            return provider.getSize();
        }
        public InputStream getStream() throws IOException {
            return provider.getStream();
        }
    }

    public String getType(){
        return type;
    }

    private boolean isSystemOrPluginItem(String name){
        return Arrays.asList(new String[]{Constants.SYSTEMPREFIX, Constants.PLUGINPREFIX}).stream().anyMatch(name::startsWith);
    }
    private ItemInfo getSystemOrPluginItem(String name){
        if (name.startsWith(Constants.SYSTEMPREFIX)){
            return systemItems.get(name);
        }
        if (name.startsWith(Constants.PLUGINPREFIX)){
            synchronized (pluginItems) {
                return pluginItems.get(name);
            }
        }
        return null;
    }
    @Override
    public ExtendedWebResourceResponse handleDownload(String name, Uri uri) throws Exception {
        ItemInfo info=null;
        if (isSystemOrPluginItem(name)){
            info=getSystemOrPluginItem(name);
        }
        if (name.startsWith(Constants.USERPREFIX)) {
            Map<String, ItemInfo> items = readDir(userDir);
            info = items.get(name);
        }
        if (info == null) throw new IOException("system/plugin item "+name+" not found");
        ExtendedWebResourceResponse rt=new ExtendedWebResourceResponse(info.getSize(),"application/json","",info.getStream());
        rt.setDateHeader("Last-Modified",new Date(info.mtime));
        return rt;
    }

    String nameToUserFileName(String fileName, boolean hardCheck) throws Exception{
        if (fileName.startsWith(Constants.USERPREFIX)){
            fileName=fileName.substring(Constants.USERPREFIX.length());
        }
        else{
            if (hardCheck) throw new Exception("invalid name "+fileName+" must start with "+ Constants.USERPREFIX);
        }
        return fileNameFromName(fileName);
    }
    @Override
    public boolean handleUpload(PostVars postData, String name, boolean ignoreExisting, boolean completeName) throws Exception {
        if (postData == null) throw new Exception("no data");
        if (!userDir.isDirectory()) throw new IOException("user dir is no directory");
        String fileName =nameToUserFileName(DirectoryRequestHandler.safeName(name,true),completeName);
        File of = new File(userDir, fileName);
        if (!userDir.canWrite()) throw new IOException("unable to write " + fileName);
        DirectoryRequestHandler.writeAtomic(of,postData.getStream(),ignoreExisting,postData.getContentLength());
        postData.closeInput();
        return true;
    }

    @Override
    public JSONArray handleList(Uri uri, RequestHandler.ServerInfo serverInfo) throws Exception {
        Map<String, ItemInfo> user = readDir(userDir);
        JSONArray li = new JSONArray();
        synchronized (pluginItems) {
            //TODO: sync could be smaller
            for (Map<String, ItemInfo> map : new Map[]{user, systemItems, pluginItems}) {
                for (AvnUtil.IJsonObect o : map.values()) {
                    li.put(o.toJson());
                }
            }
        }
        return li;
    }

    @Override
    public JSONObject handleInfo(String name, Uri uri, RequestHandler.ServerInfo serverInfo) throws Exception {
        if (name == null) return new JSONObject();
        if (isSystemOrPluginItem(name)){
            ItemInfo item=getSystemOrPluginItem(name);
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
    @Override
    public boolean handleRename(String oldName, String newName) throws Exception {
        oldName=nameToUserFileName( DirectoryRequestHandler.safeName(oldName,true),true);
        newName=nameToUserFileName(DirectoryRequestHandler.safeName(newName,true),true);
        File old=new File(userDir,oldName);
        if (! old.exists() || ! old.isFile()){
            throw new Exception(oldName+" not found");
        }
        File newFile=new File(userDir,newName);
        if (newFile.exists()){
            throw new Exception(newName+" already exists");
        }
        if (! old.renameTo(newFile)){
            throw new Exception("rename failed");
        }
        return true;
    }

    @Override
    public JSONObject handleApiRequest(String command, Uri uri, PostVars postData, RequestHandler.ServerInfo serverInfo) throws Exception {
        if ("prefixes".equals(command)){
            JSONObject rt=new JSONObject();
            rt.put("user", Constants.USERPREFIX);
            rt.put("system", Constants.SYSTEMPREFIX);
            rt.put("plugin", Constants.PLUGINPREFIX);
            return RequestHandler.getReturn(new AvnUtil.KeyValue<JSONObject>("data",rt));
        }
        return null;
    }

    @Override
    public ExtendedWebResourceResponse handleDirectRequest(Uri uri, RequestHandler handler, String method, Map<String, String> headers) throws FileNotFoundException {
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
            ItemInfo li=new ItemInfo(getType(), getPrefix(), f.getName(), Constants.USERPREFIX,
                    new FileStreamProvider(f));
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
                    ItemInfo li = new ItemInfo(getType(),
                            getPrefix(),
                            name,
                            Constants.SYSTEMPREFIX,
                            new IPluginAware.StreamProvider() {
                                @Override
                                public InputStream getStream() throws IOException {
                                    return context.getAssets().open(systemDir+"/"+name);
                                }

                                @Override
                                public long getSize() {
                                    return -1;
                                }

                                @Override
                                public long lastModified() {
                                    return BuildConfig.TIMESTAMP;
                                }

                                @Override
                                public String downloadName() {
                                    return null;
                                }
                            });
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


    @Override
    public void removePluginItems(String pluginName, boolean finalCleanup) {
        String key=pluginName+".";
        ArrayList<String> toDelete=new ArrayList<>();
        synchronized (pluginItems){
            pluginItems.values().stream().filter(v->v.fileName.startsWith(key)).map(v -> toDelete.add(v.name));
            for (String k:toDelete){
                pluginItems.remove(k);
            }
        }
    }

    @Override
    public void setPluginItems(String pluginName, List<PluginItem> items) throws Exception {
        HashMap<String,ItemInfo> newItems= new HashMap<>();
        String key=pluginName+".";
        for (PluginItem pi:items) {
            ItemInfo info = new ItemInfo(
                    getType(),
                    getPrefix(),
                    key+pi.name,
                    Constants.PLUGINPREFIX,
                    pi.provider
                    );
            newItems.put(info.name,info);
        }
        synchronized (pluginItems) {
            //delete all items with the same pluginName that are not contained in the new list
            ArrayList<String> toDelete=new ArrayList<>();
            pluginItems.values()
                    .stream()
                    .filter(v->v.fileName.startsWith(key))
                    .map(v -> (newItems.get(v.name) == null)?toDelete.add(v.name):0);
            for (String k:toDelete){
                pluginItems.remove(k);
            }
            for (ItemInfo item:newItems.values()) {
                pluginItems.put(item.name, item);
            }
        }
    }
}
