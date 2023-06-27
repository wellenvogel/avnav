package de.wellenvogel.avnav.worker;

import androidx.annotation.Nullable;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Created by andreas on 09.12.17.
 */

public class Alarm {
    public String command;
    public int repeat=10000;
    public boolean running=false;
    public String name;
    private Alarm(String name){
        this.name=name;
    }
    private Alarm(String name, int repeat){
        this.name=name;
        this.repeat=repeat;
    }
    private Alarm copy(){
        Alarm rt=new Alarm(name,repeat);
        rt.command=command;
        return rt;
    }
    public boolean isPlaying=false;
    public JSONObject toJson() throws JSONException {
        JSONObject rt=new JSONObject();
        rt.put("alarm",name);
        rt.put("command",command!=null?command:"");
        rt.put("repeat",repeat+"");
        rt.put("running",running);
        return rt;
    }

    @Override
    public boolean equals(@Nullable Object obj) {
        if (! (obj instanceof Alarm)) return false;
        if (! name.equals(((Alarm)obj).name)) return false;
        return running == ((Alarm)obj).running;
    }

    public String toString(){
        StringBuilder rt=new StringBuilder();
        rt.append("Alarm: name=").append(name);
        rt.append(", running=").append(running);
        if (command != null){
            rt.append(", command=").append(command);
            rt.append(", repeat=").append(repeat);
        }
        return rt.toString();
    }
    public static Alarm ANCHOR=new Alarm("anchor");
    public static Alarm GPS=new Alarm("gps");
    public static Alarm WAYPOINT=new Alarm("waypoint",3);
    public static Alarm MOB=new Alarm("mob",2);
    public static Alarm createAlarm(String name){
        if (name == null) return null;
        for (Alarm a: new Alarm[]{ANCHOR,GPS,WAYPOINT,MOB}){
            if (a.name.equals(name)) return a.copy();
        }
        return null;
    }
}
