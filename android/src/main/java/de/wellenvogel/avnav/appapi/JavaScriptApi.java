package de.wellenvogel.avnav.appapi;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Resources;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import org.json.JSONException;
import org.json.JSONObject;

import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.UploadData;

//potentially the Javascript interface code is called from the Xwalk app package
//so we have to be careful to always access the correct resource manager when accessing resources!
//to make this visible we pass a resource manager to functions called from here that open dialogs
class JavaScriptApi {
    private RequestHandler requestHandler;

    public JavaScriptApi(RequestHandler requestHandler) {
        this.requestHandler = requestHandler;
    }

    private String returnStatus(String status){
        JSONObject o=new JSONObject();
        try {
            o.put("status", status);
        }catch (JSONException i){}
        return o.toString();
    }

    @JavascriptInterface
    public boolean downloadFile(String name,String type){
        return requestHandler.sendFile(name,type);
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
        try {
            JSONObject rt= requestHandler.handleUploadRequest(Uri.parse(url),new PostVars(data));
            return rt.getString("status");
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
    public boolean requestFile(String type,int id,boolean readFile){
        return requestHandler.startUpload(type,id,readFile);
    }

    @JavascriptInterface
    public String getFileName(int id){
        if (requestHandler.uploadData==null || ! requestHandler.uploadData.isReady(id)) return null;
        return requestHandler.uploadData.getName();
    }

    @JavascriptInterface
    public String getFileData(int id){
        if (requestHandler.uploadData==null || ! requestHandler.uploadData.isReady(id)) return null;
        return requestHandler.uploadData.getFileData();
    }

    /**
     * start a file copy operation for a file that previously has been requested by
     * {@link #requestFile(String, int, boolean)}
     * during the transfer we fire an {@link Constants#JS_FILE_COPY_PERCENT} event having the
     * progress in % as id.
     * When done we fire {@link Constants#JS_FILE_COPY_DONE} - with 0 for success, 1 for errors
     * The target is determined by the type that we provided in requestFile
     * @param id the id we used in {@link #requestFile(String, int, boolean)}
     * @return true if the copy started successfully
     */
    @JavascriptInterface
    public boolean copyFile(int id){
        if (requestHandler.uploadData==null || ! requestHandler.uploadData.isReady(id)) return false;
        return requestHandler.uploadData.copyFile();
    }
    @JavascriptInterface
    public long getFileSize(int id){
        if (requestHandler.uploadData==null || ! requestHandler.uploadData.isReady(id)) return -1;
        return requestHandler.uploadData.getSize();
    }

    @JavascriptInterface
    public boolean interruptCopy(int id){
        if (requestHandler.uploadData==null || ! requestHandler.uploadData.isReady(id)) return false;
        return requestHandler.uploadData.interruptCopy(false);
    }


    @JavascriptInterface
    public String setLeg(String legData){
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
    public void goBack(){
        requestHandler.activity.backHandler.sendEmptyMessage(1);
    }

    @JavascriptInterface
    public void acceptEvent(String key,int num){
        if (key != null && key.equals("backPressed")) requestHandler.activity.jsGoBackAccepted(num);
    }

    @JavascriptInterface
    public void showSettings(){
        requestHandler.activity.showSettings(false);
    }

    @JavascriptInterface
    public void applicationStarted(){
        requestHandler.getSharedPreferences().edit().putBoolean(Constants.WAITSTART,false).commit();
    }
    @JavascriptInterface
    public void externalLink(String url){
        Intent goDownload = new Intent(Intent.ACTION_VIEW);
        goDownload.setData(Uri.parse(url));
        try {
            requestHandler.activity.startActivity(goDownload);
        } catch (Exception e) {
            Toast.makeText(requestHandler.activity, e.getLocalizedMessage(), Toast.LENGTH_LONG).show();
            return;
        }
    }
    @JavascriptInterface
    public String getVersion(){
        try {
            String versionName = requestHandler.activity.getPackageManager()
                    .getPackageInfo(requestHandler.activity.getPackageName(), 0).versionName;
            return versionName;
        } catch (PackageManager.NameNotFoundException e) {
            return "<unknown>";
        }
    }


}
