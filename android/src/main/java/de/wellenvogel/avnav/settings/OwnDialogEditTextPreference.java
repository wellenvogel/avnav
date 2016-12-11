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
import android.widget.EditText;
import android.widget.TextView;

import de.wellenvogel.avnav.main.R;

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
    private AlertDialog mDialog;
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
        Context context = getContext();

        AlertDialog.Builder builder = new AlertDialog.Builder(context)
                .setTitle(null)
                .setPositiveButton(R.string.ok, this)
                .setNegativeButton(R.string.cancel, this);
        LayoutInflater inflater = LayoutInflater.from(context);
        View v = inflater.inflate(R.layout.dialog_edittext, null);
        TextView title = (TextView) v.findViewById(R.id.title);
        if (title != null) title.setText(getTitle());
        mEditText = (EditText) v.findViewById(R.id.value);
        mEditText.setText(getText());
        builder.setView(v);
        onPrepareDialogBuilder(builder);
        final AlertDialog dialog = builder.create();
        dialog.setOnDismissListener(this);
        dialog.show();
        mDialog=dialog;
    }

    @Override
    public Dialog getDialog() {
        return mDialog;
    }

    public AlertDialog getAlertDialog(){
        return mDialog;
    }
}
