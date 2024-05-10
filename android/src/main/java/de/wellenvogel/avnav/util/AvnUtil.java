package de.wellenvogel.avnav.util;

import android.app.PendingIntent;
import android.content.Context;
import android.content.SharedPreferences;
import android.location.Location;
import android.net.ConnectivityManager;
import android.net.LinkProperties;
import android.net.Network;
import android.net.Uri;
import android.os.Build;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.UnsupportedEncodingException;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.net.SocketException;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Calendar;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.List;
import java.util.TimeZone;

import de.wellenvogel.avnav.main.Constants;

/**
 * Created by andreas on 26.11.15.
 */
public class AvnUtil {
    public static final double NM=1852.0;
    public static final double msToKn=3600.0/NM;

    public static long getLongPref(SharedPreferences prefs, String key, long defaultValue){
        try{
            return prefs.getLong(key,defaultValue);
        }catch (Throwable x){}
        try {
            String v = prefs.getString(key, null);
            if (v == null) return defaultValue;
            try {
                long rt = Long.parseLong(v);
                return rt;
            } catch (Exception e) {
                return defaultValue;
            }
        }catch (Throwable t){

        }
        return defaultValue;
    }

    public static boolean matchesNmeaFilter(String record, String[] nmeaFilter) {
        if (record == null || nmeaFilter == null || nmeaFilter.length < 1) return true;
        boolean matches = false;
        boolean hasPositiveCondition = false;
        for (String f : nmeaFilter) {
            boolean inverse = false;
            if (f.startsWith("^")) {
                inverse = true;
                f = f.substring(1);
            } else {
                hasPositiveCondition = true;
            }
            if (f.startsWith("$")) {
                if (!record.startsWith("$")) continue;
                if (record.substring(3).startsWith(f.substring(1))) {
                    if (!inverse) {
                        matches = true;
                    } else {
                        //an inverse match always wins
                        return false;
                    }
                }
            } else {
                if (record.startsWith(f)) {
                    if (!inverse) {
                        matches = true;
                    } else {
                        return false;
                    }
                }
            }
        }
        if (matches) return true;
        //we consider the check to fail if there was no match
        //but we had at least a positive condition
        return ! hasPositiveCondition;
    }
    public static String[] splitNmeaFilter(String nmeaFilter){
        if (nmeaFilter != null && ! nmeaFilter.isEmpty()){
            if (nmeaFilter.indexOf(",")>=0) {
                return nmeaFilter.split(" *, *");
            }
            else{
                return new String[]{nmeaFilter};
            }
        }
        return null;
    }

    public static String removeNonNmeaChars(String input){
        if (input == null) return input;
        return input.replaceAll("[^\\x20-\\x7F]", "");
    }

    public static File workdirStringToFile(String wd, Context context){
        if (wd.equals(Constants.INTERNAL_WORKDIR)){
            return context.getFilesDir();
        }
        if (wd.equals(Constants.EXTERNAL_WORKDIR)){
            return context.getExternalFilesDir(null);
        }
        return new File(wd);
    }
    public static File getWorkDir(SharedPreferences pref, Context context){
        if (pref == null){
            pref=getSharedPreferences(context);
        }
        String wd=pref.getString(Constants.WORKDIR,"");
        return workdirStringToFile(wd,context);
    }

    public static SharedPreferences getSharedPreferences(Context ctx){
        return ctx.getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
    }

    public static String getMandatoryParameter(Uri uri, String name)throws Exception{
        String rt=uri.getQueryParameter(name);
        if (rt == null) throw new Exception("missing mandatory parameter "+name);
        return rt;
    }
    public static boolean getFlagParameter(Uri uri, String name,boolean defaultV)throws Exception{
        String rt=uri.getQueryParameter(name);
        if (rt == null || rt.isEmpty()) return defaultV;
        return rt.toLowerCase().equals("true");
    }

    public static JSONObject readJsonFile(File file,long maxBytes) throws Exception {
        if (!file.exists()) throw new Exception("file " + file.getAbsolutePath() + " not found");
        if (file.length() > maxBytes)
            throw new Exception("file " + file.getAbsolutePath() + " too long to read");
        FileInputStream is = new FileInputStream(file);
        byte[] buffer = new byte[(int) (file.length())];
        int rd = is.read(buffer);
        if (rd != file.length())
            throw new Exception("unable to read all bytes for " + file.getAbsolutePath());
        JSONObject rt = new JSONObject(new String(buffer, StandardCharsets.UTF_8));
        return rt;
    }

    public static long toTimeStamp(net.sf.marineapi.nmea.util.Date date, net.sf.marineapi.nmea.util.Time time){
        if (date == null) return 0;
        Calendar cal=Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        cal.set(Calendar.YEAR, date.getYear());
        cal.set(Calendar.MONTH, date.getMonth()-1); //!!! the java calendar counts from 0
        cal.set(Calendar.DAY_OF_MONTH, date.getDay());
        cal.set(Calendar.HOUR_OF_DAY, 0);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        cal.add(Calendar.MILLISECOND, (int) (time.getMilliseconds()));
        long millis=cal.getTime().getTime();
        return millis;
    }

    public static InetAddress getLocalHost() throws UnknownHostException {
        InetAddress local=null;
        try {
            local = Inet4Address.getByName("localhost");
        }catch(Exception ex){
            AvnLog.e("Exception getting localhost: "+ex);
        }
        if (local == null) local=Inet4Address.getLocalHost();
        return local;
    }

    public static interface IJsonObect{
        JSONObject toJson() throws JSONException, UnsupportedEncodingException;
    }

    public static boolean belongsToNet(Inet4Address addr1,Inet4Address addr2,short prefixLen){
        byte [] baddr1=addr1.getAddress();
        byte [] baddr2=addr2.getAddress();
        int iaadr1=(baddr1[0]&0xff) << 24 | (baddr1[1]&0xff) << 16 | (baddr1[2] & 0xff) << 8 | (baddr1[3]&0xff);
        int iaadr2=(baddr2[0]&0xff) << 24 | (baddr2[1]&0xff) << 16 | (baddr2[2] & 0xff) << 8 | (baddr2[3]&0xff);
        int mask = -(1 << (32 - prefixLen));
        return ((iaadr1 & mask) == (iaadr2 & mask));
    }
    public static InetAddress getLocalIpForRemote(InetAddress remote) throws SocketException {
        if (! (remote instanceof Inet4Address)) return null;
        Inet4Address remote4=(Inet4Address)remote;
        Enumeration<NetworkInterface> intfs = NetworkInterface.getNetworkInterfaces();
        while (intfs.hasMoreElements()) {
            NetworkInterface intf = intfs.nextElement();
            for (InterfaceAddress addr:intf.getInterfaceAddresses()){
                InetAddress ip=addr.getAddress();
                if (! (ip instanceof Inet4Address)) continue;
                short plen=addr.getNetworkPrefixLength();
                Inet4Address ip4=(Inet4Address)ip;
                if (belongsToNet(ip4,remote4,plen)){
                    return ip4;
                }
            }
        }
        return null;
    }

    /**
     * get the network for a remote ip address
     * that belongs to one of the networks we are directly connected to
     * it does not consider the routing!
     * only ipv4
     * @param remote the remote ipv4 address
     * @param ctx
     * @return
     * @throws SocketException
     */
    public static Network getNetworkForRemote(InetAddress remote, Context ctx) throws SocketException {
        if (! (remote instanceof Inet4Address)) return null;
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) {
            return null;
        }
        Inet4Address remote4=(Inet4Address)remote;
        Enumeration<NetworkInterface> intfs = NetworkInterface.getNetworkInterfaces();
        while (intfs.hasMoreElements()) {
            NetworkInterface intf = intfs.nextElement();
            for (InterfaceAddress addr:intf.getInterfaceAddresses()){
                InetAddress ip=addr.getAddress();
                if (! (ip instanceof Inet4Address)) continue;
                short plen=addr.getNetworkPrefixLength();
                Inet4Address ip4=(Inet4Address)ip;
                if (belongsToNet(ip4,remote4,plen)){
                    ConnectivityManager connectivityManager=(ConnectivityManager)ctx.getSystemService(Context.CONNECTIVITY_SERVICE);
                    for (Network n:connectivityManager.getAllNetworks()){
                        LinkProperties props=connectivityManager.getLinkProperties(n);
                        if (intf.getName().equals(props.getInterfaceName())){
                            return n;
                        }
                    }
                }
            }
        }
        return null;
    }

    /**
     * calculate the XTE, see avnav_util.py
     * @param start
     * @param end
     * @param current
     * @return
     */
    public static double calcXTE(Location start,Location end,Location current){
        float d13=start.distanceTo(current);
        float w13=start.bearingTo(current);
        float w12=start.bearingTo(end);
        double rt=Math.asin(Math.sin(d13/R)*Math.sin(Math.toRadians(w13)-Math.toRadians(w12)))*R;
        return rt;
    }

    public static double rhumbLineXTE(Location start, Location end, Location current){
        double dstFromBrg = rhumbLineBearing(end,start);
        double dstCurBrg = rhumbLineBearing(end,current);
        double dstCurDst = rhumbLineDistance(end,current);
        double alpha = dstFromBrg - dstCurBrg;
        return dstCurDst * Math.sin(Math.toRadians(alpha));
    }

    public static double XTE(Location start,Location end, Location current,boolean useRhumbLine){
        if (! useRhumbLine){
            return calcXTE(start,end,current);
        }
        return rhumbLineXTE(start,end,current);
    }
    public static final double R=6371000; //app. earth radius

    public static double rhumbLineDistance(Location start, Location end){
        double lat1 = start.getLatitude();
        double lon1 = start.getLongitude();
        double lat2 = end.getLatitude();
        double lon2 = end.getLongitude();
        double lat1r = Math.toRadians(lat1);
        double lat2r = Math.toRadians(lat2);
        double dlatr=lat2r-lat1r;
        double dlonr=Math.toRadians(Math.abs(lon2-lon1));

        //if dLon over 180° take shorter rhumb line across the anti-meridian:
        if (Math.abs(dlonr) > Math.PI) {
            dlonr = (dlonr > 0)?-(2 * Math.PI - dlonr):(2 * Math.PI + dlonr);
        }

        // on Mercator projection, longitude distances shrink
        //by latitude
        //q is the 'stretch factor'
        //q becomes ill - conditioned along E - W line(0 / 0)
        //use empirical tolerance to avoid it(note ε is too small)
        double dcorr = Math.log(Math.tan(lat2r / 2 + Math.PI / 4) / Math.tan(lat1r / 2 + Math.PI / 4));
        double q = (Math.abs(dcorr) > 10e-12)?dlatr / dcorr:Math.cos(lat1r);

        //distance is pythagoras on 'stretched' Mercator projection, √(Δφ² + q²·Δλ²)
        double d = Math.sqrt(dlatr * dlatr + q * q * dlonr * dlonr);  // angular distance in radians
        d = d * R;
        return d;
    }

    public static double distance(Location start,Location end,boolean useRhumbLine){
        if (! useRhumbLine) return start.distanceTo(end);
        else return rhumbLineDistance(start,end);
    }

    public static double rhumbLineBearing(Location start, Location end){
        double clat = start.getLatitude();
        double clon= start.getLongitude();
        double elat= end.getLatitude();
        double elon= end.getLongitude();
        double clatr=Math.toRadians(clat);
        double elatr=Math.toRadians(elat);
        double dlonr=Math.toRadians(elon-clon);
        // if dLon over 180° take shorter rhumb line across the anti-meridian:
        if (Math.abs(dlonr) > Math.PI) {
            dlonr = (dlonr > 0)?-(2 * Math.PI - dlonr):(2 * Math.PI + dlonr);
        }

        double corr=Math.log(Math.tan(elatr / 2 + Math.PI / 4) / Math.tan(clatr / 2 + Math.PI / 4));
        double brg=Math.atan2(dlonr, corr);
        brg=Math.toDegrees(brg);
        return (brg+360)%360.0;
    }
    public static double bearingTo(Location start,Location end, boolean useRhumbLine){
        if (! useRhumbLine) {
            double rt=start.bearingTo(end);
            if (rt < 0) rt=360+rt;
        }
        return rhumbLineBearing(start,end);
    }
    public static double vmg(Location current,double bearingTo){
        if (!current.hasBearing() || ! current.hasSpeed()) return 0;
        return current.getSpeed()*Math.cos(Math.toRadians(bearingTo-current.getBearing()));
    }

    public static class KeyValueList extends ArrayList<KeyValue> {
        public KeyValueList(KeyValue... parameter){
            addAll(Arrays.asList(parameter));
        }
        public JSONObject toJson() throws JSONException {
            JSONObject rt=new JSONObject();
            for (KeyValue kv:this){
                rt.put(kv.key,kv.value);
            }
            return rt;
        }
    }
    public static class KeyValueMap<T> extends HashMap<String,T> {
        public KeyValueMap(KeyValue<T>...parameter){
            for (KeyValue<T> kv:parameter){
                put(kv.key,kv.value);
            }
        }
        JSONObject toJson() throws JSONException {
            JSONObject rt=new JSONObject();
            for (String k:this.keySet()){
                rt.put(k,get(k));
            }
            return rt;
        }
    }

    public static class KeyValue<VT>{
        public String key;
        public VT value;
        public KeyValue(String key, VT v){
            this.key=key;
            this.value=v;
        }
    }

    public static int buildPiFlags(int flags, boolean immutable){
        int rt=flags;
        if (Build.VERSION.SDK_INT >= 31) {
            rt|=immutable? PendingIntent.FLAG_IMMUTABLE:PendingIntent.FLAG_MUTABLE;
        }
        return rt;
    }
}
