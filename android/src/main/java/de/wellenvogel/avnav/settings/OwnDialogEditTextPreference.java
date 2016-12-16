package de.wellenvogel.avnav.settings;

import android.app.AlertDialog;
import android.app.Dialog;
import android.content.Context;
import android.content.DialogInterface;
import android.os.Bundle;
import android.preference.EditTextPreference;
import android.util.AttributeSet;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;

import java.util.HashMap;

import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.util.AvnLog;

/**
 * Created by andreas on 11.12.16.
 */

public class OwnDialogEditTextPreference extends EditTextPreference {
    public OwnDialogEditTextPreference(Context context) {
        super(context);
    }

    public OwnDialogEditTextPreference(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    public OwnDialogEditTextPreference(Context context, AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
    }



    private EditText mEditText;
    private DialogBuilder mDialogBuilder;
    private View mView;
    @Override
    public EditText getEditText() {
        return mEditText;
    }
    @Override
    protected void onDialogClosed(boolean positiveResult) {
        if (positiveResult) {
            String value = mEditText.getText().toString();
            if (callChangeListener(value)) {
                setText(value);
            }
        }
    }


    @Override
    protected void showDialog(Bundle state) {
        if (mDialogBuilder == null) {
            mDialogBuilder=new DialogBuilder(getContext(),R.layout.dialog_edittext);
        }
        mDialogBuilder.setTitle(getTitle());
        mDialogBuilder.createDialog();
        mEditText = (EditText) mDialogBuilder.getContentView().findViewById(R.id.value);
        mEditText.setText(getText());
        mDialogBuilder.getDialog().setOnDismissListener(this);
        mDialogBuilder.setButton(R.id.edpButton1,R.string.ok,DialogInterface.BUTTON_POSITIVE);
        mDialogBuilder.setButton(R.id.edpButton2,R.string.cancel,DialogInterface.BUTTON_NEGATIVE);
        mDialogBuilder.hideButton(R.id.edpButton3);
        mDialogBuilder.setOnClickListener(this);
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
}
