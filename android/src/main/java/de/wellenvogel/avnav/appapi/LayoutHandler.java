package de.wellenvogel.avnav.appapi;

import android.app.Activity;
import android.net.Uri;
import android.support.v4.content.FileProvider;

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

import de.wellenvogel.avnav.fileprovider.UserFileProvider;
import de.wellenvogel.avnav.main.BuildConfig;
import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.fileprovider.AssetsProvider;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;

public class LayoutHandler implements INavRequestHandler{
    String systemDir=null; //base path at assets
    File userDir=null;
    Activity activity=null;


    static class LayoutInfo implements INavRequestHandler.IJsonObect {
        public static final String USERPREFIX="user.";
        public static final String SYSTEMPREFIX="system.";
        public String name;
        public long mtime;
        public boolean canDelete;
        @Override
        public JSONObject toJson() throws JSONException {
            JSONObject rt=new JSONObject();
            rt.put("name",(canDelete?USERPREFIX:SYSTEMPREFIX)+name);
            rt.put("canDelete",canDelete);
            rt.put("time",mtime/1000);
            return rt;
        }
        public LayoutInfo(String name, boolean canDelete,long mtime){
            this.name=name;
            this.canDelete=canDelete;
            this.mtime=mtime;
        }
    }


    @Override
    public ExtendedWebResourceResponse handleDownload(String name, Uri uri) throws Exception {
        InputStream layout=getLayoutForReading(name);
        return new ExtendedWebResourceResponse(-1,"application/json","",layout);
    }

    @Override
    public boolean handleUpload(PostVars postData, String name, boolean ignoreExisting) throws Exception {
        if (postData == null) throw new Exception("no data");
        if (!userDir.isDirectory()) throw new IOException("user dir is no directory");
        String fileName = name + ".json";
        File of = new File(userDir, fileName);
        if (!userDir.canWrite()) throw new IOException("unable to write layout " + fileName);
        FileOutputStream os = new FileOutputStream(of);
        postData.writeTo(os);
        os.close();
        return true;
    }

    @Override
    public JSONArray handleList() throws Exception{
            JSONArray li=readDir(userDir,true);
            for (IJsonObect o: readAssetsDir()){
                li.put(o.toJson());
            }
            return li;
    }

    @Override
    public boolean handleDelete(String name, Uri uri) throws Exception {
        if (!name.startsWith(LayoutInfo.USERPREFIX)) {
            throw new IOException("unable to delete layout " + name);
        }
        File layout = new File(userDir, name.substring(LayoutInfo.USERPREFIX.length()) + ".json");
        if (!layout.exists() || !layout.isFile()) {
            throw new IOException("layout " + name + " not found");
        }
        return layout.delete();

    }

    @Override
    public JSONObject handleApiRequest(Uri uri,PostVars postData) throws Exception {
        String command= AvnUtil.getMandatoryParameter(uri,"command");
        if (command.equals("list")){
            RequestHandler.getReturn(new RequestHandler.KeyValue("data",handleList()));
        }
        return null;
    }

    @Override
    public ExtendedWebResourceResponse handleDirectRequest(String url) throws FileNotFoundException {
        return null;
    }

    @Override
    public String getPrefix() {
        return null;
    }

    private ArrayList<IJsonObect> readAssetsDir() throws Exception {
        ArrayList<IJsonObect> rt=new ArrayList<>();
        String [] list;
        list=activity.getAssets().list(systemDir);
        for (String name :list){
            if (!name.endsWith(".json")) continue;
            if (name.equals("keys.json")) continue;
            LayoutInfo li=new LayoutInfo(name.replaceAll("\\.json$",""), false,BuildConfig.TIMESTAMP);
            rt.add(li);
        }
        return rt;
    }
    private JSONArray readDir(File dir,boolean canDelete) throws JSONException {
        JSONArray rt=new JSONArray();
        if (!dir.isDirectory()) return rt;
        for (File f: dir.listFiles()){
            if (!f.getName().endsWith(".json")) continue;
            if (! f.isFile()) continue;
            LayoutInfo li=new LayoutInfo(f.getName().replaceAll("\\.json$",""),canDelete,f.lastModified());
            rt.put(li.toJson());
        }
        return rt;
    }


    public LayoutHandler(Activity activity,String systemDir, File userDir){
        this.systemDir=systemDir;
        this.userDir=userDir;
        this.activity=activity;
        if (! userDir.isDirectory()){
            userDir.mkdirs();
        }
    }

    public InputStream getLayoutForReading(String name) throws IOException {
        if (name.startsWith(LayoutInfo.SYSTEMPREFIX)){
            name=name.substring(LayoutInfo.SYSTEMPREFIX.length());
            String filename=name+".json";
            return activity.getAssets().open(systemDir+"/"+filename);
        }
        if (name.startsWith(LayoutInfo.USERPREFIX)){
            name=name.substring(LayoutInfo.USERPREFIX.length());
            String filename=name+".json";
            File ifile=new File(userDir,filename);
            if (! ifile.canRead()) throw new IOException("unable to read layout file: "+ifile.getAbsolutePath());
            return new FileInputStream(ifile);
        }
        throw new IOException("neither system nor user layout: "+name);
    }

    public static Uri getUriForLayout(String name){
        if (name.startsWith("system.")){
            return AssetsProvider.createContentUri("layout",name.replaceAll("^system\\.",""));
        }
        else{
            try {
                Uri rt = UserFileProvider.createContentUri("layout",name.replaceAll("^user\\.",""),null);
                return rt;
            }catch (Throwable t){
                AvnLog.e("error creating uri for layout "+name,t);
                return null;
            }
        }
    }



}
