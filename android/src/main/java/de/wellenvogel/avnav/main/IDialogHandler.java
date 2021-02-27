package de.wellenvogel.avnav.main;

/**
 * Created by andreas on 21.11.15.
 */
public interface IDialogHandler {
    public boolean onCancel(int dialogId);
    public boolean onOk(int dialogId);
    public boolean onNeutral(int dialogId);
}
