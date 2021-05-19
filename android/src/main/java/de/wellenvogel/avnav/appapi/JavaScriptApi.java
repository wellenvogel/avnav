package de.wellenvogel.avnav.appapi;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Resources;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;

import de.wellenvogel.avnav.fileprovider.UserFileProvider;
import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.MainActivity;
import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.worker.RemoteChannel;

//potentially the Javascript interface code is called from the Xwalk app package
//so we have to be careful to always access the correct resource manager when accessing resources!
//to make this visible we pass a resource manager to functions called from here that open dialogs
public class JavaScriptApi {
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
    private RequestHandler requestHandler;
    private MainActivity mainActivity;
    private boolean detached=false;
    final HashMap<Integer,ChannelSocket> sockets=new HashMap<>();
    private int getNextSocketId(){
        return WebSocket.getNextId();
    }
    public JavaScriptApi(MainActivity mainActivity, RequestHandler requestHandler) {
        this.requestHandler = requestHandler;
        this.mainActivity = mainActivity;
    }

    public void saveFile(Uri uri){
        if (uploadData != null) uploadData.saveFile(uri);
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

    @JavascriptInterface
    public boolean downloadFile(String name, String type,String url) {
        if (detached) return false;
        if (requestHandler.typeDirs.get(type) == null) {
            AvnLog.e("invalid type " + type + " for sendFile");
            return false;
        }
        Uri data = null;
        if (type.equals("layout")) {
            data = LayoutHandler.getUriForLayout(url);
        } else {
            try {
                data = UserFileProvider.createContentUri(type, name,url);
            } catch (Exception e) {
                AvnLog.e("unable to create content uri for " + name,e);
            }
        }
        if (data == null) return false;
        Intent shareIntent = new Intent();
        shareIntent.setAction(Intent.ACTION_SEND);
        shareIntent.putExtra(Intent.EXTRA_STREAM, data);
        shareIntent.setFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        shareIntent.setType("application/octet-stream");
        if (type.equals("layout")) {
            shareIntent.setType("application/json");
        }
        if (type.equals("route") || type.equals("track")) {
            shareIntent.setType("application/gpx+xml");
        }
        String title = mainActivity.getText(R.string.selectApp) + " " + name;
        mainActivity.startActivity(Intent.createChooser(shareIntent, title));
        return true;
    }

    /**
     * replacement for the missing ability to intercept post requests
     * will only work for small data provided here as a string
     * basically it calls the request handler and returns the status as string
     * @param url
     * @param data
     * @return status
     */
    @JavascriptInterface
    public String handleUpload(String url,String data){
        if (detached) return null;
        try {
            RequestHandler.NavResponse rt= requestHandler.handleNavRequestInternal(Uri.parse(url),new PostVars(data),null);
            if (! rt.isJson() || ! (rt.getJson() instanceof JSONObject)){
                return "invalid post request";
            }
            return ((JSONObject)(rt.getJson())).getString("status");
        } catch (Exception e) {
            AvnLog.e("error in upload request for "+url+":",e);
            return e.getMessage();
        }

    }

    /**
     * request a file from the system
     * this is some sort of a workaround for the not really working onOpenFileChooser
     * in the onActivityResult (MainActivity) we do different things depending on the
     * "readFile" flag
     * If true we store the selected file and its name in the uploadData structure
     * we limit the size of the file to 1M - this should be ok for our routes, layouts and similar
     * the results will be retrieved via getFileName and getFileData
     * when the file successfully has been fetched, we fire an {@link Constants#JS_UPLOAD_AVAILABLE} event to the JS with the id
     *
     * If false, we only store the Uri and wait for {@link #copyFile}
     * In this case we fire an {@link Constants#JS_FILE_COPY_READY}
     * the id is some minimal security to ensure that somenone later on can only access the file
     * when knowing this id
     * a new call to this API will empty/overwrite any older data being retrieved
     * @param type one of the user data types (route|layout)
     * @param id to identify the file
     * @param readFile if true: read the file (used for small files), otherwise jsut keep the file url for later copy
     */
    @JavascriptInterface
    public boolean requestFile(String type,long id,boolean readFile){
        if (detached) return false;
        AvnUtil.KeyValue<Integer> title= RequestHandler.typeHeadings.get(type);
        if (title == null){
            AvnLog.e("unknown type for request file "+type);
            return false;
        }
        if (uploadData != null) uploadData.interruptCopy(true);
        uploadData=new UploadData(mainActivity, requestHandler.getHandler(type),id,readFile);
        Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
        intent.setType("*/*");
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        Resources res= mainActivity.getResources();
        try {
            mainActivity.startActivityForResult(
                    Intent.createChooser(intent,
                            //TODO: be more flexible for types...
                            res.getText(title.value)),
                    Constants.FILE_OPEN);
        } catch (android.content.ActivityNotFoundException ex) {
            // Potentially direct the user to the Market with a Dialog
            Toast.makeText(mainActivity, res.getText(R.string.installFileManager), Toast.LENGTH_SHORT).show();
            return false;
        }
        return true;
    }

    @JavascriptInterface
    public String getFileName(long id){
        if (uploadData==null || ! uploadData.isReady(id)) return null;
        return uploadData.getName();
    }

    @JavascriptInterface
    public String getFileData(long id){
        if (uploadData==null || ! uploadData.isReady(id)) return null;
        return uploadData.getFileData();
    }

    /**
     * start a file copy operation for a file that previously has been requested by
     * {@link #requestFile(String, long, boolean)}
     * during the transfer we fire an {@link Constants#JS_FILE_COPY_PERCENT} event having the
     * progress in % as id.
     * When done we fire {@link Constants#JS_FILE_COPY_DONE} - with 0 for success, 1 for errors
     * The target is determined by the type that we provided in requestFile
     * @param id the id we used in {@link #requestFile(String, long, boolean)}
     * @param newName if != null use this as the target file name
     * @return true if the copy started successfully
     */
    @JavascriptInterface
    public boolean copyFile(long id,String newName){
        if (detached) return false;
        if (uploadData==null || ! uploadData.isReady(id)) return false;
        return uploadData.copyFile(newName);
    }
    @JavascriptInterface
    public long getFileSize(long id){
        if (uploadData==null || ! uploadData.isReady(id)) return -1;
        return uploadData.getSize();
    }

    @JavascriptInterface
    public boolean interruptCopy(int id){
        if (uploadData==null || ! uploadData.isReady(id)) return false;
        return uploadData.interruptCopy(false);
    }


    @JavascriptInterface
    public String setLeg(String legData){
        if (detached) return null;
        if (requestHandler.getRouteHandler() == null) return returnStatus("not initialized");
        try {
            requestHandler.getRouteHandler().setLeg(legData);
            requestHandler.getGpsService().timerAction();
            return returnStatus("OK");
        } catch (Exception e) {
            AvnLog.i("unable to save leg "+e.getLocalizedMessage());
            return returnStatus(e.getMessage());
        }
    }

    @JavascriptInterface
    public String unsetLeg(){
        if (detached) return null;
        if (requestHandler.getRouteHandler() == null) return returnStatus("not initialized");
        try {
            requestHandler.getRouteHandler().unsetLeg();
            requestHandler.getGpsService().timerAction();
            return returnStatus("OK");
        } catch (Exception e) {
            AvnLog.i("unable to unset leg "+e.getLocalizedMessage());
            return returnStatus(e.getMessage());
        }
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
        requestHandler.getSharedPreferences().edit().putBoolean(Constants.WAITSTART,false).commit();
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
        IWebSocketHandler handler=requestHandler.getWebSocketHandler(url);
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

}
