package de.wellenvogel.avnav.util;

import android.app.AlertDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.graphics.drawable.Drawable;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;

import java.util.HashMap;

import de.wellenvogel.avnav.main.R;

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
    private HashMap<Integer,Integer> idMap;
    public DialogBuilder(Context ctx,int layout){
        mContext = ctx;
        mLayout = layout;
        idMap=new HashMap<Integer, Integer>();
        idMap.put(DialogInterface.BUTTON_NEGATIVE,R.id.Button2);
        idMap.put(DialogInterface.BUTTON_NEUTRAL,R.id.Button3);
        idMap.put(DialogInterface.BUTTON_POSITIVE,R.id.Button1);
    }

    public void setText(int viewId,int text){
        createDialog();
        if (text == 0){
            setText(viewId,null);
            return;
        }
        CharSequence ctext= mContext.getResources().getString(text);
        setText(viewId,ctext);
    }
    public void setText(int viewId,CharSequence text){
        createDialog();
        if (mView == null) return;
        TextView tv=null;
        try {
            tv = (TextView) mView.findViewById(viewId);
        } catch (Exception e){}
        if (tv == null) return;
        if (text == null){
            tv.setVisibility(View.INVISIBLE);
        }
        else{
            tv.setVisibility(View.VISIBLE);
            tv.setText(text);
        }
    }


    public DialogBuilder setButton(int text, final int buttonId){
        setButton(text, buttonId, new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                if (mOnClickListener != null) mOnClickListener.onClick(mDialog,buttonId);
                mDialog.dismiss();
            }
        });
        return this;
    }

    public Button setButton(int text, final int buttonId, final DialogInterface.OnClickListener listener){
        createDialog();
        Integer layoutId=idMap.get(buttonId);
        if (layoutId == null){
            return null;
        }
        Button b=(Button)mView.findViewById(layoutId);
        if (b == null){
            return null;
        }
        b.setText(text);
        b.setVisibility(View.VISIBLE);
        b.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                listener.onClick(mDialog,buttonId);
            }
        });
        return b;
    }
    public Button setIconButton(int icon, final int buttonId, final DialogInterface.OnClickListener listener){
        createDialog();
        Integer layoutId=idMap.get(buttonId);
        if (layoutId == null){
            return null;
        }
        Button b=(Button)mView.findViewById(layoutId);
        if (b == null){
            return null;
        }
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            Drawable dr = mContext.getDrawable(icon);
            b.setCompoundDrawablesWithIntrinsicBounds(dr,null,null,null);
        }
        b.setVisibility(View.VISIBLE);
        b.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                listener.onClick(mDialog,buttonId);
            }
        });
        return b;
    }
    public Button setPositiveButton(int text, final DialogInterface.OnClickListener listener){
        return setButton(text, DialogInterface.BUTTON_POSITIVE, new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                listener.onClick(dialog,which);
                dialog.dismiss();
            }
        });
    }
    public Button setNegativeButton(int text, final DialogInterface.OnClickListener listener){
        return setButton(text, DialogInterface.BUTTON_NEGATIVE, new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                listener.onClick(dialog,which);
                dialog.dismiss();
            }
        });
    }
    public Button setNeutralButton(int text, final DialogInterface.OnClickListener listener){
        return setButton(text, DialogInterface.BUTTON_NEUTRAL, new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                listener.onClick(dialog,which);
                dialog.dismiss();
            }
        });
    }

    public DialogBuilder hideButton(final int id) {
        createDialog();
        Integer layoutId=idMap.get(id);
        if (layoutId == null) return this;
        Button b = (Button) mView.findViewById(layoutId);
        if (b == null) {
            return this;
        }
        b.setVisibility(View.INVISIBLE);
        return this;
    }

    public AlertDialog createDialog() {
        if (mDialog != null) return mDialog;
        AlertDialog.Builder builder = new AlertDialog.Builder(mContext)
                .setTitle(null);
        LayoutInflater inflater = LayoutInflater.from(mContext);
        mView = inflater.inflate(mLayout, null);
        builder.setView(mView);
        mDialog = builder.create();
        setText(R.id.title,getTitle());
        return mDialog;
    }
    public void show(){
        createDialog();
        mDialog.show();
    }
    public void dismiss(){
        if (mDialog == null) return;
        mDialog.dismiss();
    }

    public CharSequence getTitle() {
        return mTitle;
    }
    public View getContentView(){
        createDialog();
        return mView;
    }
    public AlertDialog getDialog(){
        createDialog();
        return mDialog;
    }
    public void setOnClickListener(DialogInterface.OnClickListener listener){
        mOnClickListener=listener;
    }
    public void setTitle(int title){
        setTitle((title != 0)?mContext.getResources().getString(title):null);
    }
    public void setTitle(CharSequence title){
        mTitle=title;
        setText(R.id.title,title);
    }
    public void setFontSize(int viewId,float sz){
        createDialog();
        if (mView == null) return;
        TextView tv=null;
        try {
            tv = (TextView) mView.findViewById(viewId);
        } catch (Exception e){}
        if (tv == null) return;
        tv.setTextSize(sz);
    }

    /**
     * show a simple confirm dialog
     * @param context
     * @param title the title if any (0 otherwise)
     * @param info the text to be dsiplayed
     * @param listener the dialog listener
     * @return the created builder
     */
    public static DialogBuilder confirmDialog(Context context, int title, int info, final DialogInterface.OnClickListener listener){
        DialogBuilder builder=new DialogBuilder(context,R.layout.dialog_confirm);
        builder.createDialog();
        builder.setText(R.id.title,title);
        builder.setText(R.id.question,info);
        builder.setButton(R.string.ok,DialogInterface.BUTTON_POSITIVE);
        builder.setButton(R.string.cancel,DialogInterface.BUTTON_NEGATIVE);
        builder.setOnClickListener(new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                dialog.dismiss();
                listener.onClick(dialog,which);
            }
        });
        builder.show();
        return builder;
    }

    /**
     * show a simple alert with only an OK button
     * @param context
     * @param title the title if any, 0 otherwise
     * @param info the text to be displayed
     * @param listener the dialog listener
     * @return
     */
    public static DialogBuilder alertDialog(Context context, int title, int info, final DialogInterface.OnClickListener listener){
        DialogBuilder builder=new DialogBuilder(context,R.layout.dialog_confirm);
        builder.createDialog();
        builder.setText(R.id.title,title);
        builder.setText(R.id.question,info);
        builder.setButton(R.string.ok,DialogInterface.BUTTON_POSITIVE);
        builder.setOnClickListener(new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                dialog.dismiss();
                listener.onClick(dialog,which);
            }
        });
        builder.hideButton(DialogInterface.BUTTON_NEGATIVE);
        builder.hideButton(DialogInterface.BUTTON_NEUTRAL);
        builder.show();
        return builder;
    }
}
