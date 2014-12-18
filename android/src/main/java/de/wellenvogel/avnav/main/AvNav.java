package de.wellenvogel.avnav.main;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.*;
import android.location.Location;
import android.location.LocationManager;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.IBinder;
import android.preference.PreferenceManager;
import android.provider.Settings;
import android.util.Log;
import android.view.MotionEvent;
import android.view.View;
import android.widget.*;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;

public class AvNav extends Activity {
    //settings
    public static final String WORKDIR="workdir";
    public static final String SHOWDEMO="showdemo";

    public static final String LOGPRFX="avnav";
    private Button btStart;
    private Button btExit;
    private Button btGps;
    private TextView txGps;
    private EditText textWorkdir;
    private CheckBox cbShowDemo;
    private ImageView gpsIcon;
    private Context context=this;
    private GpsService gpsService=null;
    private boolean gpsRunning=false;
    private Handler handler = new Handler();
    SharedPreferences sharedPrefs ;

    /** Defines callbacks for service binding, passed to bindService() */
    private ServiceConnection mConnection = new ServiceConnection() {

        @Override
        public void onServiceConnected(ComponentName className,
                                       IBinder service) {
            // We've bound to LocalService, cast the IBinder and get LocalService instance
            GpsService.GpsServiceBinder binder = (GpsService.GpsServiceBinder) service;
            gpsService = binder.getService();
            Log.d(LOGPRFX,"Main: gps service connected");

        }

        @Override
        public void onServiceDisconnected(ComponentName arg0) {
            gpsService=null;
            Log.d(LOGPRFX,"Main: gps service disconnected");
        }
    };

    private void startGpsService(){
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
            txGps.setText(R.string.gpsServiceStopped);
            btGps.setText(R.string.startGps);
            gpsRunning=false;
            return;
        }
        gpsRunning=true;
        btGps.setText(R.string.stopGps);
        Location current;
        if ((current=gpsService.getCurrentLocation()) == null){
            gpsIcon.setImageResource(R.drawable.yellowbubble);
            GpsService.SatStatus status=gpsService.getSatStatus();
            txGps.setText(getResources().getString(R.string.gpsServiceSearching)+", Sat : "+status.numSat+"/"+status.numUsed);
            return;
        }
        gpsIcon.setImageResource(R.drawable.greenbubble);
        txGps.setText(GpsService.formatCoord(current.getLatitude(),true)+" , "+GpsService.formatCoord(current.getLongitude(),false)+
                "  ("+current.getAccuracy()+"m)");
        return;
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
        gpsIcon=(ImageView)findViewById(R.id.iconGps);
        if (gpsService == null) {
            Intent intent = new Intent(AvNav.this, GpsService.class);
            intent.putExtra(GpsService.PROP_CHECKONLY, true);
            //TODO: add other parameters here
            startService(intent);
            bindService(intent, mConnection, Context.BIND_AUTO_CREATE);
        }

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
        sharedPrefs= PreferenceManager.getDefaultSharedPreferences(this);
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

        boolean showDemo=sharedPrefs.getBoolean(SHOWDEMO,true);
        cbShowDemo.setChecked(showDemo);

    }
    private void saveSettings(){
        SharedPreferences.Editor e=sharedPrefs.edit();
        e.putString(WORKDIR,textWorkdir.getText().toString());
        e.putBoolean(SHOWDEMO,cbShowDemo.isChecked());
        e.apply();
    }

    public void updateMtp(File file){
        try {

            MediaScannerConnection.scanFile(
                    context,
                    new String[]{file.getAbsolutePath()},
                    null,
                    null);
            this.sendBroadcast(new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE,
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
}
