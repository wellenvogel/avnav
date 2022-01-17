package de.wellenvogel.avnav.main;

import android.os.Build;

/**
 * Created by andreas on 24.10.15.
 */
public class Constants {
    //settings
    public static final String WORKDIR="workdir";
    public static final String CHARTDIR="chartdir";
    public static final String SHOWDEMO="showdemo";
    public static final String EXTERNALACCESS="externalaccess";
    public static final String ALARMSOUNDS="alarmSounds";
    public static final String IPNMEA="ip.nmea";
    public static final String IPAIS="ip.ais";
    public static final String IPADDR="ip.addr";
    public static final String IPPORT="ip.port";
    public static final String AISOWN="ais.own"; //own MMSI to filter
    public static final String HIDE_BARS="layout.hideBars";
    public static final String RUNMODE="runmode"; //normal,server,xwalk
    public static final String WAITSTART="waitstart";
    public static final String VERSION="version";
    public static final String WEBSERVERPORT="web.port";
    public static final String ANCHORALARM="alarm.anchor";
    public static final String GPSALARM="alarm.gps";
    public static final String WAYPOINTALARM="alarm.waypoint";
    public static final String MOBALARM="alarm.mob";
    public static final String ADDON_CONFIG="addon.config";
    //new handler config
    public static final String HANDLER_CONFIG="internal.handler";

    public static final String REALCHARTS="charts";
    public static final String CHARTPREFIX="charts";
    public static final String DEMOCHARTS="demo";
    public static final String CHARTOVERVIEW="avnav.xml";
    public final static String ASSETS_PROVIDER_AUTHORITY=BuildConfig.APPLICATION_ID+".assetsprovider";
    public final static String USER_PROVIDER_AUTHORITY=BuildConfig.APPLICATION_ID+".userprovider";
    public static final String USB_DEVICE_EXTRA = "usbDevice" ;
    //list of audio settings
    //used to retrieve the request code for a get audio file
    public static String[] audioPreferenceCodes=new String[]{
            ANCHORALARM,
            GPSALARM,
            WAYPOINTALARM,
            MOBALARM
    };
    public static final String PREFNAME="AvNav";
    public static final String MODE_SERVER ="server";
    public static final String LOGPRFX="avnav";
    //request codes in main activity
    public static final int SETTINGS_REQUEST=1;
    public static final int FILE_OPEN=100;

    public static final String BC_STOPALARM="de.wellenvogel.avnav.STOPALARM";
    public static final String BC_STOPAPPL="de.wellenvogel.avnav.STOPAPPL";
    public static final String BC_TRIGGER="de.wellenvogel.avnav.TRIGGER";
    public static final String BC_RELOAD_DATA ="de.wellenvogel.avnav.RELOAD_DATA";

    public static final int LOCALNOTIFY=1;

    public static final long WATCHDOGTIME=30000; //ms

    public static final String EXTRA_INITIAL="initial"; //boolean extra - check permissions when entering settings

    //workdir settings
    public static final String INTERNAL_WORKDIR="workdir_internal";
    public static final String EXTERNAL_WORKDIR="workdir_external";

    //max size for files being transferred as string between js and android
    public static final long MAXFILESIZE=500000;

    public static final boolean HAS_HEAD_SUPPORT=(Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP);

    //js events
    public static final String JS_RELOAD="reloadData";
    public static final String JS_BACK="backPressed";
    public static final String JS_PROPERTY_CHANGE="propertyChange";
    public static final String JS_UPLOAD_AVAILABLE="uploadAvailable";
    public static final String JS_FILE_COPY_READY="fileCopyReady";
    public static final String JS_FILE_COPY_PERCENT="fileCopyPercent"; //id will be percent
    public static final String JS_FILE_COPY_DONE="fileCopyDone"; //id will be: 0 for success, 1 for error
    public static final String JS_DEVICE_ADDED="deviceAdded";
    public static final String JS_REMOTE_MESSAGE="remoteMessage";
    public static final String JS_REMOTE_CLOSE="channelClose";

}
