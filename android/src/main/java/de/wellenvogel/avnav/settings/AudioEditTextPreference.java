package de.wellenvogel.avnav.settings;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.Dialog;
import android.content.ContentResolver;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Bundle;
import android.preference.EditTextPreference;
import android.provider.MediaStore;
import android.util.AttributeSet;
import android.util.JsonReader;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.QuickContactBadge;
import android.widget.TextView;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;

import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.DialogBuilder;

import static android.app.Activity.RESULT_OK;

/**
 * Created by andreas on 11.12.16.
 */

public class AudioEditTextPreference extends EditTextPreference implements SettingsActivity.ActivityResultCallback {
    public static final String ASSETS_URI_PREFIX="file:///android_asset/sounds/";
    public static class AudioInfo{
        public String displayName;
        public String type;
        public Uri uri;

        JSONObject toJson() throws JSONException {
            JSONObject rt=new JSONObject();
            rt.put("display",displayName);
            rt.put("type",type);
            rt.put("uri",(uri != null)?uri.toString():"");
            return rt;
        }
        public AudioInfo(){}
        public AudioInfo(JSONObject json) throws JSONException {
            displayName=json.getString("display");
            type=json.getString("type");
            try {
                uri = Uri.parse(json.getString("uri"));
            }catch (Exception e){

            }
        }
        public String getDisplayString(){
            if (type == null || type.equals("default")) {
                if (uri == null || ! uri.toString().startsWith(ASSETS_URI_PREFIX)) return "default";
                return uri.toString().substring(ASSETS_URI_PREFIX.length());
            }
            return type+":"+displayName;
        }
    }
    public AudioEditTextPreference(Context context) {
        super(context);
    }

    public AudioEditTextPreference(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    public AudioEditTextPreference(Context context, AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
    }

    private AudioInfo info;

    @Override
    public void setText(String text) {
        try {
            JSONObject jo= new JSONObject(text);
            info=new AudioInfo(jo);
        } catch (JSONException e) {
            info=new AudioInfo();
            info.displayName="default";
            info.type="default";
            info.uri=Uri.parse(ASSETS_URI_PREFIX+(defaultValue!=null?defaultValue:"alarm.mp3"));
            try {
                super.setText(info.toJson().toString());
            } catch (JSONException e1) {
            }
        }
        super.setText(text);
        setSummary(getSummaryText());
    }

    public String getSummaryText(){
        if (info == null) return "default";
        else return info.getDisplayString();
    }

    private String defaultValue;

    private EditText mEditText;
    private AlertDialog.Builder mDialogBuilder;
    private int mRequestCode=-1;


    @Override
    protected void showDialog(Bundle state) {
        showDialog(state,null);
    }

    private void showDialog(Bundle state,  AudioInfo dialogInfo){

        mDialogBuilder = new AlertDialog.Builder(getContext())
                .setTitle(null);
        LayoutInflater inflater = LayoutInflater.from(getContext());
        View v= inflater.inflate(R.layout.dialog_audio, null);
        mDialogBuilder.setView(v);
        final AlertDialog dialog = mDialogBuilder.create();
        if (mRequestCode < 0){
            for (int i=0;i< Constants.audioPreferenceCodes.length;i++){
                if (Constants.audioPreferenceCodes[i].equals(getKey())){
                    mRequestCode=i;
                    break;
                }
            }
        }
        TextView title=(TextView)v.findViewById(R.id.AudioTitle);
        title.setText(getTitle());
        mEditText = (EditText) v.findViewById(R.id.value);
        final AudioInfo internalDialogInfo=dialogInfo!=null?dialogInfo:info;
        mEditText.setText(internalDialogInfo!=null?internalDialogInfo.getDisplayString():"default");
        mEditText.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (mRequestCode < 0) return;
                Intent intent1 = new Intent();
                intent1.setAction(Intent.ACTION_GET_CONTENT);
                intent1.setType("audio/*");
                dialog.dismiss();
                ((Activity)getContext()).startActivityForResult(
                        Intent.createChooser(intent1, getTitle()), mRequestCode);
            }
        });
        dialog.setOnDismissListener(this);
        Button b3=(Button)v.findViewById(R.id.AudioBt3);
        b3.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                setText("");
                dialog.dismiss();
            }
        });
        Button b2=(Button)v.findViewById(R.id.AudioBt2);
        b2.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                dialog.dismiss();
            }
        });
        Button b1=(Button)v.findViewById(R.id.AudioBt1);
        b1.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                try {
                    setText(internalDialogInfo.toJson().toString());
                } catch (JSONException e) {
                    setText("");
                }
                dialog.dismiss();
            }
        });
        dialog.show();
    }


    public void setDefaultValue(String defaultValue){
        this.defaultValue=defaultValue;
    }
    public String getDefaultValue(){ return defaultValue;}

    @Override
    protected void onAttachedToActivity() {
        super.onAttachedToActivity();
        ((SettingsActivity)getContext()).registerActivityResultCallback(this);
    }



    @Override
    public boolean onActivityResult(int requestCode, int resultCode, Intent data) {
        if (mRequestCode != requestCode) return false;
        if (resultCode != RESULT_OK) return true;
        Uri uri=data.getData();
        if (uri == null) {
            AvnLog.i("empty audio select request");
        }
        if (uri.toString().startsWith("content:")){
            MediaMetadataRetriever retr=new MediaMetadataRetriever();
            retr.setDataSource(getContext(),uri);
            AudioInfo info=new AudioInfo();
            info.uri=uri;
            info.type="media";
            info.displayName=retr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE);
            showDialog(null,info);
            return true;

        }
        showDialog(null,null);
        return true;
    }
}
