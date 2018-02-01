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
import android.view.View;
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
    private DialogBuilder mDialogBuilder;
    private int mRequestCode=-1;
    @Override
    public EditText getEditText() {
        return mEditText;
    }
    @Override
    protected void onDialogClosed(boolean positiveResult) {
        if (positiveResult) {
            //TODO
            /*
            String value = mEditText.getText().toString();
            if (callChangeListener(value)) {
                setText(value);
            }
            */
        }
    }
    @Override
    public void onClick(DialogInterface dialog, int which) {
        if (which == DialogInterface.BUTTON_NEUTRAL) {
            setText(""); //should be unparseable and this way fall back to default
        }
        super.onClick(dialog,which);

    }


    @Override
    protected void showDialog(Bundle state) {
        if (mDialogBuilder == null) {
            mDialogBuilder=new DialogBuilder(getContext(),R.layout.dialog_audio);
        }
        if (mRequestCode < 0){
            for (int i=0;i< Constants.audioPreferenceCodes.length;i++){
                if (Constants.audioPreferenceCodes[i].equals(getKey())){
                    mRequestCode=i;
                    break;
                }
            }
        }
        mDialogBuilder.setTitle(getTitle());
        mDialogBuilder.createDialog();
        mEditText = (EditText) mDialogBuilder.getContentView().findViewById(R.id.value);
        mEditText.setText(getSummaryText());
        mEditText.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (mRequestCode < 0) return;
                Intent intent1 = new Intent();
                intent1.setAction(Intent.ACTION_GET_CONTENT);
                intent1.setType("audio/*");
                mDialogBuilder.dismiss();
                ((Activity)getContext()).startActivityForResult(
                        Intent.createChooser(intent1, getTitle()), mRequestCode);
            }
        });
        mDialogBuilder.getDialog().setOnDismissListener(this);
        mDialogBuilder.setOnClickListener(this);
        mDialogBuilder.setButton(R.string.setDefault,DialogInterface.BUTTON_NEUTRAL);
        mDialogBuilder.setButton(R.string.cancel,DialogInterface.BUTTON_NEGATIVE);
        mDialogBuilder.setButton(R.string.ok,DialogInterface.BUTTON_POSITIVE);
        onShowDialog(mDialogBuilder);
        mDialogBuilder.show();
    }

    @Override
    public Dialog getDialog() {
        return mDialogBuilder.getDialog();
    }

    protected AlertDialog getAlertDialog(){
        return mDialogBuilder.getDialog();
    }
    protected DialogBuilder getDialogBuilder(){return mDialogBuilder;}
    protected void onShowDialog(DialogBuilder b){
        return;
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
            try {
                setText(info.toJson().toString());
            } catch (JSONException e) {
                AvnLog.e("internal error, unable to encode audio info "+e);
                setText("");
            }
            return true;

        }
        File alarm=new File(uri.getPath());
        setText(alarm.getAbsolutePath());
        return true;
    }
}
