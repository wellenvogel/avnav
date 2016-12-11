package de.wellenvogel.avnav.settings;

import android.app.AlertDialog;
import android.app.Dialog;
import android.content.Context;
import android.content.DialogInterface;
import android.os.Bundle;
import android.util.AttributeSet;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.EditText;
import android.widget.TextView;

import de.wellenvogel.avnav.main.R;

/**
 * Created by andreas on 29.11.15.
 */
public class CheckEditTextPreference extends DefaultsEditTextPreference {

    private ISettingsChecker checker;

    public CheckEditTextPreference(Context context) {
        super(context);
    }

    public CheckEditTextPreference(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    @Override
    protected void onPrepareDialogBuilder(AlertDialog.Builder builder) {
        super.onPrepareDialogBuilder(builder);
        if (checker != null){
            builder.setPositiveButton(android.R.string.ok,null);
        }
    }


    @Override
    protected void showDialog(Bundle state) {
        super.showDialog(state);
        AlertDialog dialog=getAlertDialog();
        if (checker != null) {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(
                    new View.OnClickListener() {
                        @Override
                        public void onClick(View v) {
                            String newVal = getEditText().getText().toString();
                            String etxt = checker.checkValue(newVal);
                            if (etxt == null) {
                                setText(newVal);
                                getDialog().dismiss();
                                return;
                            }
                            AlertDialog.Builder builder = new AlertDialog.Builder(getContext());
                            builder.setPositiveButton(android.R.string.ok,
                                    new DialogInterface.OnClickListener() {
                                        public void onClick(DialogInterface dialog, int id) {
                                        }
                                    });
                            String title = getContext().getString(R.string.invalidParameterValue) + ": " + newVal;
                            builder.setTitle(title).setMessage(etxt);
                            builder.create().show();
                        }
                    });
        }
    }

    public void setChecker(ISettingsChecker checker){
        this.checker=checker;
    }
}
