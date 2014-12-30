package de.wellenvogel.avnav.main;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.*;
import android.location.Location;
import android.location.LocationManager;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.*;
import android.preference.PreferenceManager;
import android.provider.Settings;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.Log;
import android.view.Menu;
import android.view.MenuInflater;
import android.view.MenuItem;
import android.view.View;
import android.widget.*;
import de.wellenvogel.avnav.gps.GpsDataProvider;
import de.wellenvogel.avnav.gps.GpsService;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.net.InetSocketAddress;

public class AvNav extends Activity implements MediaScannerConnection.MediaScannerConnectionClient, IMediaUpdater{
    //settings
    public static final String WORKDIR="workdir";
    public static final String SHOWDEMO="showdemo";
    public static final String INTERNALGPS="internalGps";
    public static final String IPNMEA="ip.nmea";
    public static final String IPAIS="ip.ais";
    public static final String IPADDR="ip.addr";
    public static final String IPPORT="ip.port";
    public static final String IPCONNTIMEOUT="ip.conntimeout";
    public static final String IPPOSAGE="ip.posAge";
    public static final String IPAISLIFETIME="ip.aisLifetime";
    public static final String IPAISCLEANUPIV="ip.aisCleanupIv";
    public static final String PREFNAME="AvNav";

    public static final String LOGPRFX="avnav";
    private Button btStart;
    private Button btExit;
    private Button btGps;
    private TextView txGps;
    private EditText textWorkdir;
    private EditText txIp;
    private EditText txPort;
    private CheckBox cbShowDemo;
    private CheckBox cbInternalGps;
    private CheckBox cbIpNmea;
    private CheckBox cbIpAis;
    private View externalSettings;
    private ImageView gpsIcon;
    private ImageView extIcon;
    private Context context=this;
    private GpsService gpsService=null;
    private boolean gpsRunning=false;
    private Handler handler = new Handler();
    private MediaUpdateHandler mediaUpdater;
    SharedPreferences sharedPrefs ;
    private MediaScannerConnection mediaConnection;

    /** Defines callbacks for service binding, passed to bindService() */
    private ServiceConnection mConnection = new ServiceConnection() {

        @Override
        public void onServiceConnected(ComponentName className,
                                       IBinder service) {
            // We've bound to LocalService, cast the IBinder and get LocalService instance
            GpsService.GpsServiceBinder binder = (GpsService.GpsServiceBinder) service;
            gpsService = binder.getService();
            gpsService.setMediaUpdater(AvNav.this);
            Log.d(LOGPRFX,"Main: gps service connected");

        }

        @Override
        public void onServiceDisconnected(ComponentName arg0) {
            gpsService=null;
            Log.d(LOGPRFX,"Main: gps service disconnected");
        }
    };

    private class MediaUpdateHandler extends Handler{
        @Override
        public void handleMessage(Message msg) {
            Log.d(LOGPRFX,"Mediaupdater for "+msg);
            super.handleMessage(msg);
            File f=(File)msg.obj;
            updateMtp(f);
        }
    }

    private void startGpsService(){
        if (cbInternalGps.isChecked() ){
            cbIpNmea.setChecked(false);
        }
        saveSettings();
        updateExternal();
        if (! cbInternalGps.isChecked() && ! cbIpNmea.isChecked()){
            Toast.makeText(context, R.string.noGpsSelected, Toast.LENGTH_SHORT).show();
            return;
        }
        if (cbIpAis.isChecked()||cbIpNmea.isChecked()) {
            try {
                InetSocketAddress addr = GpsDataProvider.convertAddress(
                        sharedPrefs.getString(IPADDR, ""),
                        sharedPrefs.getString(IPPORT, ""));
            } catch (Exception i) {
                Toast.makeText(context, R.string.invalidIp, Toast.LENGTH_SHORT).show();
                return;
            }
        }
        if (cbInternalGps.isChecked()) {
            LocationManager locationService = (LocationManager) getSystemService(LOCATION_SERVICE);
            boolean enabled = locationService.isProviderEnabled(LocationManager.GPS_PROVIDER);

            // check if enabled and if not send user to the GSP settings
            // Better solution would be to display a dialog and suggesting to
            // go to the settings
            if (!enabled) {
                AlertDialog.Builder builder = new AlertDialog.Builder(AvNav.this);
                builder.setMessage(R.string.noLocation);
                builder.setPositiveButton(R.string.ok, new DialogInterface.OnClickListener() {
                    public void onClick(DialogInterface dialog, int id) {
                        // User clicked OK button
                        Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
                        startActivity(intent);
                    }
                });
                builder.setNegativeButton(R.string.cancel, new DialogInterface.OnClickListener() {
                    public void onClick(DialogInterface dialog, int id) {
                        // User cancelled the dialog
                    }
                });
                AlertDialog dialog = builder.create();
                dialog.show();

            }
        }
        File trackDir=new File(textWorkdir.getText().toString(),"tracks");
        Intent intent = new Intent(AvNav.this, GpsService.class);
        intent.putExtra(GpsService.PROP_TRACKDIR,trackDir.getAbsolutePath());
        //TODO: add other parameters here
        startService(intent);

    }

    private void stopGpsService(boolean unbind){
        if (gpsService !=null){
            gpsService.stopMe();
        }
        if (unbind) {
            Intent intent = new Intent(context, GpsService.class);
            unbindService(mConnection);
            stopService(intent);
        }
    }

    private Runnable runnable = new Runnable() {
        @Override
        public void run() {
            updateServiceState();
            handler.postDelayed(this, 500);
        }
    };

    private void updateServiceState(){
        if (gpsService == null || ! gpsService.isRunning()){
            gpsIcon.setImageResource(R.drawable.redbubble);
            extIcon.setImageResource(R.drawable.redbubble);
            txGps.setText(R.string.gpsServiceStopped);
            btGps.setText(R.string.startGps);
            gpsRunning=false;
            return;
        }
        gpsRunning=true;
        btGps.setText(R.string.stopGps);
        GpsDataProvider.SatStatus extStatus=gpsService.getExternalStatus();
        if (extStatus.gpsEnabled){
            extIcon.setImageResource(R.drawable.greenbubble);
        }
        else{
            extIcon.setImageResource(R.drawable.yellowbubble);
        }
        JSONObject current;
        //Location current;
        try {
            if ((current = gpsService.getGpsData()) == null) {
                gpsIcon.setImageResource(R.drawable.yellowbubble);
                GpsDataProvider.SatStatus status = gpsService.getSatStatus();
                if (status.gpsEnabled) {
                    if (status.statusText != null) txGps.setText(status.statusText);
                    else txGps.setText(getResources().getString(R.string.gpsServiceSearching) + ", Sat : " + status.numSat + "/" + status.numUsed);
                }
                else{
                    if (status.statusText != null) txGps.setText(status.statusText);
                    else txGps.setText(R.string.gpsDisabled);
                }

                return;
            }

            gpsIcon.setImageResource(R.drawable.greenbubble);
            txGps.setText(GpsDataProvider.formatCoord(current.getDouble(GpsDataProvider.G_LAT), true) +
                    " , " + GpsDataProvider.formatCoord(current.getDouble(GpsDataProvider.G_LON), false));
        } catch (JSONException e) {
            e.printStackTrace();
        }

    }
    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        // Inflate the menu items for use in the action bar
        MenuInflater inflater = getMenuInflater();
        inflater.inflate(R.menu.main_activity_actions, menu);
        return super.onCreateOptionsMenu(menu);
    }
    /**
     * Called when the activity is first created.
     */
    @Override
    public void onCreate(final Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.main);
        btStart =(Button)findViewById(R.id.btStart);
        btExit =(Button)findViewById(R.id.btExit);
        btGps =(Button)findViewById(R.id.btGps);
        txGps=(TextView)findViewById(R.id.txService);
        textWorkdir=(EditText)findViewById(R.id.editText);
        cbShowDemo=(CheckBox)findViewById(R.id.cbShowDemoCharts);
        cbInternalGps=(CheckBox)findViewById(R.id.cbInternalGps);
        cbIpNmea=(CheckBox)findViewById(R.id.cbIpNmea);
        cbIpAis=(CheckBox)findViewById(R.id.cbIpAis);
        externalSettings=findViewById(R.id.lExternalGps);
        gpsIcon=(ImageView)findViewById(R.id.iconGps);
        extIcon=(ImageView)findViewById(R.id.iconIp);
        txIp=(EditText)findViewById(R.id.edIP);
        txPort=(EditText)findViewById(R.id.edPort);
        sharedPrefs= getSharedPreferences(PREFNAME,Context.MODE_PRIVATE);
        if (gpsService == null) {
            Intent intent = new Intent(AvNav.this, GpsService.class);
            intent.putExtra(GpsService.PROP_CHECKONLY, true);
            //TODO: add other parameters here
            startService(intent);
            bindService(intent, mConnection, Context.BIND_AUTO_CREATE);
        }
        boolean internalGps=sharedPrefs.getBoolean(INTERNALGPS,true);
        boolean ipAis=sharedPrefs.getBoolean(IPAIS,false);
        boolean ipNmea=sharedPrefs.getBoolean(IPNMEA,false);
        boolean showDemo=sharedPrefs.getBoolean(SHOWDEMO,true);
        cbShowDemo.setChecked(showDemo);
        cbIpAis.setChecked(ipAis);
        cbIpNmea.setChecked(ipNmea);
        cbInternalGps.setChecked(internalGps);
        updateExternal();
        txIp.setText(sharedPrefs.getString(IPADDR, "192.168.20.10"));
        txPort.setText(sharedPrefs.getString(IPPORT,"34567"));
        cbIpAis.setOnCheckedChangeListener(cbHandler);
        cbInternalGps.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(CompoundButton buttonView, boolean isChecked) {
                if (isChecked) cbIpNmea.setChecked(false);
                cbHandler.onCheckedChanged(buttonView,isChecked);
            }
        });
        cbIpNmea.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(CompoundButton buttonView, boolean isChecked) {
                if (isChecked) cbInternalGps.setChecked(false);
                cbHandler.onCheckedChanged(buttonView,isChecked);
            }
        });
        txIp.addTextChangedListener(textChangeHandler);
        txPort.addTextChangedListener(textChangeHandler);
        handler.postDelayed(runnable, 100);
        btStart.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                try {
                    saveSettings();
                    checkDirs(textWorkdir.getText().toString());
                } catch (Exception e) {
                    Toast.makeText(context, e.getLocalizedMessage(), Toast.LENGTH_SHORT).show();
                    return;
                }


                startGpsService();
                Intent intent = new Intent(context, WebViewActivity.class);
                intent.putExtra(WORKDIR, textWorkdir.getText().toString());
                intent.putExtra(SHOWDEMO, cbShowDemo.isChecked());
                startActivity(intent);
            }
        });
        btExit.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                stopGpsService(true);
                finish();
            }
        });
        btGps.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (gpsRunning) stopGpsService(false);
                else startGpsService();
            }
        });
        String workdir=sharedPrefs.getString(WORKDIR,Environment.getExternalStorageDirectory().getAbsolutePath()+"/avnav");
        textWorkdir.setText(workdir);
        Button btSelectDir=(Button)findViewById(R.id.btSelectDir);
        btSelectDir.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                SimpleFileDialog FolderChooseDialog = new SimpleFileDialog(context, "FolderChoose",
                        new SimpleFileDialog.SimpleFileDialogListener() {
                            @Override
                            public void onChosenDir(String chosenDir) {
                                // The code in this function will be executed when the dialog OK button is pushed
                                textWorkdir.setText(chosenDir);
                                Log.i(AvNav.LOGPRFX,"select work directory "+chosenDir);
                            }
                        });
                FolderChooseDialog.Default_File_Name="avnav";
                FolderChooseDialog.dialogTitle=getString(R.string.selectWorkDir);
                FolderChooseDialog.okButtonText=getString(R.string.ok);
                FolderChooseDialog.cancelButtonText=getString(R.string.cancel);
                FolderChooseDialog.newFolderNameText=getString(R.string.newFolderName);
                FolderChooseDialog.newFolderText=getString(R.string.createFolder);
                FolderChooseDialog.chooseFile_or_Dir(textWorkdir.getText().toString());
            }
        });
        if (mediaConnection != null) mediaConnection.disconnect();
        mediaConnection=new MediaScannerConnection(this,this);
        mediaConnection.connect();
        if (mediaUpdater == null) mediaUpdater=new MediaUpdateHandler();


    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (mediaConnection != null){
            mediaConnection.disconnect();
        }
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        // Handle presses on the action bar items
        switch (item.getItemId()) {
            case R.id.action_about:
                Intent intent = new Intent(context,Info.class);
                startActivity(intent);
                return true;
            default:
                return super.onOptionsItemSelected(item);
        }
    }

    private CompoundButton.OnCheckedChangeListener cbHandler=new CompoundButton.OnCheckedChangeListener() {
        @Override
        public void onCheckedChanged(CompoundButton buttonView, boolean isChecked) {
            AvNav.this.updateExternal();
            AvNav.this.saveSettings();
            AvNav.this.stopGpsService(false);
        }
    };

    private TextWatcher textChangeHandler= new TextWatcher() {
        @Override
        public void beforeTextChanged(CharSequence s, int start, int count, int after) {

        }

        @Override
        public void onTextChanged(CharSequence s, int start, int before, int count) {

        }

        @Override
        public void afterTextChanged(Editable s) {
            AvNav.this.saveSettings();
            AvNav.this.stopGpsService(false);
        }
    };

    private void updateExternal(){
        if (cbIpAis.isChecked() || cbIpNmea.isChecked()){
            externalSettings.setVisibility(View.VISIBLE);
        }
        else{
            externalSettings.setVisibility(View.INVISIBLE);
        }
    }
    private void saveSettings(){
        SharedPreferences.Editor e=sharedPrefs.edit();
        e.putString(WORKDIR,textWorkdir.getText().toString());
        e.putBoolean(SHOWDEMO, cbShowDemo.isChecked());
        e.putBoolean(INTERNALGPS,cbInternalGps.isChecked());
        e.putBoolean(IPAIS,cbIpAis.isChecked());
        e.putBoolean(IPNMEA,cbIpNmea.isChecked());
        e.putString(IPADDR, txIp.getText().toString());
        e.putString(IPPORT,txPort.getText().toString());
        e.apply();
    }

    public void triggerUpdateMtp(File file){
        if (mediaUpdater == null )return;
        Message msg=mediaUpdater.obtainMessage();
        msg.obj=file;
        mediaUpdater.sendMessage(msg);
    }

    private void updateMtp(File file){
        Log.d(LOGPRFX,"MTP update for "+file.getAbsolutePath());
        try {
            //TODO: avoid leaked connection
            mediaConnection.scanFile(file.getAbsolutePath(),null);
            context.sendBroadcast(new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE,
                    Uri.fromFile(file)));
        }catch(Exception e){
            Log.e(LOGPRFX,"error when updating MTP "+e.getLocalizedMessage());
        }
    }

    private void checkDirs(String workdir) throws Exception {
        File workBase=new File(workdir);
        if (! workBase.isDirectory()){
            Log.d(LOGPRFX, "creating workdir " + workdir);
            if (!workBase.mkdirs()) {
                throw new Exception("unable to create working directory "+workdir);
            }
            updateMtp(workBase);
        }
        String subdirs[]=new String[]{"charts","tracks","routes"};
        for (String s: subdirs){
            File sub=new File(workBase,s);
            if (! sub.isDirectory()){
                Log.d(LOGPRFX, "creating subdir " + sub.getAbsolutePath());
                if (! sub.mkdirs()) throw new Exception("unable to create directory "+sub.getAbsolutePath());
                updateMtp(sub);
            }
        }
    }

    @Override
    public void onMediaScannerConnected() {

    }

    @Override
    public void onScanCompleted(String path, Uri uri) {
        Log.d(LOGPRFX,"MTP update for "+path+" finished");
    }
}
