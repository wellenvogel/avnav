package de.wellenvogel.avnav.main;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;
import de.wellenvogel.avnav.util.AvnLog;

import java.io.IOException;

/**
 * Created by andreas on 04.12.14.
 */
public class WebServerActivity extends WebViewActivityBase {
    private WebView webView;
    private Button btServer;
    private Button btCancel;
    private Button btLaunch;
    private TextView txServer;
    private static final String LOGPRFX="Avnav:webserver";
    private boolean serverRunning=false;
    private WebServer webServer;


    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.server);
        btServer =(Button) findViewById(R.id.btWebServer);
        btCancel=(Button)findViewById(R.id.btBack);
        btLaunch=(Button)findViewById(R.id.btLaunchBrowser);
        txServer=(TextView)findViewById(R.id.txServer);
        btServer.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (serverRunning){
                    stopWebServer();
                }
                else {
                    startWebServer();
                }

            }
        });
        btCancel.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finish();
            }
        });
        btLaunch.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                launchBrowser();
            }
        });
        if (webServer == null) webServer=new WebServer(this);
        startWebServer();

    }


    @Override
    protected void onStart() {
        super.onStart();
        if (serverRunning){
            btServer.setText(R.string.stopServer);
            btLaunch.setEnabled(true);
        }
        else {
            btServer.setText(R.string.startServer);
            btLaunch.setEnabled(false);
        }

    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        stopWebServer();
    }

    private void launchBrowser(){
        if (! serverRunning) return;
        int port=webServer.getPort();
        String start="http://localhost:"+port+"/viewer/avnav_viewer.html?onAndroid=1";
        if (BuildConfig.DEBUG) start+="&log=1";
        AvnLog.d(LOGPRFX,"start browser with "+start);
        try {
            Intent myIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(start));
            startActivity(Intent.createChooser(myIntent, "Chose browser"));

        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "No application can handle this request."
                    + " Please install a webbrowser",  Toast.LENGTH_LONG).show();
            e.printStackTrace();
        }
    }

    private void startWebServer(){
        if (serverRunning) return;
        try {
            webServer.startServer();
        } catch (IOException e) {
            e.printStackTrace();
            txServer.setText("failed to start server: "+e.getLocalizedMessage());
            return;
        }
        serverRunning=true;
        AvnLog.d(LOGPRFX,"starting webserver");
        int port=webServer.getPort();
        txServer.setText("server running at port "+port);
        btLaunch.setEnabled(true);
        btServer.setText(R.string.stopServer);

    }

    private void stopWebServer(){
        if (! serverRunning) return;
        serverRunning=false;
        AvnLog.d(LOGPRFX,"stopping webserver");
        webServer.stopServer();
        txServer.setText("server stopped");
        btLaunch.setEnabled(false);
        btServer.setText(R.string.startServer);

    }

}
