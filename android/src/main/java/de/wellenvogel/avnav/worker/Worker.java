package de.wellenvogel.avnav.worker;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

import de.wellenvogel.avnav.util.AvnUtil;

public abstract class Worker {
    public static class WorkerStatus implements AvnUtil.IJsonObect {
        WorkerStatus(String name){
            this.name=name;
        }
        WorkerStatus(WorkerStatus other){
            name=other.name;
            canEdit=other.canEdit;
            canDelete=other.canDelete;
            id=other.id;
            name=other.name;
            status=other.status;
            info=other.info;
        }
        boolean canEdit=false;
        boolean canDelete=false;
        boolean disabled=false;
        int id;
        String name;
        public static enum Status{
            INACTIVE,
            STARTED,
            RUNNING,
            NMEA,
            ERROR
        }
        Status status=Status.INACTIVE;
        String info;

        @Override
        public JSONObject toJson() throws JSONException {
            JSONObject rt=new JSONObject();
            rt.put("canEdit",canEdit);
            rt.put("canDelete",canDelete);
            rt.put("disabled",disabled);
            rt.put("id",id);
            rt.put("name",name);
            JSONObject sto=new JSONObject();
            sto.put("name",name);
            //currently we do not have children - but the JS side expects an array
            JSONArray children=new JSONArray();
            JSONObject main=new JSONObject(); //WorkerStatus in python
            main.put("name","main");
            main.put("info",info);
            main.put("status",status.toString());
            children.put(main);
            sto.put("items",children);
            rt.put("info",sto);
            return rt;
        }

    }

    public static class EditableParameter{
        String name;
        enum Type{
            NUMBER,
            FLOAT,
            STRING,
            BOOLEAN,
            LIST
        };
        Type type;
        List<String> list;
        String defaultValue;
        String description;
        EditableParameter(String name,Type type,String description,String defaultValue){
            this.name=name;
            this.type=type;
            this.description=description;
            this.defaultValue=defaultValue;
            if (type == Type.LIST) this.list=new ArrayList<String>();
        }
        EditableParameter(String name,Type type,String description,String defaultValue,List<String> list) throws Exception {
            this.name=name;
            this.type=type;
            this.description=description;
            this.defaultValue=defaultValue;
            if (type != Type.LIST) throw new Exception("list parameter only for type list");
            this.list=list;
        }
        EditableParameter(String name){
            this.name=name;
            this.type=Type.BOOLEAN;
        }
        
    }
    protected WorkerStatus status;

    protected Worker(String name){
        status=new WorkerStatus(name);
    }

    public synchronized WorkerStatus getStatus(){
        return new WorkerStatus(status);
    }

    protected synchronized void setStatus(WorkerStatus.Status status,String info){
        this.status.status=status;
        this.status.info=info;
    }

    /**
     * stop the service and free all resources
     * afterwards the provider will not be used any more
     */
    public void stop(){}
    /**
     * check if the handler is stopped and should be reinitialized
     * @return
     */
    public boolean isStopped(){
        return false;
    }

    /**
     * will be called from a timer in regular intervals
     * should be used to check (e.g. check if provider enabled or socket can be opened)
     */
    public void check(){}
}
