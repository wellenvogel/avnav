package de.wellenvogel.avnav.gps;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Created by andreas on 09.12.17.
 */

public class Alarm {
    public String command;
    public int repeat=1;
    public String url;
    public boolean running=false;
    public String name;
    private Alarm(String name){
        this.name=name;
    }
    public JSONObject toJson() throws JSONException {
        JSONObject rt=new JSONObject();
        rt.put("alarm",name);
        rt.put("command",command!=null?command:"");
        rt.put("repeat",repeat+"");
        rt.put("running",running);
        rt.put("url",url!=null?url:"");
        return rt;
    }
    public String toString(){
        StringBuilder rt=new StringBuilder();
        rt.append("Alarm: name=").append(name);
        rt.append(", running=").append(running);
        rt.append(", url=").append(url!=null?url:"");
        if (command != null){
            rt.append(", command=").append(command);
            rt.append(", repeat=").append(repeat);
        }
        return rt.toString();
    }
    public static Alarm ANCHOR=new Alarm("anchor");
    public static Alarm GPS=new Alarm("gps");
    public static Alarm createAlarm(String name){
        if (name == null) return null;
        for (Alarm a: new Alarm[]{ANCHOR,GPS}){
            if (a.name.equals(name)) return new Alarm(name);
        }
        return null;
    }
}
