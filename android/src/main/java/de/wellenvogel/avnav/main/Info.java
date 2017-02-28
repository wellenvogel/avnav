package de.wellenvogel.avnav.main;

import android.app.Activity;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.os.Bundle;
import android.text.Html;
import android.text.method.LinkMovementMethod;
import android.util.Log;
import android.view.Menu;
import android.view.MenuInflater;
import android.view.MenuItem;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;

import java.io.InputStream;

import de.wellenvogel.avnav.settings.SettingsActivity;
import de.wellenvogel.avnav.util.ActionBarHandler;

/**
 * Created by andreas on 30.12.14.
 */
public class Info extends Activity {
    private XwalkDownloadHandler downloadHandler=new XwalkDownloadHandler(this);
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.info);
        TextView version=(TextView)findViewById(R.id.txVersion);
        try {
            String versionName = getPackageManager()
                    .getPackageInfo(getPackageName(), 0).versionName;
            version.setText(versionName);
        } catch (PackageManager.NameNotFoundException e) {
            Log.e(Constants.LOGPRFX,"unable to access version name");
        }
        setText("version.txt",R.id.txVersion);
        setText("viewer/info.html",R.id.txInfo);
        setText("viewer/license.html",R.id.txLicense);
        TextView xwalk=(TextView)findViewById(R.id.txXwalk);
        boolean xw= SettingsActivity.isXwalRuntimeInstalled(this);
        xwalk.setText("XWALK V "+ Constants.XWALKVERSION+" \n("+(xw?"installed":"not installed")+")");
        Button xwalxDl=(Button)findViewById(R.id.btDownloadXwalk);
        if (xw) xwalxDl.setVisibility(View.INVISIBLE);
        else xwalxDl.setVisibility(View.VISIBLE);
        xwalxDl.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                downloadHandler.showDownloadDialog(getString(R.string.xwalkNotFoundTitle),
                        getString(R.string.xwalkNotFoundText)+ Constants.XWALKVERSION,false);
            }
        });
        TextView view=(TextView)findViewById(R.id.txInfo);
        view.setMovementMethod(LinkMovementMethod.getInstance());
        ActionBarHandler toolbar=new ActionBarHandler(this,R.menu.info_activity_actions);
        toolbar.show().setOnMenuItemClickListener(this);
    }

    private void setText(String fname,int id ){
        AssetManager assetManager=getAssets();
        try {
            InputStream input = assetManager.open(fname);
            int BUFSIZE=10000;
            byte[] buffer = new byte[BUFSIZE];
            int av;
            StringBuilder builder=new StringBuilder();
            while ((av=input.read(buffer)) > 0){
                builder.append(new String(buffer,0,av));
            }
            input.close();
            TextView txtContent=(TextView)findViewById(id);
            if (txtContent != null) txtContent.setText(Html.fromHtml(builder.toString()));
        } catch (Exception e){
            Log.e(Constants.LOGPRFX,"exception setting text "+e.getLocalizedMessage());
        }
    }
    @Override
    public boolean onCreateOptionsMenu(Menu menu) {

        // Inflate the menu items for use in the action bar
        MenuInflater inflater = getMenuInflater();
        inflater.inflate(R.menu.info_activity_actions, menu);
        return super.onCreateOptionsMenu(menu);

    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        if (item.getItemId() == android.R.id.home) {
            finish();
            return true;
        }
        if (item.getItemId() == R.id.action_ok){
            finish();
            return true;
        }
        return false;
    }
}