package de.wellenvogel.avnav.main;

import android.app.Activity;
import android.app.ActivityManager;
import android.app.ProgressDialog;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.ContentResolver;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.ServiceConnection;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.database.Cursor;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Message;
import android.preference.PreferenceManager;

import androidx.activity.result.ActivityResultLauncher;
import androidx.annotation.Nullable;

import android.provider.DocumentsContract;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Method;
import java.net.HttpURLConnection;
import java.net.MalformedURLException;
import java.net.URL;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;

import de.wellenvogel.avnav.appapi.ExtendedWebResourceResponse;
import de.wellenvogel.avnav.appapi.JavaScriptApi;
import de.wellenvogel.avnav.appapi.RequestHandler;
import de.wellenvogel.avnav.appapi.WebServer;
import de.wellenvogel.avnav.main.DownloadHandler.DownloadStream;
import de.wellenvogel.avnav.settings.SettingsActivity;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.util.DialogBuilder;
import de.wellenvogel.avnav.worker.GpsService;
import de.wellenvogel.avnav.worker.UsbConnectionHandler;
import de.wellenvogel.avnav.worker.WorkerFactory;
import de.wellenvogel.avnav.main.DownloadHandler;
import static de.wellenvogel.avnav.main.Constants.LOGPRFX;
import static de.wellenvogel.avnav.settings.SettingsActivity.checkSettings;


/**
 * Created by andreas on 06.01.15.
 */
public class MainActivity extends Activity implements IMediaUpdater, SharedPreferences.OnSharedPreferenceChangeListener, GpsService.MainActivityActions {
    //The last mode we used to select the fragment
    SharedPreferences sharedPrefs;
    protected final Activity activity=this;
    AssetManager assetManager;
    GpsService gpsService=null;

    private boolean exitRequested=false;
    private boolean running=false;
    private BroadcastReceiver reloadReceiver;
    private Handler mediaUpdateHandler=new Handler(){
        @Override
        public void handleMessage(Message msg) {
            AvnLog.d(Constants.LOGPRFX,"Mediaupdater for "+msg);
            super.handleMessage(msg);
            File f=(File)msg.obj;
            updateMtp(f);
        }
    };
    private Handler retryHandler=new Handler();
    private boolean serviceNeedsRestart=false;
    private WebView webView;
    private ProgressDialog pd;
    private JavaScriptApi jsInterface;
    private int goBackSequence=0;
    private boolean checkSettings=true;
    private boolean showsDialog = false;

    View dlProgress=null;
    TextView dlText=null;
    private ValueCallback<Uri[]> upload=null;


    private class DownloadInternal extends DownloadHandler.DownloadStream{
        ExtendedWebResourceResponse response;
        public DownloadInternal(String url, ExtendedWebResourceResponse r) {
            super(url,MainActivity.this);
            response=r;
        }

        @Override
        InputStream openInput() throws IOException {
            return response.getData();
        }

        @Override
        void closeInput() throws IOException {
            response.getData().close();
        }
    }

    private DownloadHandler.Download download=null;
    private static class AttachedDevice{
        String type;
        JSONObject parameters;
        JSONObject toJson() throws JSONException {
            JSONObject rt=new JSONObject();
            rt.put("typeName",type);
            rt.put("initialParameters",parameters);
            return rt;
        }
        AttachedDevice(String type, JSONObject parameters){
            this.type=type;
            this.parameters=parameters;
        }
    }
    private AttachedDevice attachedDevice=null;


    public void updateMtp(File file){
        AvnLog.d(Constants.LOGPRFX, "MTP update for " + file.getAbsolutePath());
        try {
            MediaScannerConnection.scanFile(this, new String[]{file.getAbsolutePath()}, null, null);
            this.sendBroadcast(new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE,
                    Uri.fromFile(file)));
        }catch(Exception e){
            Log.e(Constants.LOGPRFX, "error when updating MTP " + e.getLocalizedMessage());
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        switch (requestCode) {
            case Constants.SETTINGS_REQUEST:
                if (resultCode == RESULT_FIRST_USER){
                    endApp();
                    return;
                }
                if (resultCode != Constants.RESULT_NO_RESTART) {
                    serviceNeedsRestart = true;
                }
                sendEventToJs(Constants.JS_PROPERTY_CHANGE, 0); //this will some pages cause to reload...
                break;
            case Constants.FILE_OPEN:
                if (resultCode != RESULT_OK) {
                    // Exit without doing anything else
                    return;
                } else {
                    Uri returnUri = data.getData();
                    if (jsInterface != null) jsInterface.saveFile(returnUri);
                }
                break;
            case Constants.FILE_OPEN_UPLOAD:
                if (upload == null) return;
                if (resultCode != RESULT_OK) {
                    upload.onReceiveValue(null);
                    upload=null;
                    return;
                } else {
                    Uri returnUri = data.getData();
                    upload.onReceiveValue(new Uri[]{returnUri});
                    upload=null;
                }
                break;
            case Constants.FILE_OPEN_DOWNLOAD:
                if (download == null) return;
                if (resultCode != RESULT_OK) {
                    download=null;
                    return;
                } else {
                    Uri returnUri = data.getData();
                    try {
                        OutputStream os=getContentResolver().openOutputStream(returnUri);
                        download.start(os,returnUri);
                    } catch (FileNotFoundException e) {
                        Toast.makeText(this,"unable to open "+returnUri,Toast.LENGTH_SHORT).show();
                        download=null;
                    }
                }
                break;
            default:
                AvnLog.e("unknown activity result " + requestCode);
        }
    }

    private GpsService.GpsServiceBinder binder;
    private Runnable bindAction;

    /** Defines callbacks for service binding, passed to bindService() */
    private ServiceConnection mConnection = new ServiceConnection() {

        @Override
        public void onServiceConnected(ComponentName className,
                                       IBinder service) {
            // We've bound to LocalService, cast the IBinder and get LocalService instance
            binder = (GpsService.GpsServiceBinder) service;
            gpsService = binder.getService();
            if (gpsService !=null) {
                gpsService.setMediaUpdater(MainActivity.this);
                if (bindAction != null){
                    bindAction.run();
                    bindAction=null;
                }
            }
            binder.registerCallback(MainActivity.this);
            AvnLog.d(Constants.LOGPRFX, "gps service connected");

        }

        @Override
        public void onServiceDisconnected(ComponentName arg0) {
            gpsService=null;
            if (binder != null) binder.deregisterCallback();
            binder=null;
            AvnLog.d(Constants.LOGPRFX,"gps service disconnected");
        }

    };
    private boolean startGpsService(){
        if (Build.VERSION.SDK_INT >= 26) {
            ActivityManager activityManager = (ActivityManager) this.getSystemService(Context.ACTIVITY_SERVICE);
            List<ActivityManager.RunningAppProcessInfo> runningAppProcesses = activityManager.getRunningAppProcesses();
            if (runningAppProcesses != null) {
                int importance = runningAppProcesses.get(0).importance;
                // higher importance has lower number (?)
                if (importance > ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND){
                    AvnLog.e("still in background while trying to start service");
                    retryHandler.postDelayed(new Runnable() {
                        @Override
                        public void run() {
                            startGpsService();
                        }
                    },1000);
                    return false;
                }
            }
        }

        Intent intent = new Intent(this, GpsService.class);
        if (Build.VERSION.SDK_INT >= 26){
            startForegroundService(intent);
        }
        else {
            startService(intent);
        }
        serviceNeedsRestart=false;
        return true;
    }


    private void stopGpsService(){
        AvnLog.i(LOGPRFX,"stop gps service");
        GpsService service=gpsService;
        if (service !=null){
            binder.deregisterCallback();
            gpsService=null;
            service.stopMe();
        }
        Intent intent = new Intent(this, GpsService.class);
        try {
             unbindService(mConnection);
             stopService(intent);
        }catch (Exception e){}

    }



    /**
     * end IDialogHandler
     */


    public void showSettings(boolean initial){
        Intent sintent= new Intent(this,SettingsActivity.class);
        sintent.putExtra(Constants.EXTRA_INITIAL,initial);
        startActivityForResult(sintent,Constants.SETTINGS_REQUEST);
    }
    public void showPermissionRequest(int title, String[] permissionRequests){
        Intent sintent= new Intent(this,SettingsActivity.class);
        sintent.putExtra(Constants.EXTRA_PERMSSIONTITLE,title);
        if (permissionRequests != null && permissionRequests.length != 0){
            sintent.putExtra(Constants.EXTRA_PERMSSIONS,permissionRequests);
        }
        startActivityForResult(sintent,Constants.SETTINGS_REQUEST);
    }

    @Override
    public void mainGoBack() {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                goBack();
            }
        });
    }

    @Override
    public void mainShutdown() {
        if (!exitRequested){
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try{
                        finishActivity(Constants.SETTINGS_REQUEST);
                    }catch(Throwable t){}
                    MainActivity.this.finish();
                }
            });
        }
    }

    //to be called e.g. from js
    public void goBack(){
        try {
            DialogBuilder builder=new DialogBuilder(this,R.layout.dialog_confirm);
            builder.createDialog();
            builder.setText(R.id.title,0);
            builder.setText(R.id.question,R.string.endApplication);
            builder.setButton(R.string.ok,DialogInterface.BUTTON_POSITIVE);
            builder.setButton(R.string.background,DialogInterface.BUTTON_NEUTRAL);
            builder.setButton(R.string.cancel,DialogInterface.BUTTON_NEGATIVE);
            builder.setOnClickListener(new DialogInterface.OnClickListener() {
                @Override
                public void onClick(DialogInterface dialog, int which) {
                    dialog.dismiss();
                    if (which == DialogInterface.BUTTON_POSITIVE){
                        endApp();
                    }
                    if (which == DialogInterface.BUTTON_NEUTRAL){
                        finish();
                    }
                }
            });
            builder.show();
        } catch(Throwable i){
            //sometime a second call (e.g. when the JS code was too slow) will throw an exception
            Log.e(AvnLog.LOGPREFIX,"exception in goBack:"+i.getLocalizedMessage());
        }
    }

    private void endApp(){
        exitRequested=true;
        finish();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        running=false;
        showsDialog=false;
        if (pd != null){
            try{
                pd.dismiss();
            }catch (Throwable t){}
        }
        if (jsInterface != null) jsInterface.onDetach();
        if (webView != null) webView.destroy();
        if (reloadReceiver != null){
            unregisterReceiver(reloadReceiver);
        }
        try {
            unbindService(mConnection);
        }catch (Exception e){}
        if (exitRequested) {
            stopGpsService();
            //System.exit(0);
        }
        else{
            AvnLog.e("main stopped");
        }
        gpsService=null;
    }

    private void initializeWebView(){
        if (webView != null) return;
        sharedPrefs.edit().putBoolean(Constants.WAITSTART,true).commit();
        jsInterface=new JavaScriptApi(this,getRequestHandler());
        webView=(WebView)findViewById(R.id.webmain);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setAllowFileAccess(true);
        if (Build.VERSION.SDK_INT >= 16){
            try {
                WebSettings settings = webView.getSettings();
                Method m = WebSettings.class.getDeclaredMethod("setAllowUniversalAccessFromFileURLs", boolean.class);
                m.setAccessible(true);
                m.invoke(settings, true);
            }catch (Exception e){}
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT && BuildConfig.DEBUG) {
            try {
                Method m=WebView.class.getDeclaredMethod("setWebContentsDebuggingEnabled",boolean.class);
                m.setAccessible(true);
                m.invoke(webView,true);
                m=WebSettings.class.getDeclaredMethod("setMediaPlaybackRequiresUserGesture",boolean.class);
                m.setAccessible(true);
                m.invoke(webView.getSettings(),false);
            } catch (Exception e) {
            }
        }
        String htmlPage = null;
        RequestHandler handler=getRequestHandler();
        if (handler != null) htmlPage=handler.getStartPage();
        webView.setWebViewClient(new WebViewClient() {
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                Toast.makeText(MainActivity.this, "Oh no! " + description, Toast.LENGTH_SHORT).show();
            }

            @Nullable
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    if (request.getMethod().equalsIgnoreCase("head")){
                        WebResourceResponse rt=handleRequest(view,request.getUrl().toString(),request.getMethod());
                        if (rt != null) return rt;
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }

            private WebResourceResponse handleRequest(WebView view, String url, String method){
                RequestHandler handler= getRequestHandler();
                WebResourceResponse rt=null;
                if (handler != null) {
                    try {
                        rt = handler.handleRequest(view,url,method);
                    }catch (Throwable t){
                        AvnLog.e("web request for "+url+" failed",t);
                        InputStream is=new ByteArrayInputStream(new byte[]{});
                        if (Build.VERSION.SDK_INT >= 21){
                            return new WebResourceResponse("application/octet-stream", "UTF-8",500,"error "+t.getMessage(),new HashMap<String, String>(),is);
                        }
                        else {
                            return new WebResourceResponse("application/octet-stream", "UTF-8", is);
                        }
                    }
                }
                return rt;
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                WebResourceResponse rt=handleRequest(view,url,"GET");
                if (rt==null) return super.shouldInterceptRequest(view, url);
                return rt;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (pd.isShowing()) pd.dismiss();

            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url != null && (url.startsWith("http://")||url.startsWith("https://") )) {
                    if (url.startsWith(RequestHandler.INTERNAL_URL_PREFIX)){
                        return false;
                    }
                    view.getContext().startActivity(
                            new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    return true;
                } else {
                    return false;
                }
            }



        });
        webView.setWebChromeClient(new WebChromeClient() {
            public void onConsoleMessage(String message, int lineNumber, String sourceID) {
                AvnLog.d("AvNav", message + " -- From line "
                        + lineNumber + " of "
                        + sourceID);
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (upload != null){
                    return false;
                }
                upload=filePathCallback;
                Intent i = null;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    i=fileChooserParams.createIntent();
                }
                else {
                    i = new Intent(Intent.ACTION_GET_CONTENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("*/*");
                }
                MainActivity.this.startActivityForResult(
                        Intent.createChooser(i, getString(R.string.file_upload)),
                        Constants.FILE_OPEN_UPLOAD);
                return true;
            }
        });
        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long l) {
                Log.i(LOGPRFX, "download request for "+url);
                if (download != null && download.isRunning()) return;
                try{
                    DownloadHandler.Download nextDownload=null;
                    if (url.startsWith(RequestHandler.INTERNAL_URL_PREFIX)){
                        if (handler == null){
                            throw new Exception("no handler");
                        }
                        ExtendedWebResourceResponse r=handler.handleRequest(null,url,"get");
                        //TODO: separate dl handler
                        if (r == null){
                            throw new Exception("cannot handle "+url);
                        }
                        nextDownload=new DownloadInternal(url,r);
                        String cd=r.getHeaders().get("Content-Disposition");
                        if (cd != null && ! cd.isEmpty()) {
                            nextDownload.fileName=DownloadHandler.guessFileName(cd);
                        }
                    }
                    else {
                        nextDownload=DownloadHandler.createHandler(MainActivity.this,url,userAgent,contentDisposition,mimeType,l);
                    }
                    nextDownload.progress=MainActivity.this.dlProgress;
                    nextDownload.dlText=MainActivity.this.dlText;
                    download=nextDownload;
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType(mimeType);
                    if (nextDownload.fileName != null) {
                        intent.putExtra(Intent.EXTRA_TITLE, nextDownload.fileName);
                    }
                    startActivityForResult(intent,Constants.FILE_OPEN_DOWNLOAD);
                }catch (Throwable t){
                    Toast.makeText(MainActivity.this,"download error:"+t,Toast.LENGTH_LONG).show();
                }


            }
        });
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setDatabaseEnabled(true);
        webView.getSettings().setTextZoom(100);
        String databasePath = webView.getContext().getDir("databases",
                Context.MODE_PRIVATE).getPath();
        webView.getSettings().setDatabasePath(databasePath);
        webView.addJavascriptInterface(jsInterface,"avnavAndroid");
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);



        //we nedd to add a filename to the base to make local storage working...
        //http://stackoverflow.com/questions/8390985/android-4-0-1-breaks-webview-html-5-local-storage
        String start= RequestHandler.INTERNAL_URL_PREFIX +RequestHandler.ROOT_PATH+"/avnav_viewer.html?navurl=avnav_navi.php";
        if (BuildConfig.DEBUG) start+="&logNmea=1";
        if (htmlPage != null) {
            webView.loadDataWithBaseURL(start, htmlPage, "text/html", "UTF-8", null);
        }
    }
    public synchronized String getAttachedDevice(){
        AttachedDevice device=attachedDevice;
        attachedDevice=null;
        if (device == null) return null;
        try {
            return device.toJson().toString();
        } catch (JSONException e) {
        }
        return null;
    }

    private void handleUsbDeviceAttach(Intent intent){
        String usbDevice=intent.getStringExtra(Constants.USB_DEVICE_EXTRA);
        if (usbDevice != null){
            try {
                attachedDevice=new AttachedDevice(WorkerFactory.USB_NAME,
                        UsbConnectionHandler.getInitialParameters(usbDevice));
            } catch (JSONException e) {
                AvnLog.e("unable to get parameters for usb device",e);
            }
            sendEventToJs(Constants.JS_DEVICE_ADDED,1);
        }
    }
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleUsbDeviceAttach(intent);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (running) return;
        showsDialog=false;
        setContentView(R.layout.main);
        dlProgress=findViewById(R.id.dlIndicator);
        dlProgress.setOnClickListener(view -> {
            if (download != null) download.stop();
        });
        dlText=findViewById(R.id.dlInfo);
        sharedPrefs=getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        PreferenceManager.setDefaultValues(this,Constants.PREFNAME,Context.MODE_PRIVATE, R.xml.sound_preferences, false);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        assetManager=getAssets();
        sharedPrefs.registerOnSharedPreferenceChangeListener(this);
        reloadReceiver =new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                sendEventToJs(Constants.JS_RELOAD,1);
            }
        };
        IntentFilter triggerFilter=new IntentFilter((Constants.BC_RELOAD_DATA));
        registerReceiver(reloadReceiver,triggerFilter);
        running=true;
        Intent intent = new Intent(this, GpsService.class);
        bindService(intent,mConnection,0);
        handleUsbDeviceAttach(getIntent());
    }

    @Override
    public void onSharedPreferenceChanged(SharedPreferences sharedPreferences, String key) {
        Log.d(Constants.LOGPRFX, "preferences changed");
        if (key.equals(Constants.WORKDIR)){
            updateWorkDir(AvnUtil.getWorkDir(sharedPreferences,this));
            serviceNeedsRestart=true;
        }
        if (key.equals(Constants.CHARTDIR)){
            updateWorkDir(sharedPreferences.getString(Constants.CHARTDIR,""));
            serviceNeedsRestart=true;
        }
    }

    private void updateWorkDir(String dirname){
        if (dirname == null || dirname.isEmpty()) return;
        updateWorkDir(new File(dirname));
    }

    private void updateWorkDir(File workDir){
        final File baseDir=workDir;
        if (baseDir == null) return;
        if (! baseDir.isDirectory()) return;
        Thread initialUpdater=new Thread(new Runnable() {
            @Override
            public void run() {
                if (!baseDir.isDirectory()) return;
                for (File uf: baseDir.listFiles()){
                    if (uf.isFile() && uf.exists()) triggerUpdateMtp(uf);
                    if (uf.isDirectory()) {
                        for (File df : uf.listFiles()) {
                            if (df.exists() && df.isFile()) triggerUpdateMtp(df);
                        }
                    }
                }
            }
        });
        initialUpdater.start();
    }
    /**
     * check the current settings
     */
    private void handleInitialSettings(){
        final SharedPreferences sharedPrefs = getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        final SharedPreferences.Editor e=sharedPrefs.edit();
        if (! sharedPrefs.contains(Constants.ALARMSOUNDS)){
            e.putBoolean(Constants.ALARMSOUNDS,true);
        }
        if (! sharedPrefs.contains(Constants.SHOWDEMO)){
            e.putBoolean(Constants.SHOWDEMO,true);
        }
        String workdir=sharedPrefs.getString(Constants.WORKDIR, "");
        String chartdir=sharedPrefs.getString(Constants.CHARTDIR, "");
        if (workdir.isEmpty()){
            workdir=Constants.INTERNAL_WORKDIR;
        }
        e.putString(Constants.WORKDIR, workdir);
        e.putString(Constants.CHARTDIR, chartdir);
        e.apply();
        try {
            int version = getPackageManager()
                    .getPackageInfo(getPackageName(), 0).versionCode;
            if (sharedPrefs.getInt(Constants.VERSION,-1)!= version){
                e.putInt(Constants.VERSION,version);
            }
        } catch (Exception ex) {
        }
        e.commit();
    }

    private boolean checkSettingsInternal(){
        if (checkSettings && !checkSettings(this,true)) {
            checkSettings=false;
            showSettings(true);
            return false;
        }
        checkSettings=false;
        return true;
    }
    private boolean checkForInitialDialogs(){
        if (showsDialog) return true;
        SharedPreferences sharedPrefs = getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        int oldVersion=sharedPrefs.getInt(Constants.VERSION, -1);
        boolean startPendig=sharedPrefs.getBoolean(Constants.WAITSTART, false);
        int version=0;
        try {
            version = getPackageManager()
                    .getPackageInfo(getPackageName(), 0).versionCode;
        } catch (PackageManager.NameNotFoundException e) {
        }
        if (oldVersion < 0 || startPendig) {
            showsDialog =true;
            int title;
            int message;
            if (startPendig) {
                title=R.string.somethingWrong;
                message=R.string.somethingWrongMessage;
            } else {
                handleInitialSettings();
                title=R.string.firstStart;
                message=R.string.firstStartMessage;
            }
            sharedPrefs.edit().putInt(Constants.VERSION,version).commit();
            DialogBuilder.alertDialog(this,title,message, new DialogInterface.OnClickListener(){
                @Override
                public void onClick(DialogInterface dialog, int which) {
                    showsDialog=false;
                    checkSettings=false; //settings are checked in the settings activity
                    showSettings(false);
                }
            });
            if (startPendig)sharedPrefs.edit().putBoolean(Constants.WAITSTART,false).commit();
        }
        if (showsDialog) return true;
        if (version != 0 ){
            try {
                int lastVersion = sharedPrefs.getInt(Constants.VERSION, 0);
                //TODO: handle other version changes
                if (lastVersion <20210406 ){
                    final int newVersion=version;
                    showsDialog =true;
                    DialogBuilder builder=new DialogBuilder(this,R.layout.dialog_confirm);
                    builder.setTitle(R.string.newVersionTitle);
                    builder.setText(R.id.question,R.string.newVersionMessage);
                    builder.setPositiveButton(android.R.string.ok, new DialogInterface.OnClickListener() {
                        @Override
                        public void onClick(DialogInterface dialog, int which) {
                            sharedPrefs.edit().putInt(Constants.VERSION,newVersion).commit();
                            showsDialog=false;
                            if (!checkSettingsInternal()) return;
                            onResumeInternal();
                        }
                    });
                    builder.setNegativeButton(android.R.string.cancel, new DialogInterface.OnClickListener() {
                        @Override
                        public void onClick(DialogInterface dialog, int which) {
                            showsDialog=false;
                            endApp();
                        }
                    });
                    builder.show();
                }
            }catch (Exception e){}
        }
        return showsDialog || !checkSettingsInternal();
    }

    @Override
    protected void onPause() {
        super.onPause();
        AvnLog.d("main: pause");
    }

    private void onResumeInternal(){
        if (webView == null){
            shoLoading();
        }
        updateWorkDir(AvnUtil.getWorkDir(null, this));
        updateWorkDir(sharedPrefs.getString(Constants.CHARTDIR, ""));
        if (gpsService == null) {
            bindAction = new Runnable() {
                @Override
                public void run() {
                    initializeWebView();
                }
            };
            startGpsService();
            return;
        }
        if (gpsService != null) {
            if (serviceNeedsRestart) {
                gpsService.restart();
                serviceNeedsRestart = false;
                AvnLog.d(Constants.LOGPRFX, "MainActivity:onResume serviceRestart");
            }
            else{
                gpsService.onResumeInternal();
            }
        }
        if (webView == null) {
            initializeWebView();
        }
    }

    private void shoLoading() {
        if (pd != null){
            try{
                pd.dismiss();
            }catch(Throwable t){}
        }
        pd = ProgressDialog.show(this, "", getString(R.string.loading), true);
    }
    private void handleBars(){
        SharedPreferences sharedPrefs=getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        boolean hideStatus=sharedPrefs.getBoolean(Constants.HIDE_BARS,false);
        if (hideStatus ) {
            View decorView = getWindow().getDecorView();
            int flags=View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
            flags+=View.SYSTEM_UI_FLAG_FULLSCREEN;
            flags+=View.SYSTEM_UI_FLAG_HIDE_NAVIGATION;
            decorView.setSystemUiVisibility(flags);
        }
    }
    @Override
    protected void onResume() {
        super.onResume();
        handleBars();
        AvnLog.d("main: onResume");
        if (! checkForInitialDialogs()){
            onResumeInternal();
        }
    }

    @Override
    public void onBackPressed(){
        final int num=goBackSequence+1;
        sendEventToJs(Constants.JS_BACK,num);
        //as we cannot be sure that the JS code will for sure handle
        //our back pressed (maybe a different page has been loaded) , we wait at most 200ms for it to ack this
        //otherwise we really go back here
        Thread waiter=new Thread(new Runnable() {
            @Override
            public void run() {
                long wait=200;
                while (wait>0) {
                    long current = System.currentTimeMillis();
                    if (goBackSequence == num) break;
                    try {
                        Thread.sleep(10);
                    } catch (InterruptedException e) {
                    }
                    wait-=10;
                }
                if (wait == 0) {
                    Log.e(AvnLog.LOGPREFIX,"go back handler did not fire");
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            goBack();
                        }
                    });
                }
            }
        });
        waiter.start();
    }
    public void jsGoBackAccepted(int id){
        goBackSequence=id;
    }
    public void setBrightness(int percent){
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                float newBrightness;
                if (percent >= 100){
                    newBrightness= WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE;
                }
                else {
                    newBrightness = (float) percent / 100;
                    if (newBrightness < 0.01f) newBrightness = 0.01f;
                    if (newBrightness > 1) newBrightness = 1;
                }
                Window w=getWindow();
                WindowManager.LayoutParams lp=w.getAttributes();
                lp.screenBrightness=newBrightness;
                w.setAttributes(lp);
            }
        });
    }

    /**
     * @param key
     * @param id
     */
    public void sendEventToJs(String key, long id){
        AvnLog.i("js event key="+key+", id="+id);
        if (webView != null) {
            webView.loadUrl("javascript:if (avnav && avnav.android) avnav.android.receiveEvent('" + key + "'," + id + ")");
        }
    }


    public RequestHandler getRequestHandler(){
        GpsService service=getGpsService();
        return service!=null?service.getRequestHandler():null;
    }
    public void launchBrowser() {
        try {
            GpsService service = getGpsService();
            WebServer webServer = service.getWebServer();
            if (webServer == null) return;
            if (!webServer.isRunning()) return;
            int port = webServer.getPort();
            if (port == 0) return;
            String start = "http://"+AvnUtil.getLocalHost().getHostAddress()+":" + port + "/viewer/avnav_viewer.html";
            if (BuildConfig.DEBUG) start += "?log=1";
            AvnLog.d(LOGPRFX, "start browser with " + start);
            try {
                Intent myIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(start));
                startActivity(Intent.createChooser(myIntent, "Chose browser"));

            } catch (ActivityNotFoundException e) {
                Toast.makeText(this, "No application can handle this request."
                        + " Please install a webbrowser", Toast.LENGTH_LONG).show();
                e.printStackTrace();
            }

        } catch (Throwable t) {
        }
    }

    @Override
    public void triggerUpdateMtp(File file) {
        if (mediaUpdateHandler == null )return;
        Message msg=mediaUpdateHandler.obtainMessage();
        msg.obj=file;
        Log.d(Constants.LOGPRFX,"mtp update for "+file);
        mediaUpdateHandler.sendMessage(msg);
    }
    public GpsService getGpsService() {
        return gpsService;
    }

    public void dialogClosed() {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                handleBars();
            }
        });
    }


}
