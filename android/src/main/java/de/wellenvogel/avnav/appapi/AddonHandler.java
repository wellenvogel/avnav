package de.wellenvogel.avnav.appapi;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.FileNotFoundException;
import java.math.BigInteger;
import java.net.URL;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;

public class AddonHandler implements INavRequestHandler,IDeleteByUrl{

    public static class AddonInfo implements AvnUtil.IJsonObect {
        public String name;
        public String url;
        public String icon;
        public String title;
        public String newWindow="false";
        public boolean adaptHttpUrls=false;
        @Override
        public JSONObject toJson() throws JSONException {
            JSONObject rt=new JSONObject();
            rt.put("name",name);
            rt.put("key",name);
            rt.put("canDelete",true);
            rt.put("url",url);
            rt.put("originalUrl",url);
            rt.put("keepUrl",url.startsWith("http") && ! adaptHttpUrls);
            rt.put("icon",icon);
            rt.put("newWindow",newWindow);
            if (title != null) rt.put("title",title);
            return rt;
        }
        public AddonInfo(String name){
            this.name=name;
        }
        static AddonInfo fromJson(JSONObject o) throws JSONException {
            AddonInfo rt=new AddonInfo(o.getString("name"));
            rt.title=o.optString("title",null);
            rt.icon=o.getString("icon");
            rt.url=o.getString("url");
            if (o.has("newWindow")) {
                rt.newWindow = o.getString("newWindow");
            }
            return rt;
        }
    }

    private Context context;
    private RequestHandler handler;

    private final HashMap<String,List<AddonInfo>> externalAddons=new HashMap<>();

    public AddonHandler(Context ctx,RequestHandler handler){
        this.context=ctx;
        this.handler=handler;
    }

    public void addExternalAddons(String name,List<AddonInfo> addons){
        synchronized (externalAddons){
            externalAddons.put(name,addons);
        }
    }
    public void removeExternalAddons(String name){
        synchronized (externalAddons){
            externalAddons.remove(name);
        }
    }


    @Override
    public ExtendedWebResourceResponse handleDownload(String name, Uri uri) throws Exception {
        throw new Exception("not implemented");
    }

    @Override
    public boolean handleUpload(PostVars postData, String name, boolean ignoreExisting) throws Exception {
        throw new Exception("not implemented");
    }

    @Override
    public JSONArray handleList(Uri uri, RequestHandler.ServerInfo serverInfo) throws Exception{
        String includeInvalid=uri.getQueryParameter("invalid");
        List<AddonInfo> addons=getAddons(!((includeInvalid != null) && (includeInvalid.toLowerCase().equals("true"))));
        JSONArray rt=new JSONArray();
        String host=AvnUtil.getLocalHost().getHostAddress();
        if (serverInfo != null && serverInfo.address != null) {
            host=serverInfo.address.getHostAddress();
        }
        for (AddonInfo addon : addons) {
            JSONObject aj=addon.toJson();
            if (aj.optBoolean("keepUrl",false)){
                //external url
                String url=aj.optString("url","").replace("$HOST",host);
                aj.put("url",url);
            }
            rt.put(aj);
        }
        String [] REPLACE_KEYS=new String[]{"url","icon"};
        synchronized (externalAddons){
            for (String k: externalAddons.keySet()){
                List<AddonInfo> extAddons=externalAddons.get(k);
                if (extAddons == null) continue;
                for (AddonInfo addon: extAddons){
                    JSONObject aj=addon.toJson();
                    if (serverInfo != null) {
                        for (String rk : REPLACE_KEYS) {
                            if (aj.optBoolean("keepUrl", false) || !rk.equals("url")) {
                                //external url
                                String v = aj.optString(rk, "");
                                v=serverInfo.replaceHostInUrl(v);
                                aj.put(rk, v);
                            }
                        }
                    }
                    aj.put("canDelete","false");
                    rt.put(aj);
                }
            }
        }
        return rt;
    }

    private ArrayList<AddonInfo> getAddons(boolean check){
        ArrayList<AddonInfo> rt=new ArrayList<AddonInfo>();
        SharedPreferences prefs=AvnUtil.getSharedPreferences(context);
        String addonString=null;
        try {
            addonString=prefs.getString(Constants.ADDON_CONFIG, null);
            if (addonString != null){
                JSONArray addons=new JSONArray(addonString);
                for (int i=0;i<addons.length();i++){
                    JSONObject addon=addons.getJSONObject(i);
                    AddonInfo info=AddonInfo.fromJson(addon);
                    if (info.url == null) continue;
                    if (check ){
                        boolean ok=true;
                        for (String url : new String[]{info.url, info.icon}) {
                            if (url.startsWith("http")) continue;
                            if (url.startsWith("/")) url=url.substring(1);
                            else url="viewer/"+url;
                            INavRequestHandler nrh = handler.getPrefixHandler(url);
                            try {
                                ExtendedWebResourceResponse resp = nrh.handleDirectRequest(Uri.parse(url), handler, "GET");
                                if (resp == null) {
                                    throw new Exception("not found");
                                }
                                resp.getData().close();
                            } catch (Exception e) {
                                AvnLog.e("url/icon for userapp not found" + url);
                                ok=false;
                                break;
                            }
                        }
                        if (!ok) continue;
                    }
                    rt.add(info);
                }
            }
        }catch (Throwable e){
            AvnLog.e("error reading addon config",e);
        }
        return rt;
    }


    private void saveAddons(List<AddonInfo> addons) throws JSONException {
        JSONArray sv=new JSONArray();
        for (AddonInfo info:addons){
            sv.put(info.toJson());
        }
        AvnUtil.getSharedPreferences(context).edit()
                .putString(Constants.ADDON_CONFIG,sv.toString()).apply();
    }

    private int findAddon(List<AddonInfo> list, String name){
        for (int i=0;i<list.size();i++){
            if (list.get(i).name.equals(name)) return i;
        }
        return -1;
    }
    @Override
    public boolean deleteByUrl(String url) throws JSONException {
        ArrayList<AddonInfo> addons=getAddons(false);
        ArrayList<Integer> deletes=new ArrayList<Integer>();
        for (int i=0;i<addons.size();i++){
            if (addons.get(i).url.equals(url)) deletes.add(i);
        }
        if (deletes.size() < 1) return false;
        for (int k=deletes.size()-1;k>=0;k--){
            addons.remove(deletes.get(k).intValue());
        }
        saveAddons(addons);
        return true;
    }

    @Override
    public boolean handleDelete(String name, Uri uri) throws Exception {
        synchronized (this) {
            ArrayList<AddonInfo> addons = getAddons(false);
            int idx = findAddon(addons, name);
            if (idx < 0) return false;
            addons.remove(idx);
            saveAddons(addons);
            return true;
        }
    }

    private String computeName(String url, String icon, String title) throws NoSuchAlgorithmException {
        MessageDigest digest=java.security.MessageDigest.getInstance("MD5");
        if (url != null) digest.update(url.getBytes());
        if (icon != null) digest.update(icon.getBytes());
        if (title != null) digest.update(title.getBytes());
        String hash = new BigInteger(1, digest.digest()).toString(16);
        return hash;
    }

    @Override
    public JSONObject handleApiRequest(Uri uri, PostVars postData, RequestHandler.ServerInfo serverInfo) throws Exception {
        String command= AvnUtil.getMandatoryParameter(uri,"command");
        if (command.equals("list")){
            return RequestHandler.getReturn(new AvnUtil.KeyValue("items",handleList(uri, serverInfo)));
        }
        if (command.equals("update")){
            String name=uri.getQueryParameter("name");
            String title=uri.getQueryParameter("title");
            String url=AvnUtil.getMandatoryParameter(uri,"url");
            String icon=AvnUtil.getMandatoryParameter(uri,"icon");
            String newWindow=uri.getQueryParameter("newWindow");
            ArrayList<AddonInfo> addons=getAddons(false);
            int idx=-1;
            if (name == null){
                name=computeName(url,icon,title);
                idx=findAddon(addons,name);
                if (idx >= 0 ) {
                    return RequestHandler.getErrorReturn("a similar addon already exists");
                }
                AddonInfo newAddon=new AddonInfo(name);
                newAddon.url=url;
                newAddon.icon=icon;
                newAddon.title=title;
                if (newWindow != null) newAddon.newWindow=newWindow;
                addons.add(newAddon);
            }
            else{
                idx=findAddon(addons,name);
                if (idx < 0) {
                    return RequestHandler.getErrorReturn("addon not found");
                }
                AddonInfo current=addons.get(idx);
                current.icon=icon;
                current.title=title;
                current.url=url;
                if (newWindow != null) current.newWindow=newWindow;
            }
            saveAddons(addons);
            return RequestHandler.getReturn();
        }
        if (command.equals("delete")){
            String name=AvnUtil.getMandatoryParameter(uri,"name");
            boolean rt=handleDelete(name,uri);
            if (rt) return RequestHandler.getReturn();
            else return RequestHandler.getErrorReturn("delete failed");
        }
        return RequestHandler.getErrorReturn("unknown command "+command);
    }

    @Override
    public ExtendedWebResourceResponse handleDirectRequest(Uri uri, RequestHandler handler, String method) throws FileNotFoundException {
        return null;
    }

    public static final String PREFIX="addons";
    @Override
    public String getPrefix() {
        return PREFIX;
    }


}
