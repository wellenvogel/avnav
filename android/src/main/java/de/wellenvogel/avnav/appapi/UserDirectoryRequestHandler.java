package de.wellenvogel.avnav.appapi;

import android.content.res.AssetManager;
import android.net.Uri;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.PrintWriter;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Map;

import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.worker.GpsService;

public class UserDirectoryRequestHandler extends DirectoryRequestHandler {
    static final String USER_MJS="user.mjs";
    static final String USER_JS="user.js";
    private static String templateFiles[]=new String[]{"user.css",USER_JS,"splitkeys.json","images.json",USER_MJS};
    private static String emptyJsonFiles[]=new String[]{"keys.json"};
    //input stream for a js file wrapped by prefix and suffix
    static class JsStream extends InputStream {

        ArrayList<InputStream> streams=new ArrayList<>();
        int streamIndex=0;
        long size=0;

        private void addStream(InputStream i,long sz){
            streams.add(i);
            size+=sz;
        }
        public JsStream(File f,byte[] additionalPrefix) throws Exception {
            addStream(new ByteArrayInputStream(JSPREFIX),JSPREFIX.length);
            if (additionalPrefix != null) {
                addStream(new ByteArrayInputStream(additionalPrefix),additionalPrefix.length);
            }
            addStream(new FileInputStream(f),f.length());
            addStream(new ByteArrayInputStream(JSSUFFIX),JSSUFFIX.length);
        }
        @Override
        public int read() throws IOException {
            while (streamIndex < streams.size()){
                InputStream i=streams.get(streamIndex);
                int rt=i.read();
                if (rt < 0){
                    streamIndex++;
                    continue;
                }
                return rt;
            }
            return -1;
        }

        @Override
        public void close() throws IOException {
            super.close();
            for (InputStream s:streams){
                try{
                    s.close();
                }catch (Exception e){}
            }
        }

        long size(){
            return size;
        }
    };
    public UserDirectoryRequestHandler(RequestHandler handler, GpsService ctx,IDeleteByUrl deleter) throws Exception {
        super(Constants.TYPE_USER, ctx,handler.getWorkDirFromType(Constants.TYPE_USER), "user/viewer", deleter);
        AssetManager assets=handler.service.getAssets();
        for (String filename : templateFiles){
            File file=new File(workDir,filename);
            if (! file.exists()){
                if (filename.equals(USER_MJS)){
                    File oldu=new File(workDir,USER_JS);
                    //only create the new user.mjs if no user.js exists
                    if (oldu.exists()) continue;
                }
                String templateName="viewer/"+filename;
                try {
                    InputStream src = assets.open(templateName);
                    AvnLog.i("creating user file " + filename + " from template");
                    writeAtomic(file,src,false);
                }catch (Throwable t){
                    AvnLog.e("unable to copy template "+templateName,t);
                }
            }
        }
        for (String filename : emptyJsonFiles){
            File file=new File(workDir,filename);
            if (! file.exists()){
                try {
                    AvnLog.i("creating empty user file " + filename );
                    PrintWriter out= new PrintWriter(new FileOutputStream(file));
                    out.println("{ }");
                    out.close();
                }catch (Throwable t){
                    AvnLog.e("unable to create "+filename,t);
                }
            }
        }
    }

    static final byte [] JSPREFIX = String.join("\n",
            "try{",
            "let handler = {",
                "get(target, key, descriptor) {",
                    "if (key != 'avnav') return target[key];",
                    "return {",
                        "api:target.avnavLegacy",
                    "}",
                "}",
            "};",
            "let proxyWindow = new Proxy(window, handler);",
            "(function(window,avnav){",
            ""
            ).getBytes(StandardCharsets.UTF_8);
    static final byte [] JSSUFFIX = String.join("\n",
            "}.bind(proxyWindow,proxyWindow).call(proxyWindow,{api:window.avnavLegacy}));",
                    "}catch(e){",
                        "window.avnavLegacy.showToast(e.message+\"\\n\"+(e.stack||e))",
                    "}"
    ).getBytes(StandardCharsets.UTF_8);
    @Override
    public ExtendedWebResourceResponse handleDirectRequest(Uri uri, RequestHandler handler, String method, Map<String, String> headers) throws Exception {
        String path=uri.getPath();
        if (path == null) return null;
        if (path.startsWith("/")) path=path.substring(1);
        if (!path.startsWith(urlPrefix)) return null;
        path = path.substring((urlPrefix.length()+1));
        if (path.startsWith("__")){
            int slash=path.indexOf('/');
            if (slash < 0 || slash >= (path.length()-1)) return null;
            path=path.substring(slash+1);
        }
        String[] parts = path.split("/");
        if (parts.length < 1) return null;
        String fallback=uri.getQueryParameter("fallback");
        if (parts.length > 1) return super.doHandleDirectRequest(path, handler, method, headers,fallback);
        String name= URLDecoder.decode(parts[0],"UTF-8");
        if (!name.equals("user.js")) return super.doHandleDirectRequest(path, handler, method, headers,fallback);
        File foundFile=new File(workDir,name);
        if (! foundFile.exists()) return super.doHandleDirectRequest(path, handler, method, headers,fallback);
        String base="/"+urlPrefix;
        byte[] baseUrl=("var AVNAV_BASE_URL=\""+base+"\";\n").getBytes(StandardCharsets.UTF_8);
        JsStream out=new JsStream(foundFile,baseUrl);
        return new ExtendedWebResourceResponse(
                    out.size(),
                    RequestHandler.mimeType(foundFile.getName()),
                    "", out);

    }

    private boolean updateSequence(String name){
        if (Arrays.asList(templateFiles).contains(name) || Arrays.asList(emptyJsonFiles).contains(name)){
            this.gpsService.updateConfigSequence();
            return true;
        }
        return false;
    }

    @Override
    public boolean handleUpload(PostVars postData, String name, boolean ignoreExisting, boolean completeName) throws Exception {
        if (name.startsWith("__")) throw new Exception("name must not start with __");
        boolean rt=super.handleUpload(postData, name, ignoreExisting, completeName);
        if (rt){
            updateSequence(name);
        }
        return rt;
    }

    @Override
    public boolean handleDelete(String name, Uri uri) throws Exception {
        boolean rt=super.handleDelete(name, uri);
        if (rt) updateSequence(name);
        return rt;
    }

    @Override
    public boolean handleRename(String oldName, String newName) throws Exception {
        if (newName.startsWith("__")) throw new Exception("name must not start with __");
        boolean rt=super.handleRename(oldName, newName);
        if (rt){
            if (!updateSequence(oldName)) {
                updateSequence(newName);
            }
        }
        return rt;
    }
}
