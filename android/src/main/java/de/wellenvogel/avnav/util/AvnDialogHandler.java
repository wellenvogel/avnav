package de.wellenvogel.avnav.util;

import android.app.Activity;

import de.wellenvogel.avnav.main.IDialogHandler;

/**
 * Created by andreas on 24.11.15.
 */
public class AvnDialogHandler implements IDialogHandler {
    private Activity activity;
    public AvnDialogHandler(Activity activity){
        this.activity=activity;
    }
    public Activity getActivity(){
        return activity;
    }
    @Override
    public boolean onCancel(int dialogId) {
        if ( ! (activity instanceof  IDialogHandler)) return true;
        return ((IDialogHandler)activity).onCancel(dialogId);
    }

    @Override
    public boolean onOk(int dialogId) {
        if ( ! (activity instanceof  IDialogHandler)) return true;
        return ((IDialogHandler)activity).onOk(dialogId);
    }

    @Override
    public boolean onNeutral(int dialogId) {
        if ( ! (activity instanceof  IDialogHandler)) return true;
        return ((IDialogHandler)activity).onNeutral(dialogId);
    }
}
