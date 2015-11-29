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
    public static final String IPNMEA="ip.nmea";
    public static final String IPAIS="ip.ais";
    public static final String IPADDR="ip.addr";
    public static final String IPPORT="ip.port";
    public static final String BTNMEA="bt.nmea";
    public static final String BTAIS="bt.ais";
    public static final String BTDEVICE="bt.device";
    public static final String BTOFFSET="bt.offset";
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
    public static final String OWN_PACKAGE="de.wellenvogel.avnav.main";
    public static final String LOGPRFX="avnav";
    public static final int    OSVERSION_XWALK=19;  //if below this version we should have xwalk
    public static final int ROUTE_OPEN_REQUEST=0;
    public static final String TRACKINTERVAL ="track.interval";
    public static final String TRACKDISTANCE ="track.distance";
    public static final String TRACKMINTIME ="track.mintime";
    public static final String TRACKTIME ="track.time";
}
