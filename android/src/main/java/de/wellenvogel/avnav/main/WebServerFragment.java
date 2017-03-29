package de.wellenvogel.avnav.main;

import android.app.Fragment;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.support.annotation.Nullable;
import android.view.LayoutInflater;
import android.view.MenuItem;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONException;
import org.json.JSONObject;

import de.wellenvogel.avnav.gps.GpsService;
import de.wellenvogel.avnav.util.AvnLog;

import java.io.IOException;

/**
 * Created by andreas on 04.12.14.
 */
public class WebServerFragment extends Fragment {
    private WebView webView;
    private Button btServer;
    private Button btSettings;
    private Button btLaunch;
    private Button btExit;
    private TextView txServer;
    private ImageView imgNmea;
    private TextView txNmea;
    private ImageView imgAis;
    private TextView txAis;
    private static final String LOGPRFX="Avnav:webserver";
    private boolean serverRunning=false;
    private WebServer webServer;
    private JSONObject lastStatus=null;
    private long timerSequence=0;
    private Handler handler = new Handler();
    private Runnable runnable;



    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Nullable
    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {

        View rt=inflater.inflate(R.layout.server, container,false);
        btServer =(Button) rt.findViewById(R.id.btWebServer);
        btSettings =(Button)rt.findViewById(R.id.btBack);
        btLaunch=(Button)rt.findViewById(R.id.btLaunchBrowser);
        btExit=(Button)rt.findViewById(R.id.btExit);
        txServer=(TextView)rt.findViewById(R.id.txServer);
        imgNmea=(ImageView)rt.findViewById(R.id.imgNmea);
        imgAis=(ImageView)rt.findViewById(R.id.imgAIS);
        txNmea=(TextView)rt.findViewById(R.id.txNmea);
        txAis=(TextView)rt.findViewById(R.id.txAIS);
        btServer.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (serverRunning){
                    stopWebServer();
                }
                else {
                    startWebServer(false);
                }

            }
        });
        btSettings.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                ((MainActivity) getActivity()).showSettings();
            }
        });
        btLaunch.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                launchBrowser();
            }
        });
        btExit.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                exitApp();
            }
        });
        if (webServer == null) webServer=new WebServer((MainActivity)getActivity());
        startWebServer(true);
        timerSequence++;
        runnable=new TimerRunnable(timerSequence);
        handler.postDelayed(runnable,100);
        ((MainActivity)getActivity()).getToolbar().show().setOnMenuItemClickListener(this).setTitle(R.string.webserver);
        setHasOptionsMenu(true);
        return rt;

    }


    @Override
    public void onStart() {
        super.onStart();
        ((MainActivity)getActivity()).sharedPrefs.edit().putBoolean(Constants.WAITSTART,false).commit();
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
    public void onDestroy() {
        super.onDestroy();
        stopWebServer();
        webServer=null;
        timerSequence++;
    }

    @Override
    public void onResume() {
        super.onResume();
        ((MainActivity)getActivity()).getToolbar().show().setOnMenuItemClickListener(this).setTitle(R.string.webserver);
        startWebServer(true);
    }

    private void launchBrowser(){
        if (! serverRunning) return;
        int port=webServer.getPort();
        String start="http://localhost:"+port+"/viewer/avnav_viewer.html?onAndroid=1";
        if (BuildConfig.DEBUG) start+="&log=1";
        AvnLog.d(LOGPRFX, "start browser with " + start);
        try {
            Intent myIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(start));
            startActivity(Intent.createChooser(myIntent, "Chose browser"));

        } catch (ActivityNotFoundException e) {
            Toast.makeText(getActivity(), "No application can handle this request."
                    + " Please install a webbrowser",  Toast.LENGTH_LONG).show();
            e.printStackTrace();
        }
    }

    private void startWebServer(boolean force){
        if (serverRunning && ! force) return;
        try {
            SharedPreferences prefs=((MainActivity)getActivity()).sharedPrefs;
            webServer.startServer(prefs.getString(Constants.WEBSERVERPORT,"34567"),prefs.getBoolean(Constants.EXTERNALACCESS,false));
        } catch (Exception e) {
            e.printStackTrace();
            return;
        }
        serverRunning=true;
        AvnLog.d(LOGPRFX, "starting webserver");
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

    private void setStatusFromJson(ImageView stv,TextView stx,JSONObject status, String prefix) throws JSONException {
        String color=status.getString("status");
        if (color.equals("green")) stv.setImageResource(R.drawable.greenbubble);
        else if (color.equals("yellow")) stv.setImageResource(R.drawable.yellowbubble);
        else stv.setImageResource(R.drawable.redbubble);
        stx.setText(prefix+" "+status.getString("source")+":"+status.getString("info"));
    }

    private void updateStatus(){
        GpsService service=((MainActivity)getActivity()).gpsService;
        if (service == null){
            imgAis.setImageResource(R.drawable.redbubble);
            imgNmea.setImageResource(R.drawable.redbubble);
            txNmea.setText("disabled");
            txAis.setText("disabled");
        }
        else{
            try {
                JSONObject cur=service.getNmeaStatus();
                if (! cur.equals(lastStatus)){
                    JSONObject nmea=cur.getJSONObject("nmea");
                    JSONObject ais=cur.getJSONObject("ais");
                    setStatusFromJson(imgNmea,txNmea,nmea,"NMEA");
                    setStatusFromJson(imgAis,txAis,ais,"AIS");
                    lastStatus=cur;
                }
            } catch (Throwable e) {
                //???
            }
        }
        String statusText="";
        RequestHandler.ServerInfo info=webServer.getServerInfo();
        if (info != null && info.lastError == null){
            statusText="server running at "+info.address;
            if (info.listenAny) statusText+="\nexternal access enabled";
            else statusText+="\nexternal access disabled";
        }
        else{
            if (info != null) statusText="server (port "+info.address.getPort()+") failed to run:\n"+info.lastError;
            else statusText="server stopped";
        }
        txServer.setText(statusText);
    }

    private class TimerRunnable implements Runnable{
        private long sequence=0;
        TimerRunnable(long seq){sequence=seq;}
        public void run(){
            if (timerSequence != sequence) return;
            updateStatus();
            handler.postDelayed(this, 3000);
        }
    };

    private void exitApp(){
        ((MainActivity)getActivity()).goBack();
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        if (item.getItemId() == android.R.id.home){
            ((MainActivity) getActivity()).showSettings();
            return true;
        }
        if (item.getItemId() == R.id.action_about){
            Intent intent = new Intent(getActivity(), Info.class);
            startActivity(intent);
            return true;
        }
        return super.onOptionsItemSelected(item);
    }

}
