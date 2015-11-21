package de.wellenvogel.avnav.main;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ComponentName;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.SharedPreferences;
import android.location.LocationManager;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Message;
import android.provider.Settings;
import android.util.Log;
import android.view.Menu;
import android.view.MenuInflater;
import android.view.MenuItem;
import android.widget.Toast;

import java.io.File;
import java.net.InetSocketAddress;

import de.wellenvogel.avnav.gps.BluetoothPositionHandler;
import de.wellenvogel.avnav.gps.GpsDataProvider;
import de.wellenvogel.avnav.gps.GpsService;
import de.wellenvogel.avnav.settings.SettingsActivity;
import de.wellenvogel.avnav.util.AvnLog;

public class AvNav extends Activity implements MediaScannerConnection.MediaScannerConnectionClient, IMediaUpdater{



    private Context context=this;
    private GpsService gpsService=null;
    private MediaUpdateHandler mediaUpdater;
    SharedPreferences sharedPrefs ;
    private MediaScannerConnection mediaConnection;
    private boolean firstCheck=true;

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


        if (! sharedPrefs.getBoolean(Constants.BTNMEA,false) &&
                ! sharedPrefs.getBoolean(Constants.IPNMEA,false) &&
                ! sharedPrefs.getBoolean(Constants.INTERNALGPS,false)){
            Toast.makeText(context, R.string.noGpsSelected, Toast.LENGTH_SHORT).show();
            return;
        }
        if (sharedPrefs.getBoolean(Constants.IPAIS,false)||sharedPrefs.getBoolean(Constants.IPNMEA, false)) {
            try {
                InetSocketAddress addr = GpsDataProvider.convertAddress(
                        sharedPrefs.getString(Constants.IPADDR, ""),
                        sharedPrefs.getString(Constants.IPPORT, ""));
            } catch (Exception i) {
                Toast.makeText(context, R.string.invalidIp, Toast.LENGTH_SHORT).show();
                return;
            }
        }
        if (sharedPrefs.getBoolean(Constants.BTAIS,false)||sharedPrefs.getBoolean(Constants.BTNMEA,false)){
            String btdevice=sharedPrefs.getString(Constants.BTDEVICE,"");
            if (BluetoothPositionHandler.getDeviceForName(btdevice) == null){
                Toast.makeText(context, getText(R.string.noSuchBluetoothDevice)+":"+btdevice, Toast.LENGTH_SHORT).show();
                return;
            }
        }
        if (sharedPrefs.getBoolean(Constants.INTERNALGPS,false)) {
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
        File trackDir=new File(sharedPrefs.getString(Constants.WORKDIR,""),"tracks");
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





    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        // Inflate the menu items for use in the action bar
        MenuInflater inflater = getMenuInflater();
        inflater.inflate(R.menu.main_activity_actions, menu);
        return super.onCreateOptionsMenu(menu);
    }




    private void doStart(){
        stopGpsService(false);
        startGpsService();
        Intent intent;
        String mode=sharedPrefs.getString(Constants.RUNMODE,Constants.MODE_NORMAL);
        if (mode.equals(Constants.MODE_SERVER)){
            intent = new Intent(context, WebServerActivity.class);
        }
        else if (mode.equals(Constants.MODE_XWALK)) {
            intent = new Intent(context, XwalkFragment.class);
        }
        else {
            intent = new Intent(context, MainActivity.class);
        }
        startActivity(intent);
    }
    /**
     * Called when the activity is first created.
     */
    @Override
    public void onCreate(final Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        SettingsActivity.handleInitialSettings(this);
        sharedPrefs= getSharedPreferences(Constants.PREFNAME,Context.MODE_PRIVATE);

        if (gpsService == null) {
            Intent intent = new Intent(AvNav.this, GpsService.class);
            intent.putExtra(GpsService.PROP_CHECKONLY, true);
            startService(intent);
            bindService(intent, mConnection, Context.BIND_AUTO_CREATE);
        }
        if (mediaConnection != null) mediaConnection.disconnect();
        mediaConnection=new MediaScannerConnection(this,this);
        mediaConnection.connect();
        if (mediaUpdater == null) mediaUpdater=new MediaUpdateHandler();
    }

    @Override
    protected void onDestroy() {
        stopGpsService(true);
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
            case R.id.action_settings:
                Intent sintent= new Intent(context,SettingsActivity.class);
                startActivity(sintent);
            default:
                return super.onOptionsItemSelected(item);
        }
    }

    @Override
    protected void onStart() {
        super.onStart();
    }

    @Override
    protected void onResume() {
        super.onResume();
        doStart();
    }

    @Override
    protected void onStop() {
        super.onStop();
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
