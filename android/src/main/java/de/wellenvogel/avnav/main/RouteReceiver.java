package de.wellenvogel.avnav.main;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Paint;
import android.net.Uri;
import android.os.AsyncTask;
import android.os.Bundle;
import android.support.v4.provider.DocumentFile;
import android.support.v7.widget.Toolbar;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.Button;
import android.widget.ListView;
import android.widget.TextView;
import android.widget.Toast;


import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

import de.wellenvogel.avnav.worker.RouteHandler;
import de.wellenvogel.avnav.settings.SettingsActivity;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;

/**
 * Created by andreas on 09.01.15.
 * just to go back from the notification
 */
public class RouteReceiver extends Activity {
    class ListItem{
        public boolean ok;
        public Uri routeUri;
        public File outFile;
        public String error;
        public String outName;
        private void setOutName(){
            DocumentFile df=DocumentFile.fromSingleUri(RouteReceiver.this,routeUri);
            if (df != null) outName=df.getName();
            else outName=routeUri.getLastPathSegment();
        }
        ListItem(Uri u){
            routeUri=u;
            ok=true;
            setOutName();
        }
        ListItem(Uri u,String error){
            routeUri=u;
            setOutName();
            ok=false;
            this.error=error;
        }
        public String toString(){
            return outName;
        }
        public void setError(String error){
            ok=false;
            this.error=error;
        }
    }
    class MyAdapter extends BaseAdapter {

        private Context context;
        private List<ListItem> items;

        public MyAdapter(Context context, List<ListItem> items) {
            this.context = context;
            this.items = items;
        }

        @Override
        public int getCount() {
            return items.size();
        }

        @Override
        public Object getItem(int position) {
            return items.get(position);
        }

        @Override
        public long getItemId(int position) {
            return 0;
        }

        @Override
        public View getView(int position, View convertView, ViewGroup parent) {

            View twoLineListItem;

            if (convertView == null) {
                LayoutInflater inflater = (LayoutInflater) context
                        .getSystemService(Context.LAYOUT_INFLATER_SERVICE);
                twoLineListItem =  inflater.inflate(
                        android.R.layout.simple_list_item_2, null);
            } else {
                twoLineListItem = convertView;
            }

            TextView text1 = twoLineListItem.findViewById(android.R.id.text1);
            TextView text2 = twoLineListItem.findViewById(android.R.id.text2);

            text1.setText(items.get(position).toString());
            if (items.get(position).ok) {
                text2.setText("");
                text1.setPaintFlags((text1).getPaintFlags()& ~Paint.STRIKE_THRU_TEXT_FLAG);
            }
            else{
                text2.setText(items.get(position).error);
                text1.setPaintFlags((text1).getPaintFlags()| Paint.STRIKE_THRU_TEXT_FLAG);
            }

            return twoLineListItem;
        }
    }

    private static final int ACTION_EXIT=0;
    private static final int ACTION_IMPORT=1;
    private int nextButtonAction=ACTION_EXIT;
    private List<ListItem> names;
    private MyAdapter adapter;

    class CheckFilesTask extends AsyncTask<Void,Void,Void>{
        private List<Uri> uris;
        private List<ListItem> output;
        CheckFilesTask(List<Uri> uris,List<ListItem> output){
            super();
            this.uris=uris;
            this.output=output;
        }
        @Override
        protected Void doInBackground(Void... voids) {
            for (Uri uri: uris){
                checkRouteFile(uri,output);
            }
            return null;
        }

        @Override
        protected void onPostExecute(Void v) {
            super.onPostExecute(v);
            findViewById(R.id.receiveProgressBar).setVisibility(View.GONE);
            findViewById(R.id.receiverInfo).setVisibility(View.VISIBLE);
            if (names.size() < 1) {
                Toast.makeText(RouteReceiver.this, R.string.receiveUnableToImport, Toast.LENGTH_LONG).show();
                finish();
            }
            adapter.notifyDataSetChanged();
            boolean hasImports=false;
            for (ListItem item:names){
                if (item.ok){
                    hasImports=true;
                    break;
                }
            }
            if (hasImports) nextButtonAction = ACTION_IMPORT;
        }

    }
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.route_receiver);
        ListView receiverInfo = findViewById(R.id.receiverInfo);
        Button button = findViewById(R.id.btReceiverOk);
        Toolbar toolbar = findViewById(R.id.toolbar);
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
        if (!SettingsActivity.checkSettings(this,false)) {
            Toast.makeText(this, R.string.receiveMustStart, Toast.LENGTH_LONG).show();
            finish();
            return;
        }
        names = new ArrayList<>();
        adapter = new MyAdapter(this, names);
        receiverInfo.setAdapter(adapter);
        Intent intent = getIntent();
        String action = intent.getAction();
        Uri routeUri = null;
        if (Intent.ACTION_SEND.equals(action))
            routeUri = (Uri) intent.getParcelableExtra(Intent.EXTRA_STREAM);
        if (Intent.ACTION_VIEW.equals(action)) routeUri = intent.getData();
        ArrayList<Uri> items=new ArrayList<>();
        if (routeUri != null) {
            items.add(routeUri);
        } else {
            if (Intent.ACTION_SEND_MULTIPLE.equals(action)) {
                List<Uri> uriList = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
                for (Uri uri : uriList) {
                    items.add(uri);
                }
            }
        }
        if (items.size() < 1) {
            Toast.makeText(this, R.string.receiveUnableToImport, Toast.LENGTH_LONG).show();
            finish();
        }
        CheckFilesTask t=new CheckFilesTask(items,names);
        t.execute();

    }

    private void checkRouteFile(Uri routeUri,List<ListItem> list){
        RouteHandler.Route rt=null;
        try {
            InputStream is=getContentResolver().openInputStream(routeUri);
            rt=RouteHandler.parseRouteStream(is,false);
            if (rt == null){
                list.add(new ListItem(routeUri,getString(R.string.receiveNoValidRoute)));
                return;
            }
        } catch ( IOException e) {
            list.add(new ListItem(routeUri,getString(R.string.receiveUnableToRead)));
            return;
        }
        ListItem item=new ListItem(routeUri);
        if (rt.name != null){
            item.outName=rt.name+".gpx";
        }
        if (!item.outName.endsWith(".gpx")){
                item.setError(getString(R.string.receiveOnlyGpx));
                list.add(item);
                return;
        }
        getAndCheckOutfile(item);
        list.add(item);
    }

    private void buttonAction(){
        if (nextButtonAction == ACTION_EXIT){
            finish();
        }
        if (nextButtonAction == ACTION_IMPORT){
            startImport();
        }
    }


    private ListItem getAndCheckOutfile(ListItem item){
        File outDir=new File(AvnUtil.getWorkDir(null,this),"routes");
        if (! outDir.isDirectory() || ! outDir.canWrite()){
            item.setError(getString(R.string.receiveMustStart));
            return item;
        }
        File outFile=new File(outDir,item.toString());
        if (outFile.exists()){
            item.setError(getString(R.string.receiveAlreadyExists));
            return item;
        }
        item.outFile=outFile;
        return item;
    }

    class ImportTask extends AsyncTask<Void,Void,Boolean>{

        @Override
        protected Boolean doInBackground(Void... voids) {
            try {
                for (ListItem item : names) {
                    File outFile = item.outFile;
                    if (outFile == null) continue;
                    FileOutputStream os = new FileOutputStream(outFile);
                    InputStream is = getContentResolver().openInputStream(item.routeUri);
                    byte buffer[] = new byte[10000];
                    int rt = 0;
                    while ((rt = is.read(buffer)) > 0) {
                        os.write(buffer, 0, rt);
                    }
                    os.close();
                    is.close();
                }
            } catch (Exception e) {
                AvnLog.e("import route failed: ",e);
                Toast.makeText(RouteReceiver.this,getString(R.string.importFailed),Toast.LENGTH_LONG).show();
                return false;
            }
            return true;
        }

        @Override
        protected void onPostExecute(Boolean aBoolean) {
            super.onPostExecute(aBoolean);
            if (aBoolean){
                sendBroadcast(new Intent(Constants.BC_TRIGGER));
                startMain();
            }
            else{
                finish();
            }
        }
    }

    private void startImport(){
        findViewById(R.id.receiveProgressBar).setVisibility(View.VISIBLE);
        new ImportTask().execute();
    }

    private void startMain(){
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setAction(Intent.ACTION_MAIN);
        notificationIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        startActivity(notificationIntent);
        finish();
    }
}