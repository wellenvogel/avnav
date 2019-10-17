package de.wellenvogel.avnav.main;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Paint;
import android.net.Uri;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.support.annotation.NonNull;
import android.support.annotation.Nullable;
import android.support.v7.widget.Toolbar;
import android.util.Xml;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.BaseAdapter;
import android.widget.Button;
import android.widget.ListView;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.TwoLineListItem;


import org.xmlpull.v1.XmlPullParser;
import org.xmlpull.v1.XmlPullParserException;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

import de.wellenvogel.avnav.settings.SettingsActivity;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;

import static java.lang.System.in;

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
        ListItem(Uri u){
            routeUri=u;
            ok=true;
        }
        ListItem(Uri u,String error){
            routeUri=u;
            ok=false;
            this.error=error;
        }
        public String toString(){
            return routeUri.getLastPathSegment();
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
        if (!SettingsActivity.checkSettings(this, false, false)) {
            Toast.makeText(this, R.string.receiveMustStart, Toast.LENGTH_LONG).show();
            finish();
            return;
        }
        names = new ArrayList<>();
        MyAdapter adapter = new MyAdapter(this, names);
        receiverInfo.setAdapter(adapter);
        Intent intent = getIntent();
        String action = intent.getAction();
        Uri routeUri = null;
        if (Intent.ACTION_SEND.equals(action))
            routeUri = (Uri) intent.getParcelableExtra(Intent.EXTRA_STREAM);
        if (Intent.ACTION_VIEW.equals(action)) routeUri = intent.getData();
        if (routeUri != null) {
            checkRouteFile(routeUri, names);
        } else {
            if (Intent.ACTION_SEND_MULTIPLE.equals(action)) {
                List<Uri> uriList = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
                for (Uri uri : uriList) {
                    checkRouteFile(uri, names);
                }
            }
        }

        if (names.size() < 1) {
            Toast.makeText(this, R.string.receiveUnableToImport, Toast.LENGTH_LONG).show();
            finish();
        }
        if (names.size() == 1 && !names.get(0).ok) {
            Toast.makeText(this, names.get(0).error, Toast.LENGTH_LONG).show();
            finish();
            return;
        }
        adapter.notifyDataSetChanged();
        nextButtonAction = ACTION_IMPORT;

    }

    private void checkRouteFile(Uri routeUri,List<ListItem> list){
        if (! routeUri.getLastPathSegment().endsWith(".gpx")){
            list.add(new ListItem(routeUri,getString(R.string.receiveOnlyGpx)));
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
                list.add(new ListItem(routeUri,getString(R.string.receiveNoValidRoute)));
                return;
            }
        } catch (XmlPullParserException | IOException e) {
            list.add(new ListItem(routeUri,getString(R.string.receiveUnableToRead)));
            return;
        }
        ListItem item=new ListItem(routeUri);
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
        File outFile=new File(outDir,item.routeUri.getLastPathSegment());
        if (outFile.exists()){
            item.setError(getString(R.string.receiveAlreadyExists));
            return item;
        }
        item.outFile=outFile;
        return item;
    }

    private void startImport(){
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
            sendBroadcast(new Intent(Constants.BC_TRIGGER));
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