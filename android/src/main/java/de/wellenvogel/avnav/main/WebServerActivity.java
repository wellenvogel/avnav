package de.wellenvogel.avnav.main;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;
import de.wellenvogel.avnav.util.AvnLog;

import java.io.IOException;
import java.io.InputStream;

/**
 * Created by andreas on 04.12.14.
 */
public class WebServerActivity extends WebViewActivityBase {
    private WebView webView;
    private Button stopServer;
    private TextView txServer;
    private static final String LOGPRFX="Avnav:webserver";
    private boolean serverRunning=false;
    private WebServer webServer;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.server);
        stopServer=(Button) findViewById(R.id.btStopServer);
        txServer=(TextView)findViewById(R.id.txServer);
        stopServer.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                stopWebServer();
                finish();
            }
        });
        webServer=new WebServer(this);
        startWebServer();

    }

    @Override
    protected void onStart() {
        super.onStart();
        startWebServer();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        stopWebServer();
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
        String start="http://localhost:"+port+"/viewer/avnav_viewer.html";
        AvnLog.d(LOGPRFX,"start browser with "+start);
        try {
            Intent myIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(start));
            startActivity(Intent.createChooser(myIntent, "Chose browser"));
            //startActivity(myIntent);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "No application can handle this request."
                    + " Please install a webbrowser",  Toast.LENGTH_LONG).show();
            e.printStackTrace();
        }
    }

    private void stopWebServer(){
        if (! serverRunning) return;
        serverRunning=false;
        AvnLog.d(LOGPRFX,"stopping webserver");
        webServer.stopServer();
        txServer.setText("server stopped");
    }

}
