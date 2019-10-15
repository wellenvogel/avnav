package de.wellenvogel.avnav.main;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.support.v7.widget.Toolbar;
import android.util.Xml;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;


import org.xmlpull.v1.XmlPullParser;
import org.xmlpull.v1.XmlPullParserException;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;

import de.wellenvogel.avnav.settings.SettingsActivity;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;

import static java.lang.System.in;

/**
 * Created by andreas on 09.01.15.
 * just to go back from the notification
 */
public class RouteReceiver extends Activity {
    private static final int ACTION_EXIT=0;
    private static final int ACTION_MAIN=1;
    private static final int ACTION_IMPORT=2;
    private int nextButtonAction=ACTION_EXIT;
    private TextView receiverInfo;
    private Button button;
    private Uri routeUri;
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.route_receiver);
        receiverInfo=findViewById(R.id.receiverInfo);
        button=findViewById(R.id.btReceiverOk);
        Toolbar toolbar=findViewById(R.id.toolbar);
        toolbar.setNavigationOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finish();
            }
        });
        toolbar.setTitle(R.string.importRouteTitle);
        button.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                buttonAction();
            }
        });
        if (!SettingsActivity.checkSettings(this,false,false)){
            Toast.makeText(this,R.string.receiveMustStart,Toast.LENGTH_LONG).show();
            finish();
            return;
        }
        Intent intent = getIntent();
        String action = intent.getAction();
        if (Intent.ACTION_SEND.equals(action)) routeUri = (Uri) intent.getParcelableExtra(Intent.EXTRA_STREAM);
        if (Intent.ACTION_VIEW.equals(action)) routeUri=intent.getData();
        if (routeUri != null){
            if (! routeUri.getLastPathSegment().endsWith(".gpx")){
                Toast.makeText(this,R.string.receiveOnlyGpx,Toast.LENGTH_LONG).show();
                finish();
                return;
            }
            try {
                InputStream is=getContentResolver().openInputStream(routeUri);
                XmlPullParser parser= Xml.newPullParser();
                parser.setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, false);
                parser.setInput(is, null);
                boolean foundRte=false;
                while (! foundRte && parser.next() != XmlPullParser.END_TAG){
                    if (parser.getEventType() != XmlPullParser.START_TAG) continue;
                    if (parser.getName().equals("rte")){
                        foundRte=true;
                    }
                }
                if (! foundRte){
                    Toast.makeText(this,R.string.receiveNoValidRoute,Toast.LENGTH_LONG).show();
                    finish();
                    return;
                }
            } catch (XmlPullParserException | IOException e) {
                Toast.makeText(this,getString(R.string.receiveUnableToRead)+routeUri.getLastPathSegment(),Toast.LENGTH_LONG).show();
                finish();
                return;
            }
            File outFile=getAndCheckOutfile(routeUri.getLastPathSegment());
            if (outFile == null) return;
            receiverInfo.setText(routeUri.getLastPathSegment());
            nextButtonAction=ACTION_IMPORT;
        }
        else{
            Toast.makeText(this,R.string.receiveUnableToImport,Toast.LENGTH_LONG).show();
            finish();
        }

    }

    private void buttonAction(){
        if (nextButtonAction == ACTION_EXIT){
            finish();
        }
        if (nextButtonAction == ACTION_MAIN){
            startMain();
        }
        if (nextButtonAction == ACTION_IMPORT){
            startImport();
        }
    }

    private File getAndCheckOutfile(String name){
        File outDir=new File(AvnUtil.getWorkDir(null,this),"routes");
        if (! outDir.isDirectory() || ! outDir.canWrite()){
            Toast.makeText(this,R.string.receiveMustStart,Toast.LENGTH_LONG).show();
            finish();
            return null;
        }
        File outFile=new File(outDir,routeUri.getLastPathSegment());
        if (outFile.exists()){
            Toast.makeText(this,R.string.receiveAlreadyExists,Toast.LENGTH_LONG).show();
            finish();
            return null;
        }
        return outFile;
    }

    private void startImport(){
        try {
            File outFile=getAndCheckOutfile(routeUri.getLastPathSegment());
            if (outFile == null) return;
            FileOutputStream os=new FileOutputStream(outFile);
            InputStream is=getContentResolver().openInputStream(routeUri);
            byte buffer[]=new byte[10000];
            int rt=0;
            while ((rt=is.read(buffer)) > 0){
                os.write(buffer,0,rt);
            }
            os.close();
            is.close();
            startMain();
        } catch (Exception e) {
            AvnLog.e("import route failed: ",e);
            Toast.makeText(this,getString(R.string.importFailed),Toast.LENGTH_LONG).show();
            finish();
            return;
        }
    }

    private void startMain(){
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setAction(Intent.ACTION_MAIN);
        notificationIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        startActivity(notificationIntent);
        finish();
    }
}