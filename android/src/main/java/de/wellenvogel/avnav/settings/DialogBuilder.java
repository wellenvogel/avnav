package de.wellenvogel.avnav.settings;

import android.app.AlertDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;

import java.util.HashMap;

import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.util.AvnLog;

/**
 * Created by andreas on 16.12.16.
 */

public class DialogBuilder {
    private Context mContext;
    private int mLayout;
    private View mView;
    private CharSequence mTitle;
    private AlertDialog mDialog;
    private DialogInterface.OnClickListener mOnClickListener;
    public DialogBuilder(Context ctx,int layout){
        mContext = ctx;
        mLayout = layout;
    }


    public DialogBuilder setButton(final int layoutId, int text,final int buttonId){
        setButton(layoutId, text, buttonId, new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                if (mOnClickListener != null) mOnClickListener.onClick(mDialog,buttonId);
                mDialog.dismiss();
            }
        });
        return this;
    }

    public DialogBuilder setButton(final int layoutId, int text, final int buttonId, final DialogInterface.OnClickListener listener){
        if (mView == null) {
            AvnLog.e("view not set for DialogBuilder in set button");
            return this;
        }
        Button b=(Button)mView.findViewById(layoutId);
        if (b == null){
            return this;
        }
        b.setText(text);
        b.setVisibility(View.VISIBLE);
        b.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                listener.onClick(mDialog,buttonId);
            }
        });
        return this;
    }

    public DialogBuilder hideButton(final int layoutId) {
        if (mView == null) {
            AvnLog.e("view not set for DialogBuilder in set button");
            return this;
        }
        Button b = (Button) mView.findViewById(layoutId);
        if (b == null) {
            return this;
        }
        b.setVisibility(View.INVISIBLE);
        return this;
    }

    public AlertDialog createDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(mContext)
                .setTitle(null);
        LayoutInflater inflater = LayoutInflater.from(mContext);
        mView = inflater.inflate(mLayout, null);
        if (getTitle() != null) {
            TextView title = (TextView) mView.findViewById(R.id.title);
            if (title != null) title.setText(getTitle());
        }
        builder.setView(mView);
        mDialog = builder.create();
        return mDialog;
    }
    public void show(){
        if (mDialog == null) throw new RuntimeException("alert dialog not created for show");
        mDialog.show();
    }

    public CharSequence getTitle() {
        return mTitle;
    }
    public View getContentView(){
        return mView;
    }
    public AlertDialog getDialog(){
        return mDialog;
    }
    public void setOnClickListener(DialogInterface.OnClickListener listener){
        mOnClickListener=listener;
    }
    public void setTitle(CharSequence title){
        mTitle=title;
    }
}
