package de.wellenvogel.avnav.main;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.preference.PreferenceManager;
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
    private EditText textWorkdir;
    private CheckBox cbShowDemo;
    private Context context=this;
    SharedPreferences sharedPrefs ;
    /**
     * Called when the activity is first created.
     */
    @Override
    public void onCreate(final Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.main);
        btStart =(Button)findViewById(R.id.btStart);
        btExit =(Button)findViewById(R.id.btExit);
        textWorkdir=(EditText)findViewById(R.id.editText);
        cbShowDemo=(CheckBox)findViewById(R.id.cbShowDemoCharts);
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
                Intent intent = new Intent(context, WebViewActivity.class);
                intent.putExtra(WORKDIR, textWorkdir.getText().toString());
                intent.putExtra(SHOWDEMO, cbShowDemo.isChecked());
                startActivity(intent);
            }
        });
        btExit.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent intent=new Intent(context,GpsService.class);
                stopService(intent);
                finish();
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
