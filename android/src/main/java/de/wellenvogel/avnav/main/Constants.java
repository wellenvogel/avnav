package de.wellenvogel.avnav.main;

/**
 * Created by andreas on 24.10.15.
 */
public class Constants {
    //settings
    public static final String WORKDIR="workdir";
    public static final String CHARTDIR="chartdir";
    public static final String SHOWDEMO="showdemo";
    public static final String INTERNALGPS="internalGps";
    public static final String EXTERNALACCESS="externalaccess";
    public static final String ALARMSOUNDS="alarmSounds";
    public static final String IPNMEA="ip.nmea";
    public static final String IPAIS="ip.ais";
    public static final String IPADDR="ip.addr";
    public static final String IPPORT="ip.port";
    public static final String AISSENDPOS="ais.sendpos";
    public static final String BTNMEA="bt.nmea";
    public static final String BTAIS="bt.ais";
    public static final String BTDEVICE="bt.device";
    public static final String BTOFFSET="bt.offset";
    public static final String USBDEVICE="usb.device";
    public static final String USBNMEA="usb.nmea";
    public static final String USBAIS="usb.ais";
    public static final String USBBAUD="usb.baud";
    public static final String IPCONNTIMEOUT="ip.conntimeout";
    public static final String IPPOSAGE="ip.posAge";
    public static final String AISLIFETIME ="ais.Lifetime";
    public static final String AISOWN="ais.own"; //own MMSI to filter
    public static final String IPAISCLEANUPIV="ip.aisCleanupIv";
    public static final String IPOFFSET="ip.offset";
    public static final String GPSOFFSET="gps.offset";
    public static final String NMEALOG="gps.logNmea";
    public static final String AISLOG="gps.logAis";
    public static final String NMEAFILTER="gps.filter";
    public static final String NMEALOGFILTER="gps.logFilter";
    public static final String RUNMODE="runmode"; //normal,server,xwalk
    public static final String WAITSTART="waitstart";
    public static final String VERSION="version";
    public static final String WEBSERVERPORT="web.port";
    public static final String ANCHORALARM="alarm.anchor";
    public static final String GPSALARM="alarm.gps";
    public static final String WAYPOINTALARM="alarm.waypoint";
    public static final String MOBALARM="alarm.mob";
    public static final String GPS_PERMISSION_REQUESTED="permissions.gps";
    public static final String STORAGE_PERMISSION_REQUESTED="permissions.storage";

    public static final String REALCHARTS="charts";
    public static final String CHARTPREFIX="charts";
    public final static String FILE_PROVIDER_AUTHORITY=BuildConfig.APPLICATION_ID+".provider";
    public final static String ASSETS_PROVIDER_AUTHORITY=BuildConfig.APPLICATION_ID+".assetsprovider";
    //list of audio settings
    //used to retrieve the request code for a get audio file
    public static String[] audioPreferenceCodes=new String[]{
            ANCHORALARM,
            GPSALARM,
            WAYPOINTALARM,
            MOBALARM
    };
    public static final String PREFNAME="AvNav";
    //dummy file to make the media scanner see or directories...
    public static final String EMPTY_FILE="EMPTY";
    //modes
    public static final String MODE_NORMAL="normal";
    public static final String MODE_XWALK="xwalk";
    public static final String MODE_SERVER ="server";
    public static final String XWALKORIG="org.xwalk.core";
    public static final String XWALKAPP="de.wellenvogel.xwalk";
    public static final String XWALKVERSION="10.39.235.16";
    public static final String LOGPRFX="avnav";
    public static final int    OSVERSION_XWALK=19;  //if below this version we should have xwalk
    //request codes in main activity
    public static final int SETTINGS_REQUEST=1;
    public static final int FILE_OPEN=100;

    public static final String TRACKINTERVAL ="track.interval";
    public static final String TRACKDISTANCE ="track.distance";
    public static final String TRACKMINTIME ="track.mintime";
    public static final String TRACKTIME ="track.time";

    //modes
    public static final String MODE_INTERNAL="internal";
    public static final String MODE_IP="ip";
    public static final String MODE_BLUETOOTH="bluetooth";
    public static final String MODE_USB="usb";
    public static final String MODE_NONE="none";

    public static final String BC_STOPALARM="de.wellenvogel.avnav.STOPALARM";
    public static final String BC_STOPAPPL="de.wellenvogel.avnav.STOPAPPL";
    public static final String BC_TRIGGER="de.wellenvogel.avnav.TRIGGER";
    public static final String BC_RELOAD_DATA ="de.wellenvogel.avnav.RELOAD_DATA";

    public static final int LOCALNOTIFY=1;
    public static final int LOCKNOTIFY=2;

    public static final long WATCHDOGTIME=30000; //ms

    public static final String EXTRA_INITIAL="initial"; //boolean extra

    //workdir settings
    public static final String INTERNAL_WORKDIR="workdir_internal";
    public static final String EXTERNAL_WORKDIR="workdir_external";

    //js events
    public static final String JS_RELOAD="reloadData";
    public static final String JS_BACK="backPressed";
    public static final String JS_PROPERTY_CHANGE="propertyChange";
    public static final String JS_UPLOAD_AVAILABLE="uploadAvailable";
    public static final String JS_FILE_COPY_READY="fileCopyReady";
    public static final String JS_FILE_COPY_PERCENT="fileCopyPercent"; //id will be percent
    public static final String JS_FILE_COPY_DONE="fileCopyDone"; //id will be: 0 for success, 1 for error
}
