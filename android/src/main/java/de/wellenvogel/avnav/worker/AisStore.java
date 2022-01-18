package de.wellenvogel.avnav.worker;

import android.location.Location;
import android.util.Log;
import de.wellenvogel.avnav.aislib.messages.message.*;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

/**
 * Created by andreas on 28.12.14.
 */
public class AisStore {
    private int ownMmsi=0;
    public AisStore(String ownMmsi){
        if (ownMmsi != null && ! ownMmsi.isEmpty()){
            try {
                this.ownMmsi = Integer.parseInt(ownMmsi);
            }catch (Exception e){
                AvnLog.e("unable to set own MMSI from "+ownMmsi+": "+e);
            }
        }
    }
    private HashMap<Integer,JSONObject> aisData=new HashMap<Integer, JSONObject>();
    private static final int HANDLED_MESSAGES[]=new int[]{1,2,3,5,18,19,24};
    private static final String MERGE_FIELDS[]=new String[]{"imo_id","callsign","shipname","shiptype","destination"};
    private static final String LOGPRFX="Avnav.AisStore";

    private boolean isHandledMessage(AisMessage msg){
        for (int i:HANDLED_MESSAGES){
            if (msg.getMsgId() == i){
                return true;
            }
        }
        return false;
    }
    public synchronized void addAisMessage(AisMessage msg){
        if (! isHandledMessage(msg)){
            AvnLog.i(LOGPRFX,"ignore AIS message "+msg);
            return;
        }
        JSONObject o=objectFromMessage(msg);
        if (o == null){
            AvnLog.i(LOGPRFX,"unable to convert AIS message "+msg);
            return;
        }
        try {
            int mmsi=o.getInt("mmsi");
            if (mmsi == 0){
                AvnLog.i(LOGPRFX,"ignore invalid message with mmsi 0");
                return;
            }
            if (mmsi == ownMmsi){
                AvnLog.i("ignoring own MMSI "+mmsi);
                return;
            }
            int type=msg.getMsgId();
            JSONObject old=aisData.get(mmsi);
            if (old != null){
                if (type == 5 || type == 24){
                    //merge fields
                    for (String mf:MERGE_FIELDS){
                        Object nv=o.opt(mf);
                        if (nv != null){
                            old.put(mf,nv);
                        }
                    }
                }
                else{
                    for (String mf:MERGE_FIELDS){
                        Object ov=old.opt(mf);
                        if (ov != null){
                            o.put(mf,ov);
                        }
                    }
                    aisData.put(mmsi,o);
                }
            }
            else{
                AvnLog.d(LOGPRFX, "store new message type " + type + " for mmsi" + mmsi);
                aisData.put(mmsi,o);
            }
        } catch (JSONException e) {
            e.printStackTrace();
        }
    }

    public static JSONObject objectFromMessage(AisMessage msg){
        JSONObject rt=null;
        try {
            switch (msg.getMsgId()) {
                case 1:
                case 2:
                case 3: {
                    AisPositionMessage m = (AisPositionMessage) msg;
                    rt = new JSONObject();
                    rt.put("mmsi", m.getUserId());
                    rt.put("lon", m.getPos().getLongitudeDouble());
                    rt.put("lat", m.getPos().getLatitudeDouble());
                    rt.put("status", m.getNavStatus());
                    rt.put("speed", m.getSog());
                    rt.put("course", m.getCog());
                    break;
                }
                case 5:
                case 24:
                {
                    AisStaticCommon m = (AisStaticCommon) msg;
                    rt = new JSONObject();
                    rt.put("mmsi", m.getUserId());
                    rt.put("callsign", m.getCallsign()!=null?m.getCallsign().replaceAll("@*$",""):"");
                    rt.put("shipname", m.getName()!=null?m.getName().replaceAll("@*$",""):"");
                    rt.put("shiptype", m.getShipType());
                    if (msg.getMsgId() == 5) {
                        AisMessage5 m5=(AisMessage5)msg;
                        rt.put("imo_id", m5.getImo());
                        rt.put("destination", m5.getDest()!=null?m5.getDest().replaceAll("@*$",""):"");
                    }
                    break;
                }
                case 18:
                case 19:{
                    IVesselPositionMessage m = (IVesselPositionMessage) msg;
                    rt = new JSONObject();
                    rt.put("mmsi", msg.getUserId());
                    rt.put("lon", m.getPos().getLongitudeDouble());
                    rt.put("lat", m.getPos().getLatitudeDouble());
                    rt.put("speed", m.getSog());
                    rt.put("course", m.getCog());
                    break;
                }

            }
            if (rt != null){
                rt.put("type",msg.getMsgId());
                rt.put("rtime", System.currentTimeMillis());
            }
        }catch (Exception e){
            Log.w(LOGPRFX,"exception while json encoding AIS message "+e.getLocalizedMessage());
            e.printStackTrace();
        }
        return rt;
    }

    private JSONObject convertEntry(JSONObject in) throws JSONException {
        JSONObject rt=new JSONObject();
        for (Iterator<String> i=in.keys();i.hasNext();){
            String k=i.next();
            if (k.equals("speed")){
                rt.put(k,in.getInt(k)/10);
            }
            else if (k.equals("course")){
                rt.put(k,in.getInt(k)/10);
            }
            else if (k.equals("mmsi")){
                rt.put(k,in.getInt(k)+"");
            }
            else if (k.equals("rtime")){
                continue;
            }
            else{
                rt.put(k,in.get(k));
            }
        }
        return rt;
    }

    /**
     *
     * @param lat
     * @param lon
     * @param distance
     * @return
     */
    public synchronized JSONArray getAisData(double lat,double lon,double distance){
        JSONArray rt=new JSONArray();
        Location myLoc=new Location((String)null);
        myLoc.setLongitude(lon);
        myLoc.setLatitude(lat);
        distance=distance* AvnUtil.NM; //in distance is in NM
        AvnLog.d(LOGPRFX,"getAisData dist="+distance);
        for(JSONObject o:aisData.values()){
            if (! o.has("lat") || ! o.has("lon")) continue;
            JSONObject cv=null;
            try {
                cv=convertEntry(o);
                if (distance != 0) {
                    Location aloc = new Location((String) null);
                    aloc.setLatitude(cv.getDouble("lat"));
                    aloc.setLongitude(cv.getDouble("lon"));
                    double dist = aloc.distanceTo(myLoc);
                    if (dist > distance) {
                        AvnLog.d(LOGPRFX, "omitting ais " + cv.toString() + " distance=" + dist);
                        continue;
                    }
                }
            } catch (JSONException e) {
                e.printStackTrace();
            }
            if (cv == null) continue;
            rt.put(cv);
        }
        AvnLog.d(LOGPRFX,"getAisData returns "+rt.length()+" values");
        return rt;
    }

    public synchronized void cleanup(long lifetime){
        long cleanupTime=System.currentTimeMillis()-lifetime*1000;
        Iterator<Map.Entry<Integer,JSONObject>> it=aisData.entrySet().iterator();
        while (it.hasNext()){
            Map.Entry<Integer,JSONObject>et=it.next();
            try {
                long etime=et.getValue().getLong("rtime");
                if (etime < cleanupTime){
                    AvnLog.d(LOGPRFX,"cleanup outdated entry for "+et.getKey());
                    it.remove();
                }
            } catch (Exception e) {
                Log.e(LOGPRFX,"exception during AIS cleanup "+e.getLocalizedMessage());
            }
        }
    }
    public synchronized void clear(){
        aisData.clear();
    }

    public int numAisEntries(){
        return aisData.size();
    }
}
