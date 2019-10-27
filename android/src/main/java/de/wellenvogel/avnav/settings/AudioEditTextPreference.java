package de.wellenvogel.avnav.settings;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.AssetFileDescriptor;
import android.database.Cursor;
import android.media.AudioManager;
import android.media.MediaMetadataRetriever;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.preference.EditTextPreference;
import android.provider.MediaStore;
import android.util.AttributeSet;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;

import de.wellenvogel.avnav.gps.Alarm;
import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.util.AvnLog;

import static android.app.Activity.RESULT_OK;
import static android.content.Context.AUDIO_SERVICE;

/**
 * Created by andreas on 11.12.16.
 */

public class AudioEditTextPreference extends EditTextPreference implements SettingsActivity.ActivityResultCallback {
    public static final String ASSETS_URI_PREFIX="file:///android_asset/sounds/";
    public static class AudioInfo{
        public String displayName;
        public String type;
        public Uri uri;
        public String path;

        JSONObject toJson() throws JSONException {
            JSONObject rt=new JSONObject();
            rt.put("display",displayName);
            rt.put("type",type);
            rt.put("uri",(uri != null)?uri.toString():"");
            if (path != null) rt.put("path",path);
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
            if (json.has("path")) path=json.getString("path");
        }
        public String getDisplayString(){
            if (type == null || type.equals("default")) {
                if (uri == null || ! uri.toString().startsWith(ASSETS_URI_PREFIX)) return "default";
                return uri.toString().substring(ASSETS_URI_PREFIX.length());
            }
            return "["+type+"] "+displayName;
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

    private void setDefault(final AudioInfo info, String defaultValue){
        info.displayName="default";
        info.type="default";
        info.uri=Uri.parse(ASSETS_URI_PREFIX+((defaultValue!=null && ! defaultValue.isEmpty())?defaultValue:"alarm.mp3"));
    }

    @Override
    public void setText(String text) {
        try {
            JSONObject jo= new JSONObject(text);
            info=new AudioInfo(jo);
        } catch (JSONException e) {
            info=new AudioInfo();
            setDefault(info,text);
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

    private AlertDialog.Builder mDialogBuilder;
    private int mRequestCode=-1;


    @Override
    protected void showDialog(Bundle state) {
        showDialog(state,null);
    }

    public static AudioInfo getAudioInfoForAlarmName(String name, Context context){
        SharedPreferences prefs = context.getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        String sound = prefs.getString("alarm." + name, "");
        if (sound.isEmpty()) {
            return null;
        }
        return getAudioInfoForAlarm(sound,context);
    }
    public static AudioInfo getAudioInfoForAlarm(String sound, Context context){
        AudioInfo info=null;
        try{
            info=new AudioInfo(new JSONObject(sound));
        }catch (Exception e){
            info=new AudioInfo();
            info.displayName="default";
            info.type="default";
            info.uri=Uri.parse(ASSETS_URI_PREFIX+sound);
        }
        return info;
    }

    public static void setPlayerSource(MediaPlayer player, String sound, Context context) throws Exception{
        AudioInfo info=getAudioInfoForAlarm(sound, context);
        setPlayerSource(player,info,context);
    }
    public static void setPlayerSource(MediaPlayer player, AudioInfo info, Context context) throws Exception {
        if (info == null) return;
        if (info.path != null) {
            player.setDataSource(info.path);
        } else {
            if (info.uri.toString().startsWith(ASSETS_URI_PREFIX)) {
                String ap = "sounds/" + info.uri.toString().substring(ASSETS_URI_PREFIX.length());
                AssetFileDescriptor af = context.getAssets().openFd(ap);
                if (af != null) {
                    player.setDataSource(af.getFileDescriptor(), af.getStartOffset(), af.getDeclaredLength());
                }
            } else {
                player.setDataSource(context, info.uri);
            }
        }
    }
    public static class AudioStream{
        public long len;
        public InputStream stream;
        public AudioStream(long len,InputStream stream){
            this.len=len;
            this.stream=stream;
        }
    }
    public static AudioStream getAlarmAudioStream(AudioInfo info, Context context) throws Exception {
        if (info == null) return null;
        if (info.path != null) {
            File soundFile=new File(info.path);
            if (! soundFile.isFile()) return null;
            return new AudioStream(soundFile.length(),new FileInputStream(soundFile));
        } else {
            if (info.uri.toString().startsWith(ASSETS_URI_PREFIX)) {
                String ap = "sounds/" + info.uri.toString().substring(ASSETS_URI_PREFIX.length());
                AssetFileDescriptor af = context.getAssets().openFd(ap);
                if (af == null) return null;
                return new AudioStream(af.getDeclaredLength(),new AssetFileDescriptor.AutoCloseInputStream(af));
            } else {
                ParcelFileDescriptor fd=context.getContentResolver().openFileDescriptor(info.uri,"r");
                if (fd == null) return null;
                return new AudioStream(fd.getStatSize(),new ParcelFileDescriptor.AutoCloseInputStream(fd));
            }
        }
    }


    private void showDialog(Bundle state, final AudioInfo dialogInfo){

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
        final TextView value = (TextView) v.findViewById(R.id.value);
        final AudioInfo internalDialogInfo=dialogInfo!=null?dialogInfo:info;
        final MediaPlayer player=new MediaPlayer();
        final Button bPlay=(Button)v.findViewById(R.id.AudioPlay);
        final Button bStop=(Button)v.findViewById(R.id.AudioStop);
        bPlay.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                player.reset();
                if (internalDialogInfo == null) return;
                try {
                    player.setAudioStreamType(AudioManager.STREAM_NOTIFICATION);
                    setPlayerSource(player,internalDialogInfo,getContext());
                    player.prepare();
                    player.start();
                    bPlay.setVisibility(View.GONE);
                    bStop.setVisibility(View.VISIBLE);
                } catch (Exception e) {
                    AvnLog.e("unable to play "+e);
                    Toast.makeText(getContext(),"unable to play: "+e, Toast.LENGTH_LONG).show();
                }
            }
        });
        bStop.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                player.stop();
                bStop.setVisibility(View.GONE);
                bPlay.setVisibility(View.VISIBLE);
            }
        });
        player.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
            @Override
            public void onCompletion(MediaPlayer mp) {
                mp.stop();
                bStop.setVisibility(View.GONE);
                bPlay.setVisibility(View.VISIBLE);
            }
        });
        dialog.setOnDismissListener(new DialogInterface.OnDismissListener() {
            @Override
            public void onDismiss(DialogInterface dialog) {
                player.stop();
                player.reset();
            }
        });
        value.setText(internalDialogInfo!=null?internalDialogInfo.getDisplayString():"default");
        Button bMedia=(Button)v.findViewById(R.id.AudioMedia);
        bMedia.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (mRequestCode < 0) return;
                Intent intent1 = new Intent();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                    intent1.setAction(Intent.ACTION_OPEN_DOCUMENT);
                }
                else{
                    intent1.setAction(Intent.ACTION_GET_CONTENT);
                }
                intent1.setType("audio/*");
                dialog.dismiss();
                ((Activity)getContext()).startActivityForResult(
                        Intent.createChooser(intent1, getTitle()), mRequestCode);
            }
        });
        Button btRingtone=(Button)v.findViewById(R.id.AudioRingtone);
        btRingtone.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                dialog.dismiss();
                Intent intent = new Intent(RingtoneManager.ACTION_RINGTONE_PICKER);
                intent.putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, getTitle());
                intent.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, false);
                intent.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true);
                intent.putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE,RingtoneManager.TYPE_ALARM);
                ((Activity)getContext()).startActivityForResult( intent, mRequestCode);
            }
        });
        Button b3=(Button)v.findViewById(R.id.AudioBt3);
        b3.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (internalDialogInfo != null){
                   setDefault(internalDialogInfo,defaultValue);
                }
                value.setText(internalDialogInfo!=null?internalDialogInfo.getDisplayString():"default");
                player.stop();
                player.reset();
                bStop.setVisibility(View.GONE);
                bPlay.setVisibility(View.VISIBLE);
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



    /**
     * for pre KitKat devices we try to keep the path in the settings
     * to avoid any access rights problems when accessing the file url
     * @param contentURI
     * @return
     */
    private String getRealPathFromURI(Uri contentURI)
    {
        Cursor cursor = getContext().getContentResolver().query(contentURI, null, null, null, null);
        cursor.moveToFirst();
        String documentId = cursor.getString(0);
        documentId = documentId.split(":")[1];
        cursor.close();

        cursor = getContext().getContentResolver().query(
                MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
                null, "_id=? ", new String[] { documentId }, null);
        cursor.moveToFirst();
        String path=null;
        if (cursor.getCount() > 0) {
            path = cursor.getString(cursor.getColumnIndex(MediaStore.Images.Media.DATA));
        }
        else {
            cursor = getContext().getContentResolver().query(
                    MediaStore.Audio.Media.INTERNAL_CONTENT_URI,
                    null, "_id=? ", new String[] { documentId }, null);
            cursor.moveToFirst();
            if (cursor.getCount() > 0) {
                path = cursor.getString(cursor.getColumnIndex(MediaStore.Images.Media.DATA));
            }
        }
        cursor.close();

        return path;
    }


    @Override
    public boolean onActivityResult(int requestCode, int resultCode, Intent data) {
        if (mRequestCode != requestCode) return false;
        if (resultCode != RESULT_OK) return true;
        Uri uri=data.getData();
        boolean isRingtone=false;
        if (uri == null) {
            uri=data.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI);
            if (uri == null) {
                AvnLog.i("empty audio select request");
                return true;
            }
            isRingtone=true;

        }
        boolean needsPath=true;
        if (! isRingtone) {
            final int takeFlags = data.getFlags()
                    & (Intent.FLAG_GRANT_READ_URI_PERMISSION
                    | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            // Check for the freshest data.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                getContext().getContentResolver().takePersistableUriPermission(uri, takeFlags);
                needsPath = false;
            }
        }
        else{
            needsPath=false;
        }
        if (uri.toString().startsWith("content:")){
            AudioInfo info=new AudioInfo();
            info.uri=uri;
            info.type="media";
            if (isRingtone){
                info.type="ringtone";
                info.displayName=RingtoneManager.getRingtone(getContext(),uri).getTitle(getContext());
            }
            else {
                MediaMetadataRetriever retr = new MediaMetadataRetriever();
                retr.setDataSource(getContext(), uri);
                info.displayName = retr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE);
            }
            if (needsPath) info.path= getRealPathFromURI(uri);
            showDialog(null,info);
            return true;

        }
        showDialog(null,null);
        return true;
    }
}
