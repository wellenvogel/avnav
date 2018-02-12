package de.wellenvogel.avnav.main;

/**
 * Created by andreas on 16.01.16.
 */
public interface ICallback {
    public static final int CB_EXIT =2;
    public static final int CB_RESTART_SETTINGS =1;
    public static final int CB_SETTINGS_OK =0;
    public void callback(int id);
}
