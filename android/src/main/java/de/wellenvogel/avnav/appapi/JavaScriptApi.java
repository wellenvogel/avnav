package de.wellenvogel.avnav.appapi;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;

import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.MainActivity;
import de.wellenvogel.avnav.util.AvnLog;

//potentially the Javascript interface code is called from the Xwalk app package
//so we have to be careful to always access the correct resource manager when accessing resources!
//to make this visible we pass a resource manager to functions called from here that open dialogs
public class JavaScriptApi {
    private RequestHandler getRequestHandler() {
        return mainActivity.getRequestHandler();
    }

    private class ChannelSocket implements IWebSocket{
        private String url;
        private IWebSocketHandler handler;
        int id;
        private final ArrayList<String> remoteMessages=new ArrayList<>();
        private boolean open=true;
        ChannelSocket(String url,IWebSocketHandler handler,int id){
            this.url = url;
            this.handler=handler;
            this.id=id;
            synchronized (remoteMessages){
                remoteMessages.clear();
            }
            handler.onConnect(this);
        }
        @Override
        public String getUrl() {
            return url;
        }

        @Override
        public boolean send(String msg) throws IOException {
            synchronized (remoteMessages){
                if (remoteMessages.size() < 10) remoteMessages.add(msg);
                else return false;
            }
            mainActivity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    mainActivity.sendEventToJs(Constants.JS_REMOTE_MESSAGE,id);
                }
            });
            return true;
        }

        @Override
        public int getId() {
            return id;
        }

        @Override
        public void close(boolean callHandler) {
            localClose(callHandler);
            synchronized (sockets){
                sockets.remove(getId());
            }

        }

        public void localClose(boolean callHandler){
            open=false;
            if (callHandler) handler.onClose(this);
            synchronized (remoteMessages){
                remoteMessages.clear();
            }
            mainActivity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    mainActivity.sendEventToJs(Constants.JS_REMOTE_CLOSE,id);
                }
            });
        }

        @Override
        public boolean isOpen() {
            return open;
        }

        public String getMessage(){
           synchronized (remoteMessages){
               if (remoteMessages.size()>0){
                   return remoteMessages.remove(0);
               }
               return null;
           }
        }
        public void msgFromJs(String msg){
            if (! isOpen()) return;
            handler.onReceive(msg,this);
        }
    }
    private UploadData uploadData=null;
    private MainActivity mainActivity;
    private boolean detached=false;
    final HashMap<Integer,ChannelSocket> sockets=new HashMap<>();
    private int getNextSocketId(){
        return WebSocket.getNextId();
    }

    private Uri lastOpenedUri;

    public JavaScriptApi(MainActivity mainActivity) {
        this.mainActivity = mainActivity;
    }

    public synchronized Uri setLastOpenedUri(Uri newUri){
        Uri rt=lastOpenedUri;
        lastOpenedUri=newUri;
        return rt;
    }

    public void onDetach(){
        detached=true;
        if (uploadData != null){
            uploadData.interruptCopy(true);
        }
        synchronized (sockets){
            for (ChannelSocket socket:sockets.values()){
                socket.localClose(true);
            }
            sockets.clear();
        }
    }

    private String returnStatus(String status){
        JSONObject o=new JSONObject();
        try {
            o.put("status", status);
        }catch (JSONException i){}
        return o.toString();
    }


    /**
     * replacement for the missing ability to intercept post requests
     * will only work for small data provided here as a string
     * basically it calls the request handler and returns the status as json object
     * @param url the url
     * @param data the post data
     * @return status
     */
    @JavascriptInterface
    public String handleUpload(String url,String data){
        if (detached) return null;
        try {
            RequestHandler.NavResponse rt= getRequestHandler().handleNavRequestInternal(Uri.parse(url),new PostVars(data),null);
            if (rt == null){
                return RequestHandler.getErrorReturn("no data for "+url).toString();
            }
            if (! rt.isJson()){
                return RequestHandler.getErrorReturn("invalid post request").toString();
            }
            return rt.getJson().toString();
        } catch (Exception e) {
            AvnLog.e("error in upload request for "+url+":",e);
            try {
                return RequestHandler.getErrorReturn(e.getMessage()).toString();
            } catch (JSONException jsonException) {
                return null;
            }
        }

    }

    
    @JavascriptInterface
    public boolean startFileUpload(String type,String name,boolean overwrite,long id){
        if (detached) return false;
        Uri lastOpened=setLastOpenedUri(null); //atomic get and reset
        if (lastOpened == null){
            return false;
        }
        try {
            UploadData data = uploadData;
            if (data != null) {
                uploadData.interruptCopy(true);
                uploadData = null;
            }
            INavRequestHandler handler = getRequestHandler().getHandler(type);
            if (handler == null) return false;
            data = new UploadData(mainActivity, handler, id);
            data.setOverwrite(overwrite);
            uploadData = data;
            uploadData.saveFile(lastOpened, name);
            uploadData.copyFile();
            return true;
        }catch (Throwable t){
            AvnLog.e("unable to start file copy for "+name,t);
            return false;
        }
    }

    @JavascriptInterface
    public String getFileName(long id){
        if (uploadData==null || ! uploadData.isReady(id)) return null;
        return uploadData.getName();
    }


    /**
     * during the transfer we fire an {@link Constants#JS_FILE_COPY_PERCENT} event having the
     * progress in % as id.
     * When done we fire {@link Constants#JS_FILE_COPY_DONE} - with 0 for success, 1 for errors
     * The target is determined by the type that we provided in requestFile
     * @param id the id we used in {@link #startFileUpload(String, String, boolean, long)}
     * @return true if the copy started successfully
     */
    @JavascriptInterface
    public boolean copyFile(long id){
        if (detached) return false;
        if (uploadData==null || ! uploadData.isReady(id)) return false;
        return uploadData.copyFile();
    }
    @JavascriptInterface
    public long getFileSize(long id){
        if (uploadData==null || ! uploadData.isReady(id)) return -1;
        return uploadData.getSize();
    }

    @JavascriptInterface
    public boolean interruptCopy(long id){
        if (uploadData==null || ! uploadData.isReady(id)) return false;
        return uploadData.interruptCopy(false);
    }


    @JavascriptInterface
    public void goBack() {
        if (detached) return;
        mainActivity.mainGoBack();
    }

    @JavascriptInterface
    public void acceptEvent(String key,int num){
        if (detached) return;
        if (key != null && key.equals("backPressed")) {
           mainActivity.jsGoBackAccepted(num);
        }
    }

    @JavascriptInterface
    public void showSettings(){
        if (detached) return;
        mainActivity.showSettings(false);
    }

    @JavascriptInterface
    public void applicationStarted(){
        if (detached) return;
        getRequestHandler().getSharedPreferences().edit().putBoolean(Constants.WAITSTART,false).commit();
    }
    @JavascriptInterface
    public void externalLink(String url){
        if (detached) return;
        Intent goDownload = new Intent(Intent.ACTION_VIEW);
        goDownload.setData(Uri.parse(url));
        try {
            mainActivity.startActivity(goDownload);
        } catch (Exception e) {
            Toast.makeText(mainActivity, e.getLocalizedMessage(), Toast.LENGTH_LONG).show();
            return;
        }
    }
    @JavascriptInterface
    public String getVersion(){
        if (detached) return null;
        try {
            String versionName = mainActivity.getPackageManager()
                    .getPackageInfo(mainActivity.getPackageName(), 0).versionName;
            return versionName;
        } catch (PackageManager.NameNotFoundException e) {
            return "<unknown>";
        }
    }
    @JavascriptInterface
    public boolean dimScreen(int percent){
        mainActivity.setBrightness(percent);
        return true;
    }
    @JavascriptInterface
    public void launchBrowser(){
        mainActivity.launchBrowser();
    }

    /**
     * get a newly attached device
     * will be called by js code after startup and after a reload event
     * @return a json string with typeName and initialParameters
     */
    @JavascriptInterface
    public String getAttachedDevice(){
        return mainActivity.getAttachedDevice();
    }

    @JavascriptInterface
    public void dialogClosed(){
        mainActivity.dialogClosed();
    }

    @JavascriptInterface
    public int channelOpen(String url){
        IWebSocketHandler handler= getRequestHandler().getWebSocketHandler(url);
        if (handler == null) return -1;
        ChannelSocket socket=new ChannelSocket(url,handler,getNextSocketId());
        synchronized (sockets){
            sockets.put(socket.getId(),socket);
        }
        return socket.getId();
    }
    @JavascriptInterface
    public void channelClose(int id){
        ChannelSocket socket;
        synchronized (sockets) {
            socket = sockets.get(id);
        }
        if (socket == null) return;
        socket.close(true);
    }
    @JavascriptInterface
    public String readChannelMessage(int id){
        ChannelSocket socket;
        synchronized (sockets) {
            socket = sockets.get(id);
        }
        if (socket == null) return null;
        return socket.getMessage();

    }
    @JavascriptInterface
    public boolean sendChannelMessage(int id,String msg){
        ChannelSocket socket;
        synchronized (sockets) {
            socket = sockets.get(id);
        }
        if (socket == null) return false;
        socket.msgFromJs(msg);
        return true;
    }
    @JavascriptInterface
    public boolean isChannelOpen(int id){
        ChannelSocket socket;
        synchronized (sockets) {
            socket = sockets.get(id);
        }
        if (socket == null) return false;
        return socket.isOpen();
    }

    @JavascriptInterface
    public boolean dataDownload(String dataUrl, String fileName, String mimeType){
        try {
            mainActivity.startDataDownload(dataUrl,fileName,mimeType);
        } catch (Exception e) {
            AvnLog.e("dataDownload error ",e);
            return false;
        }
        return true;

    }

}
