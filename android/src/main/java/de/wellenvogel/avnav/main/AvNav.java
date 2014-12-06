package de.wellenvogel.avnav.main;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.Environment;
import android.preference.PreferenceManager;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.Toast;
import de.wellenvogel.avnav.main.WebViewActivity;

import java.io.File;

public class AvNav extends Activity {
    //settings
    public static final String WORKDIR="workdir";
    public static final String SHOWDEMO="showdemo";

    public static final String LOGPRFX="avnav";
    private Button button;
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
        button=(Button)findViewById(R.id.button);
        textWorkdir=(EditText)findViewById(R.id.editText);
        cbShowDemo=(CheckBox)findViewById(R.id.cbShowDemoCharts);
        button.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                try {
                    saveSettings();
                    checkDirs(textWorkdir.getText().toString());
                } catch (Exception e){
                    Toast.makeText(context,e.getLocalizedMessage(),Toast.LENGTH_SHORT).show();
                    return;
                }
                Intent intent = new Intent(context, WebViewActivity.class);
                intent.putExtra(WORKDIR,textWorkdir.getText().toString());
                intent.putExtra(SHOWDEMO,cbShowDemo.isChecked());
                startActivity(intent);
            }
        });
        sharedPrefs= PreferenceManager.getDefaultSharedPreferences(this);
        String workdir=sharedPrefs.getString(WORKDIR,"avnav");
        textWorkdir.setText(workdir);
        boolean showDemo=sharedPrefs.getBoolean(SHOWDEMO,true);
        cbShowDemo.setChecked(showDemo);

    }
    private void saveSettings(){
        SharedPreferences.Editor e=sharedPrefs.edit();
        e.putString(WORKDIR,textWorkdir.getText().toString());
        e.putBoolean(SHOWDEMO,cbShowDemo.isChecked());
        e.apply();
    }

    private void checkDirs(String workdir) throws Exception {
        File sdcard = Environment.getExternalStorageDirectory();
        File workBase=new File(sdcard,workdir);
        if (! workBase.isDirectory()){
            Log.d(LOGPRFX, "creating workdir " + workdir);
            if (!workBase.mkdirs()) {
                throw new Exception("unable to create working directory "+workdir);
            }
        }
        String subdirs[]=new String[]{"charts","tracks","routes"};
        for (String s: subdirs){
            File sub=new File(workBase,s);
            if (! sub.isDirectory()){
                Log.d(LOGPRFX, "creating subdir " + sub.getAbsolutePath());
                if (! sub.mkdirs()) throw new Exception("unable to create directory "+sub.getAbsolutePath());
            }
        }
    }
}
