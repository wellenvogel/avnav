package de.wellenvogel.avnav.worker;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Created by andreas on 09.12.17.
 */

public class Alarm {
    public static final String C_INFO="info";
    public static final String C_CRITICAL="critical";
    public String command;
    public int repeat=10000;
    public boolean running=false;
    public String name;
    public String message;
    String category=C_INFO;
    private Alarm(String name,String message,String category){
        this.name=name;
        this.message=message;
        this.category=category;
    }
    private Alarm(String name, String message, String category, int repeat){
        this.name=name;
        this.message=message;
        this.repeat=repeat;
        this.category=category;
    }
    private Alarm copy(){
        Alarm rt=new Alarm(name,message,category,repeat);
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
        rt.put("category",category);
        if (message != null) rt.put("message",message);
        return rt;
    }

    @Override
    public boolean equals(@Nullable Object obj) {
        if (! (obj instanceof Alarm)) return false;
        if (! name.equals(((Alarm)obj).name)) return false;
        return running == ((Alarm)obj).running;
    }

    @NonNull
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
    public static Alarm ANCHOR=new Alarm("anchor","Anchor dragging",C_CRITICAL);
    public static Alarm GPS=new Alarm("gps","GPS lost",C_CRITICAL);
    public static Alarm WAYPOINT=new Alarm("waypoint","Waypoint reached",C_INFO,3);
    public static Alarm MOB=new Alarm("mob","Person over board",C_CRITICAL,2);
    public static Alarm createAlarm(String name){
        if (name == null) return null;
        for (Alarm a: new Alarm[]{ANCHOR,GPS,WAYPOINT,MOB}){
            if (a.name.equals(name)) return a.copy();
        }
        return null;
    }
}
