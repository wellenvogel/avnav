package de.wellenvogel.avnav.main;

import android.app.Activity;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.os.Bundle;
import android.text.Html;
import android.text.method.LinkMovementMethod;
import android.util.Log;
import android.widget.TextView;

import java.io.IOException;
import java.io.InputStream;

/**
 * Created by andreas on 30.12.14.
 */
public class Info extends Activity {
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
            Log.e(AvNav.LOGPRFX,"unable to access version name");
        }
        setText("version.txt",R.id.txVersion);
        setText("info.html",R.id.txInfo);
        TextView view=(TextView)findViewById(R.id.txInfo);
        view.setMovementMethod(LinkMovementMethod.getInstance());
    }

    private void setText(String fname,int id ){
        AssetManager assetManager=getAssets();
        try {
            InputStream input = assetManager.open(fname);
            int size = input.available();
            byte[] buffer = new byte[size];
            input.read(buffer);
            input.close();
            String text = new String(buffer);
            TextView txtContent=(TextView)findViewById(id);
            if (txtContent != null) txtContent.setText(Html.fromHtml(text));
        } catch (Exception e){
            Log.e(AvNav.LOGPRFX,"exception setting text "+e.getLocalizedMessage());
        }
    }
}