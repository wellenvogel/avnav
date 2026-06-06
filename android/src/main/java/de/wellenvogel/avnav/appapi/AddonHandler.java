package de.wellenvogel.avnav.appapi;

import static de.wellenvogel.avnav.main.Constants.TYPE_ADDON;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;

import androidx.annotation.Nullable;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.FileNotFoundException;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.worker.GpsService;

public class AddonHandler implements INavRequestHandler,IDeleteByUrl,IPluginAware{


    public static class AddonInfo implements AvnUtil.IJsonObect {
        public static final String SHORT_TEXT = "shortText";
        public static final String PAGE = "page";
        public static final String NEW_WINDOW = "newWindow";
        public static final String URL = "url";
        public static final String ICON = "icon";
        public static final String TITLE = "title";
        public static final String NAME = "name";
        public static final String CAN_DELETE = "canDelete";
        public static final String ORIGINAL_URL = "originalUrl";
        public static final String KEY = "key";
        public static final String LONG_TEXT = "longText";
        public String name;
        public String url;
        public String icon;
        public boolean adaptHttpUrls=false;
        HashMap<String,String> stringParameters=new HashMap<>();
        static final String[] STRING_KEYS=new String[]{
                TITLE,
                SHORT_TEXT,
                LONG_TEXT,
                PAGE,
                NEW_WINDOW
        };

        public boolean compare(@Nullable AddonInfo obj) {
            if (this == obj) return true;
            if (obj == null ) return false;
            for (String k: STRING_KEYS){
                if (! Objects.equals(stringParameters.get(k),obj.stringParameters.get(k))) return false;
            }
            return Objects.equals(name,obj.name)
                    && Objects.equals(url,obj.url)
                    && Objects.equals(icon,obj.icon)
                    && adaptHttpUrls == obj.adaptHttpUrls;
        }

        @Override
        public JSONObject toJson() throws JSONException {
            JSONObject rt=new JSONObject();
            rt.put(NAME,name);
            rt.put(KEY,name);
            rt.put(CAN_DELETE,true);
            rt.put(URL,url);
            rt.put(ORIGINAL_URL,url);
            rt.put(ICON,icon);
            for (String k:STRING_KEYS){
                String v=stringParameters.get(k);
                if (v != null) rt.put(k,v);
            }
            return rt;
        }
        public AddonInfo(String name){
            this.name=name;
        }

        static AddonInfo fromJson(JSONObject o) throws JSONException {
            AddonInfo rt=new AddonInfo(o.getString(NAME));
            for (String k: STRING_KEYS){
                rt.stringParameters.put(k,o.optString(k,null));
            }
            rt.icon=o.getString(ICON);
            rt.url=o.getString(URL);
            return rt;
        }
    }

    private GpsService context;
    private RequestHandler handler;

    private final HashMap<String,List<AddonInfo>> externalAddons=new HashMap<>();

    public AddonHandler(GpsService ctx,RequestHandler handler){
        this.context=ctx;
        this.handler=handler;
    }

    @Override
    public void removePluginItems(String pluginName, boolean finalCleanup) {
        synchronized (externalAddons){
            if (externalAddons.get(pluginName) == null) return;
            externalAddons.remove(pluginName);
        }
        context.updateConfigSequence();
    }

    @Override
    public void setPluginItems(String pluginName, List<PluginItem> items) throws Exception {
        ArrayList<AddonInfo> addons=new ArrayList<>();
        for (PluginItem pi:items){
            addons.add(AddonInfo.fromJson(pi.toJson()));
        }
        synchronized (externalAddons){
            List<AddonInfo> old=externalAddons.get(pluginName);
            //check for changes
            if (old != null){
                if (old.size() == addons.size()){
                    //must also match order
                    boolean differs=false;
                    for (int i=0;i<old.size();i++){
                        if (!old.get(i).compare(addons.get(i))){
                            differs=true;
                            break;
                        }
                    }
                    if (! differs) return; //no update
                }
            }
            externalAddons.put(pluginName,addons);
        }
        context.updateConfigSequence();
    }


    @Override
    public ExtendedWebResourceResponse handleDownload(String name, Uri uri) throws Exception {
        throw new Exception("not implemented");
    }

    @Override
    public boolean handleUpload(PostVars postData, String name, boolean ignoreExisting, boolean completeName) throws Exception {
        throw new Exception("not implemented");
    }
    private static boolean hasExternalUrl(JSONObject aj){
        return aj.optString(AddonInfo.URL,"").toLowerCase().startsWith("http");
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
            if (hasExternalUrl(aj)){
                aj.put(AddonInfo.URL,aj.getString(AddonInfo.URL).replace("$HOST",host));
            }
            rt.put(aj);
        }
        String [] REPLACE_KEYS=new String[]{AddonInfo.URL,AddonInfo.ICON};
        synchronized (externalAddons){
            for (String k: externalAddons.keySet()){
                List<AddonInfo> extAddons=externalAddons.get(k);
                if (extAddons == null) continue;
                for (AddonInfo addon: extAddons){
                    JSONObject aj=addon.toJson();
                    if (serverInfo != null && hasExternalUrl(aj)) {
                        for (String rk : REPLACE_KEYS) {
                            if ( !rk.equals("url")) {
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

    @Override
    public JSONObject handleInfo(String name, Uri uri, RequestHandler.ServerInfo serverInfo) throws Exception {
        if (name == null) return new JSONObject();
        JSONArray items=handleList(uri,serverInfo);
        for (int i=0;i<items.length();i++){
            try{
                JSONObject item=items.getJSONObject(i);
                if (item.has("name") && name.equals(item.getString("name"))){
                    return item;
                }
            }catch (Exception e){}
        }
        return null;
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
                            if (url == null) continue;
                            if (url.startsWith("http")) continue;
                            if (url.startsWith("/")) url=url.substring(1);
                            else url="viewer/"+url;
                            INavRequestHandler nrh = handler.getPrefixHandler(url);
                            try {
                                ExtendedWebResourceResponse resp = nrh.handleDirectRequest(Uri.parse(url), handler, "GET",new HashMap<>() );
                                if (resp == null || resp.getStatusCode() != 200) {
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
        context.updateConfigSequence();
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

    @Override
    public boolean handleRename(String oldName, String newName) throws Exception {
        throw new Exception("not available");
    }

    private String computeName(String url, String icon, String title) throws NoSuchAlgorithmException {
        MessageDigest digest=java.security.MessageDigest.getInstance("MD5");
        if (url != null) digest.update(url.getBytes());
        if (icon != null) digest.update(icon.getBytes());
        if (title != null) digest.update(title.getBytes());
        digest.update((new Date()).toString().getBytes(StandardCharsets.UTF_8));
        String hash = new BigInteger(1, digest.digest()).toString(16);
        return hash;
    }

    @Override
    public JSONObject handleApiRequest(String command, Uri uri, PostVars postData, RequestHandler.ServerInfo serverInfo) throws Exception {
        if (command.equals("list")){
            return RequestHandler.getReturn(new AvnUtil.KeyValue("items",handleList(uri, serverInfo)));
        }
        if (command.equals("update")){
            String name=uri.getQueryParameter(AddonInfo.NAME);
            String title=uri.getQueryParameter( AddonInfo.TITLE);
            String url=AvnUtil.getMandatoryParameter(uri,AddonInfo.URL);
            String icon=AvnUtil.getMandatoryParameter(uri,AddonInfo.ICON);
            String newWindow=uri.getQueryParameter(AddonInfo.NEW_WINDOW);
            String page=uri.getQueryParameter(AddonInfo.PAGE);
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
                for (String k: AddonInfo.STRING_KEYS){
                    newAddon.stringParameters.put(k,uri.getQueryParameter(k));
                }
                addons.add(newAddon);
            }
            else{
                idx=findAddon(addons,name);
                if (idx < 0) {
                    return RequestHandler.getErrorReturn("addon not found");
                }
                AddonInfo current=addons.get(idx);
                current.icon=icon;
                for (String k: AddonInfo.STRING_KEYS){
                    current.stringParameters.put(k,uri.getQueryParameter(k));
                }
            }
            saveAddons(addons);
            return RequestHandler.getReturn();
        }
        return RequestHandler.getErrorReturn("unknown command "+command);
    }

    @Override
    public ExtendedWebResourceResponse handleDirectRequest(Uri uri, RequestHandler handler, String method, Map<String, String> headers) throws FileNotFoundException {
        return null;
    }

    public static final String PREFIX="addons";
    @Override
    public String getPrefix() {
        return PREFIX;
    }

    @Override
    public String getType() {
        return TYPE_ADDON;
    }


}
