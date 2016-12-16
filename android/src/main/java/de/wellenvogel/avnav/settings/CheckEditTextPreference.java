package de.wellenvogel.avnav.settings;

import android.content.Context;
import android.content.DialogInterface;
import android.util.AttributeSet;
import android.widget.Toast;

import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.util.DialogBuilder;

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
    protected void onShowDialog(DialogBuilder builder) {
        super.onShowDialog(builder);
        if (checker ==  null) return;
        builder.setButton(R.string.ok,DialogInterface.BUTTON_POSITIVE,new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                String newVal = getEditText().getText().toString();
                String etxt = checker.checkValue(newVal);
                if (etxt == null) {
                    setText(newVal);
                    getDialog().dismiss();
                    return;
                }
                Toast.makeText(getContext(),getContext().getResources().getString(R.string.invalidParameterValue)+":"+newVal,Toast.LENGTH_LONG).show();
            }
        });
    }

    public void setChecker(ISettingsChecker checker){
        this.checker=checker;
    }
}
