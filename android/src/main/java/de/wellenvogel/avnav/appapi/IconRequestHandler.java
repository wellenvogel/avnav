package de.wellenvogel.avnav.appapi;

import android.content.Context;
import android.net.Uri;
import android.os.Build;

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
import java.util.ArrayList;
import java.util.Date;
import java.util.Enumeration;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

import androidx.annotation.NonNull;
import de.wellenvogel.avnav.main.BuildConfig;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.worker.GpsService;
import de.wellenvogel.avnav.worker.Worker;

public class IconRequestHandler extends Worker implements INavRequestHandler{
    protected String urlPrefix;
    protected String type;
    protected Context context;
    JSONArray iconFiles;
    static final String ICONBASE="viewer/images";
    public IconRequestHandler(String type, GpsService ctx,String urlPrefrix) throws IOException {
        super(type,ctx);
        this.type=type;
        this.urlPrefix=urlPrefrix;
        this.context=ctx;
        iconFiles=new JSONArray();
        try {
            for (String name : ctx.getAssets().list(ICONBASE)) {
                JSONObject item = new JSONObject();
                item.put("name", name);
                item.put("url", "/"+urlPrefrix+"/"+name);
                item.put("canDelete",false);
                item.put("mtime", BuildConfig.TIMESTAMP/1000);
                iconFiles.put(item);
            }
        }catch(Throwable t){
            AvnLog.e("unable to read system icons");
        }

    }

    private boolean isValidName(String name) throws JSONException {
        for (int i=0;i<iconFiles.length();i++){
            JSONObject item=iconFiles.getJSONObject(i);
            if (item.getString("name").equals(name)){
                return true;
            }
        }
        return false;
    }

    @Override
    public ExtendedWebResourceResponse handleDownload(String name, Uri uri) throws Exception {
        if (isValidName(name)){
            return new ExtendedWebResourceResponse(-1,"application/octet-stream", "",context.getAssets().open(ICONBASE+"/"+name));
            }
        throw new IOException("file not found "+name);
    }

    @Override
    public boolean handleUpload(PostVars postData, String name, boolean ignoreExisting) throws Exception {
        throw new IOException("upload not allowed");
    }

    protected String getUrlFromName(String name) throws UnsupportedEncodingException {
       return "/"+urlPrefix+"/"+
               URLEncoder.encode(name,"utf-8");
    }
    @Override
    public JSONArray handleList(Uri uri, RequestHandler.ServerInfo serverInfo) throws Exception {
        return iconFiles;
    }

    @Override
    public boolean handleDelete(String name, Uri uri) throws Exception {
        throw new IOException("delete not allowed");
    }

    @Override
    public JSONObject handleApiRequest(Uri uri, PostVars postData, RequestHandler.ServerInfo serverInfo) throws Exception {
        String command=AvnUtil.getMandatoryParameter(uri,"command");
        if (command.equals("list")){
            return RequestHandler.getReturn(new AvnUtil.KeyValue("items",handleList(uri, serverInfo)));
        }
        return handleSpecialApiRequest(command,uri,postData,serverInfo);
    }

    @Override
    public ExtendedWebResourceResponse handleDirectRequest(Uri uri, RequestHandler handler, String method) throws Exception {
        String path=uri.getPath();
        if (path == null) return null;
        if (path.startsWith("/")) path=path.substring(1);
        if (!path.startsWith(urlPrefix)) return null;
        path = path.substring((urlPrefix.length()+1));
        if (! isValidName(path)) return null;
        return new ExtendedWebResourceResponse(-1,RequestHandler.mimeType(path), "",context.getAssets().open(ICONBASE+"/"+path));
    }

    protected JSONObject handleSpecialApiRequest(String command,Uri uri,PostVars postData,RequestHandler.ServerInfo serverInfo) throws Exception {
        return RequestHandler.getErrorReturn("unknonw api request "+command);
    }


    @Override
    protected void run(int startSequence) throws JSONException, IOException {
    }


    @Override
    public String getPrefix() {
        return urlPrefix;
    }


}
