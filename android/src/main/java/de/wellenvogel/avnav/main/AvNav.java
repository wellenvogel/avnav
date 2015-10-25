package de.wellenvogel.avnav.main;

import android.app.Activity;
import android.app.AlertDialog;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.content.*;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.Log;
import android.view.*;
import android.widget.*;
import de.wellenvogel.avnav.gps.BluetoothPositionHandler;
import de.wellenvogel.avnav.gps.GpsDataProvider;
import de.wellenvogel.avnav.gps.GpsService;
import de.wellenvogel.avnav.settings.SettingsActivity;
import de.wellenvogel.avnav.util.AvnLog;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.net.InetSocketAddress;
import java.util.ArrayList;
import java.util.Set;

public class AvNav extends Activity implements MediaScannerConnection.MediaScannerConnectionClient, IMediaUpdater{


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
    private CheckBox cbBtNmea;
    private CheckBox cbBtAis;
    private RadioButton rbServer;
    private RadioButton rbCrosswalk;
    private RadioButton rbNormal;
    private TextView edBt;
    private View externalSettings;
    private View bluetoothSettings;
    private ImageView gpsIcon;
    private ImageView extIcon;
    private ImageView btIcon;
    private Context context=this;
    private GpsService gpsService=null;
    private boolean gpsRunning=false;
    private Handler handler = new Handler();
    private MediaUpdateHandler mediaUpdater;
    SharedPreferences sharedPrefs ;
    private MediaScannerConnection mediaConnection;
    private long timerSequence=1;
    private int currentapiVersion = android.os.Build.VERSION.SDK_INT;
    private boolean firstStart=true;
    private boolean firstCheck=true;
    private BluetoothAdapter mBluetoothAdapter;
    private boolean disableChangeActions=false;

    private XwalkDownloadHandler downloadHandler=new XwalkDownloadHandler(this);

    /** Defines callbacks for service binding, passed to bindService() */
    private ServiceConnection mConnection = new ServiceConnection() {

        @Override
        public void onServiceConnected(ComponentName className,
                                       IBinder service) {
            // We've bound to LocalService, cast the IBinder and get LocalService instance
            GpsService.GpsServiceBinder binder = (GpsService.GpsServiceBinder) service;
            gpsService = binder.getService();
            gpsService.setMediaUpdater(AvNav.this);
            AvnLog.d(Constants.LOGPRFX, "Main: gps service connected");

        }

        @Override
        public void onServiceDisconnected(ComponentName arg0) {
            gpsService=null;
            AvnLog.d(Constants.LOGPRFX,"Main: gps service disconnected");
        }
    };

    private class MediaUpdateHandler extends Handler{
        @Override
        public void handleMessage(Message msg) {
            AvnLog.d(Constants.LOGPRFX,"Mediaupdater for "+msg);
            super.handleMessage(msg);
            File f=(File)msg.obj;
            updateMtp(f);
        }
    }

    private void startGpsService(){
        if (cbInternalGps.isChecked() ){
            cbIpNmea.setChecked(false);
            cbBtNmea.setChecked(false);
        }
        saveSettings();
        updateExternal();
        if (! cbInternalGps.isChecked() && ! cbIpNmea.isChecked() && ! cbBtNmea.isChecked()){
            Toast.makeText(context, R.string.noGpsSelected, Toast.LENGTH_SHORT).show();
            return;
        }
        if (cbIpAis.isChecked()||cbIpNmea.isChecked()) {
            try {
                InetSocketAddress addr = GpsDataProvider.convertAddress(
                        sharedPrefs.getString(Constants.IPADDR, ""),
                        sharedPrefs.getString(Constants.IPPORT, ""));
            } catch (Exception i) {
                Toast.makeText(context, R.string.invalidIp, Toast.LENGTH_SHORT).show();
                return;
            }
        }
        if (cbBtAis.isChecked()||cbBtNmea.isChecked()){
            if (BluetoothPositionHandler.getDeviceForName(edBt.getText().toString()) == null){
                Toast.makeText(context, getText(R.string.noSuchBluetoothDevice)+":"+edBt.getText().toString(), Toast.LENGTH_SHORT).show();
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
            try {
                unbindService(mConnection);
                stopService(intent);
            }catch (Exception e){}
        }
    }

    public static boolean isAppInstalled(Context ctx,String packageName, String version) {
        PackageManager pm = ctx.getPackageManager();
        boolean installed = false;
        try {
            PackageInfo pi=pm.getPackageInfo(packageName, PackageManager.GET_ACTIVITIES);
            if (pi.versionName.equals(version)) installed = true;
        } catch (PackageManager.NameNotFoundException e) {
            installed = false;
        }
        return installed;
    }
    public static boolean isXwalRuntimeInstalled(Context ctx){
        return isAppInstalled(ctx, Constants.XWALKAPP, Constants.XWALKVERSION);
    }

    private class TimerRunnable implements Runnable{
        long seq=1;
        TimerRunnable(long seq){
            this.seq=seq;
        }
        @Override
        public void run() {
            if (seq != timerSequence) return;
            updateServiceState();
            handler.postDelayed(this, 500);
        }
    };


    private void updateServiceState(){
        if (gpsService == null || ! gpsService.isRunning()){
            gpsIcon.setImageResource(R.drawable.redbubble);
            extIcon.setImageResource(R.drawable.redbubble);
            btIcon.setImageResource(R.drawable.redbubble);
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
        extStatus=gpsService.getBluetoothStatus();
        if (extStatus.gpsEnabled){
            btIcon.setImageResource(R.drawable.greenbubble);
        }
        else{
            btIcon.setImageResource(R.drawable.yellowbubble);
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

    private void startTimer(){
        timerSequence++;
        handler.postDelayed(new TimerRunnable(timerSequence),500);
    }

    private boolean updateCheckBox(CheckBox box,String pref,boolean defaultV){
        boolean old=box.isChecked();
        boolean newV=sharedPrefs.getBoolean(pref,defaultV);
        box.setChecked(newV);
        return old != newV;
    }
    private boolean updateCheckBox(CheckBox box,boolean newV){
        boolean old=box.isChecked();
        box.setChecked(newV);
        return old != newV;
    }
    private boolean updateText(EditText etxt,String newV){
        String old=etxt.getText().toString();
        if (! old.equals(newV)){
            etxt.setText(newV);
            return true;
        }
        return false;
    }


    private void updateValues(){
        disableChangeActions=true;
        boolean isChanged=false;
        boolean btAis=sharedPrefs.getBoolean(Constants.BTAIS,false);
        boolean btNmea=sharedPrefs.getBoolean(Constants.BTNMEA,false);
        if (updateCheckBox(cbShowDemo, Constants.SHOWDEMO,true)) isChanged=true;
        if (updateCheckBox(cbIpAis, Constants.IPAIS,false)) isChanged=true;
        if (updateCheckBox(cbIpNmea, Constants.IPNMEA,false)) isChanged=true;
        if (updateCheckBox(cbInternalGps, Constants.INTERNALGPS,true)) isChanged=true;
        if (updateCheckBox(cbBtAis,btAis && mBluetoothAdapter!= null && mBluetoothAdapter.isEnabled())) isChanged=true;
        if (updateCheckBox(cbBtNmea,btNmea && mBluetoothAdapter!= null && mBluetoothAdapter.isEnabled())) isChanged=true;
        if (updateText(txIp,sharedPrefs.getString(Constants.IPADDR, "192.168.20.10"))) isChanged=true;
        if (updateText(txPort,sharedPrefs.getString(Constants.IPPORT,"34567"))) isChanged=true;
        String workdir=sharedPrefs.getString(Constants.WORKDIR,Environment.getExternalStorageDirectory().getAbsolutePath()+"/avnav");
        if (updateText(textWorkdir,workdir))isChanged=true;
        updateExternal();
        if (isChanged){
            stopGpsService(false);
        }
        disableChangeActions=false;
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
        cbBtAis=(CheckBox)findViewById(R.id.cbBtAis);
        cbBtNmea=(CheckBox)findViewById(R.id.cbBtNmea);
        rbServer =(RadioButton)findViewById(R.id.rbRunExternal);
        rbCrosswalk=(RadioButton)findViewById(R.id.rbModeXwalk);
        rbNormal=(RadioButton)findViewById(R.id.rbRunNormal);
        externalSettings=findViewById(R.id.frmIp);
        bluetoothSettings=findViewById(R.id.frmBt);
        gpsIcon=(ImageView)findViewById(R.id.iconGps);
        extIcon=(ImageView)findViewById(R.id.iconIp);
        btIcon=(ImageView)findViewById(R.id.iconBt);
        txIp=(EditText)findViewById(R.id.edIP);
        txPort=(EditText)findViewById(R.id.edPort);
        edBt=(TextView)findViewById(R.id.edBt);
        sharedPrefs= getSharedPreferences(Constants.PREFNAME,Context.MODE_PRIVATE);
        edBt.setText(sharedPrefs.getString(Constants.BTDEVICE,""));
        View bt=findViewById(R.id.frmExtBt);
        mBluetoothAdapter=BluetoothAdapter.getDefaultAdapter();
        if (mBluetoothAdapter == null) bt.setVisibility(View.INVISIBLE);
        else bt.setVisibility(View.VISIBLE);
        String mode=sharedPrefs.getString(Constants.RUNMODE,"");
        if (mode.equals("")) {
            //never set before
            if (currentapiVersion < 19 && firstStart) {
                if (! isXwalRuntimeInstalled(this)){
                    downloadHandler.showDownloadDialog(getString(R.string.xwalkNotFoundTitle),
                            getString(R.string.xwalkNotFoundText)+ Constants.XWALKVERSION,false);
                }
                else {
                    rbCrosswalk.setChecked(true);
                }
            }
        }
        else {
            if (mode.equals(Constants.MODE_XWALK)){
                if (! isXwalRuntimeInstalled(this) ){
                    if (firstStart && currentapiVersion < 19) {
                        downloadHandler.showDownloadDialog(getString(R.string.xwalkNotFoundTitle),
                                getString(R.string.xwalkNotFoundText) + Constants.XWALKVERSION, false);
                    }
                    else {
                        mode= Constants.MODE_NORMAL;
                    }
                }
            }
            setButtonsFromMode(mode);
        }
        if (gpsService == null) {
            Intent intent = new Intent(AvNav.this, GpsService.class);
            intent.putExtra(GpsService.PROP_CHECKONLY, true);
            startService(intent);
            bindService(intent, mConnection, Context.BIND_AUTO_CREATE);
        }
        updateValues();
        cbIpAis.setOnCheckedChangeListener(cbHandler);
        cbBtAis.setOnCheckedChangeListener(cbHandler);
        cbInternalGps.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(CompoundButton buttonView, boolean isChecked) {
                if (isChecked) {
                    cbIpNmea.setChecked(false);
                    cbBtNmea.setChecked(false);
                }
                cbHandler.onCheckedChanged(buttonView,isChecked);
            }
        });
        cbIpNmea.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(CompoundButton buttonView, boolean isChecked) {
                if (isChecked) {
                    cbInternalGps.setChecked(false);
                    cbBtNmea.setChecked(false);
                }
                cbHandler.onCheckedChanged(buttonView,isChecked);
            }
        });
        cbBtNmea.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(CompoundButton buttonView, boolean isChecked) {
                if (isChecked){
                    cbInternalGps.setChecked(false);
                    cbIpNmea.setChecked(false);
                }
                cbHandler.onCheckedChanged(buttonView,isChecked);
            }
        });
        txIp.addTextChangedListener(textChangeHandler);
        txPort.addTextChangedListener(textChangeHandler);
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
                Intent intent;
                if (rbServer.isChecked()){
                    intent = new Intent(context, WebServerActivity.class);
                }
                else if (rbCrosswalk.isChecked()) {
                    intent = new Intent(context, XwalkActivity.class);
                }
                else {
                    intent = new Intent(context, WebViewActivity.class);
                }
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

        Button btSelectDir=(Button)findViewById(R.id.btSelectDir);
        btSelectDir.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                SimpleFileDialog FolderChooseDialog = new SimpleFileDialog(context, SimpleFileDialog.FolderChooseWrite,
                        new SimpleFileDialog.SimpleFileDialogListener() {
                            @Override
                            public void onChosenDir(String chosenDir) {
                                // The code in this function will be executed when the dialog OK button is pushed
                                textWorkdir.setText(chosenDir);
                                AvnLog.i(Constants.LOGPRFX,"select work directory "+chosenDir);
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
        edBt.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                stopGpsService(false);
                if (mBluetoothAdapter != null && !mBluetoothAdapter.isEnabled()) {
                    Intent enableBtIntent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
                    startActivityForResult(enableBtIntent, 1);
                    return;
                }
                AlertDialog.Builder builder = new AlertDialog.Builder(AvNav.this);
                builder.setTitle(R.string.selectBlueTooth);
                final ArrayList<String> items=getBlueToothDevices();
                ArrayAdapter<String>adapter=new ArrayAdapter<String>(AvNav.this,android.R.layout.simple_list_item_1,items);
                builder.setAdapter(adapter, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        String name=items.get(which);
                        edBt.setText(name);
                    }
                });
                builder.setNegativeButton(R.string.cancel, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        dialog.cancel();
                    }
                });
                edBt.setText("");
                builder.create().show();
            }
        });
        if (mediaConnection != null) mediaConnection.disconnect();
        mediaConnection=new MediaScannerConnection(this,this);
        mediaConnection.connect();
        if (mediaUpdater == null) mediaUpdater=new MediaUpdateHandler();
        firstStart=false;
        saveSettings();
    }

    @Override
    protected void onDestroy() {
        stopGpsService(true);
        super.onDestroy();
        if (mediaConnection != null){
            mediaConnection.disconnect();
        }
        timerSequence++;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        // Handle presses on the action bar items
        switch (item.getItemId()) {
            case R.id.action_about:
                Intent intent = new Intent(context,Info.class);
                startActivity(intent);
                return true;
            case R.id.action_settings:
                saveSettings();
                Intent sintent= new Intent(context,SettingsActivity.class);
                startActivity(sintent);
            default:
                return super.onOptionsItemSelected(item);
        }
    }

    @Override
    protected void onStart() {
        super.onStart();
        updateValues();
        startTimer();
        //if we have crosswalk available
        //show the selection for it
        //make this the default before KitKat
        if (isXwalRuntimeInstalled(this)){
            rbCrosswalk.setVisibility(View.VISIBLE);
        }
        else {
            rbCrosswalk.setVisibility(View.INVISIBLE);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        updateValues();
    }

    @Override
    protected void onStop() {
        super.onStop();
        timerSequence++; //stops timer
    }

    private ArrayList<String> getBlueToothDevices(){
        ArrayList<String> rt=new ArrayList<String>();
        if (mBluetoothAdapter == null) return rt;
        if (! mBluetoothAdapter.isEnabled()) return rt;
        Set<BluetoothDevice> pairedDevices = mBluetoothAdapter.getBondedDevices();
        for (BluetoothDevice d: pairedDevices){
            AvnLog.d("found bluetooth device "+d.getName()+",class="+d.getBluetoothClass().toString());
            rt.add(d.getName());
        }
        return rt;
    }

    private CompoundButton.OnCheckedChangeListener cbHandler=new CompoundButton.OnCheckedChangeListener() {
        @Override
        public void onCheckedChanged(CompoundButton buttonView, boolean isChecked) {
            if (AvNav.this.disableChangeActions) return;
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
            if (AvNav.this.disableChangeActions) return;
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
        if (cbBtAis.isChecked() ||cbBtNmea.isChecked()){
            bluetoothSettings.setVisibility(View.VISIBLE);
        }
        else {
            bluetoothSettings.setVisibility(View.INVISIBLE);
        }
    }

    private String getModeFromButtons(){
        if (rbCrosswalk.isChecked()) return Constants.MODE_XWALK;
        if (rbServer.isChecked()) return Constants.MODE_SERVER;
        return Constants.MODE_NORMAL;
    }
    private void setButtonsFromMode(String mode){
        if (mode.equals(Constants.MODE_XWALK) && isXwalRuntimeInstalled(this)) {
            rbCrosswalk.setChecked(true);
            return;
        }
        else rbCrosswalk.setChecked(false);
        if (mode.equals(Constants.MODE_SERVER)){
            rbServer.setChecked(true);
            return;
        }
        else rbServer.setChecked(false);
        rbNormal.setChecked(true);
    }
    private void saveSettings(){
        SharedPreferences.Editor e=sharedPrefs.edit();
        e.putString(Constants.WORKDIR,textWorkdir.getText().toString());
        e.putBoolean(Constants.SHOWDEMO, cbShowDemo.isChecked());
        e.putBoolean(Constants.INTERNALGPS,cbInternalGps.isChecked());
        e.putBoolean(Constants.IPAIS,cbIpAis.isChecked());
        e.putBoolean(Constants.IPNMEA,cbIpNmea.isChecked());
        e.putBoolean(Constants.BTAIS,cbBtAis.isChecked());
        e.putBoolean(Constants.BTNMEA,cbBtNmea.isChecked());
        e.putString(Constants.BTDEVICE,edBt.getText().toString());
        e.putString(Constants.IPADDR, txIp.getText().toString());
        e.putString(Constants.IPPORT,txPort.getText().toString());
        e.putString(Constants.RUNMODE,getModeFromButtons());
        e.apply();
    }

    public void triggerUpdateMtp(File file){
        if (mediaUpdater == null )return;
        Message msg=mediaUpdater.obtainMessage();
        msg.obj=file;
        mediaUpdater.sendMessage(msg);
    }

    private void updateMtp(File file){
        AvnLog.d(Constants.LOGPRFX,"MTP update for "+file.getAbsolutePath());
        try {
            //TODO: avoid leaked connection
            mediaConnection.scanFile(file.getAbsolutePath(),null);
            context.sendBroadcast(new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE,
                    Uri.fromFile(file)));
        }catch(Exception e){
            Log.e(Constants.LOGPRFX,"error when updating MTP "+e.getLocalizedMessage());
        }
    }

    private void checkDirs(String workdir) throws Exception {
        final File workBase=new File(workdir);
        if (! workBase.isDirectory()){
            AvnLog.d(Constants.LOGPRFX, "creating workdir " + workdir);
            if (!workBase.mkdirs()) {
                throw new Exception("unable to create working directory "+workdir);
            }

        }
        final String subdirs[]=new String[]{"charts","tracks","routes"};
        for (String s: subdirs){
            File sub=new File(workBase,s);
            if (! sub.isDirectory()){
                AvnLog.d(Constants.LOGPRFX, "creating subdir " + sub.getAbsolutePath());
                if (! sub.mkdirs()) throw new Exception("unable to create directory "+sub.getAbsolutePath());
            }

        }
        if (firstCheck) {
            firstCheck = false;
            //do an MTP update for all files at least once when we start
            new Thread(new Runnable() {
                @Override
                public void run() {
                    for (String s : subdirs) {
                        boolean hasFiles = false;
                        File sub = new File(workBase, s);
                        for (File f : sub.listFiles()) {
                            if (!f.isFile()) continue;
                            hasFiles = true;
                            AvnLog.d("MTP update for "+f.getAbsolutePath());
                            triggerUpdateMtp(f);
                        }
                        if (!hasFiles) {
                            File dummy = new File(sub, Constants.EMPTY_FILE);
                            try {
                                dummy.createNewFile();
                                updateMtp(dummy);
                            } catch (Exception i) {
                                Log.e(AvnLog.LOGPREFIX, "error when updating MTP: " + i.getLocalizedMessage());
                            }
                        }
                    }
                }
            }).run();
        }
    }

    @Override
    public void onMediaScannerConnected() {

    }

    @Override
    public void onScanCompleted(String path, Uri uri) {
        AvnLog.d(Constants.LOGPRFX,"MTP update for "+path+" finished");
    }
}
