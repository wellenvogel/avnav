package de.wellenvogel.avnav.util;

import android.app.Activity;
import android.content.res.AssetManager;
import android.net.Uri;
import android.support.v4.content.FileProvider;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

import de.wellenvogel.avnav.main.BuildConfig;
import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.INavRequestHandler;
import de.wellenvogel.avnav.main.RequestHandler;

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
    public RequestHandler.ExtendedWebResourceResponse handleDownload(String name, Uri uri) throws Exception {
        InputStream layout=getLayoutForReading(name);
        return new RequestHandler.ExtendedWebResourceResponse(-1,"application/json","",layout);
    }

    @Override
    public boolean handleUpload(String postData, String name, boolean ignoreExisting) throws Exception {
        if (!userDir.isDirectory()) throw new IOException("user dir is no directory");
        String fileName = name + ".json";
        File of = new File(userDir, fileName);
        if (of.exists() && ignoreExisting) return false;
        if (!userDir.canWrite()) throw new IOException("unable to write layout " + fileName);
        FileOutputStream os = new FileOutputStream(of);
        os.write(postData.getBytes());
        os.close();
        return true;
    }

    @Override
    public Collection<? extends IJsonObect> handleList() throws Exception{
            List<LayoutInfo> li=readDir(userDir,true);
            li.addAll(readAssetsDir());
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

    private List<LayoutInfo> readAssetsDir() throws IOException {
        ArrayList<LayoutInfo> rt=new ArrayList<>();
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
    private List<LayoutInfo> readDir(File dir,boolean canDelete){
        ArrayList<LayoutInfo> rt=new ArrayList<>();
        if (!dir.isDirectory()) return rt;
        for (File f: dir.listFiles()){
            if (!f.getName().endsWith(".json")) continue;
            if (! f.isFile()) continue;
            LayoutInfo li=new LayoutInfo(f.getName().replaceAll("\\.json$",""),canDelete,f.lastModified());
            rt.add(li);
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

    public Uri getUriForLayout(String name){
        if (name.startsWith("system.")){
            return AssetsProvider.createContentUri("layout",name.replaceAll("^system\\.",""));
        }
        else{
            try {
                Uri rt = FileProvider.getUriForFile(activity, Constants.FILE_PROVIDER_AUTHORITY, new File(userDir, name.replaceAll("^user\\.", "")));
                return rt;
            }catch (Throwable t){
                AvnLog.e("error creating uri for layout "+name,t);
                return null;
            }
        }
    }



}
