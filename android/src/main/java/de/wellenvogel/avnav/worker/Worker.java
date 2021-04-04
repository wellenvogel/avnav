package de.wellenvogel.avnav.worker;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.util.NmeaQueue;

public abstract class Worker {
    static final EditableParameter.StringParameter FILTER_PARAM=
            new EditableParameter.StringParameter("filter","an NMEA filter, use e.g. $RMC or ^$RMC, !AIVDM","");
    static final EditableParameter.StringParameter SEND_FILTER_PARAM=
            new EditableParameter.StringParameter("sendFilter","an NMEA filter for send, use e.g. $RMC or ^$RMC, !AIVDM","");
    static final EditableParameter.BooleanParameter SEND_DATA_PARAMETER=
            new EditableParameter.BooleanParameter("sendOut","send out NMEA on this connection",false);
    static final EditableParameter.BooleanParameter ENABLED_PARAMETER=
            new EditableParameter.BooleanParameter("enabled","enabled",true);
    static final EditableParameter.StringParameter IPADDRESS_PARAMETER=
            new EditableParameter.StringParameter("ipaddress","ip address to connect",null);
    static final EditableParameter.IntegerParameter IPPORT_PARAMETER=
            new EditableParameter.IntegerParameter("port","ip port to connect",null);
    static final EditableParameter.StringParameter SOURCENAME_PARAMETER=
            new EditableParameter.StringParameter("source Name","name of this data source","");
    static final EditableParameter.StringListParameter BAUDRATE_PARAMETER=
            new EditableParameter.StringListParameter("baud rate","serial baud rate","9600",
                    "1200","2400","4800","9600","14400","19200","28800","38400","57600","115200","230400");
    static final EditableParameter.IntegerParameter TIMEOFFSET_PARAMETER=
            new EditableParameter.IntegerParameter("timeOffset","timeOffset(s)",0);


    abstract static class WorkerCreator{
        protected String name;
        WorkerCreator(String name){
            this.name=name;
        }
        abstract Worker create(Context ctx, NmeaQueue queue) throws JSONException, IOException;
        boolean canAdd(){return true;}
    }


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

    protected WorkerStatus status;
    protected JSONObject parameters=new JSONObject();
    protected EditableParameter.ParameterList parameterDescriptions=new EditableParameter.ParameterList();
    protected int paramSequence=0;

    protected Worker(String name){
        status=new WorkerStatus(name);
    }
    protected String getSourceName(){
        String n=null;
        try {
            n=SOURCENAME_PARAMETER.fromJson(parameters);
        } catch (JSONException e) {
        }
        if (n == null || n.isEmpty()) return status.name;
        return n;
    }

    public synchronized WorkerStatus getStatus(){
        return new WorkerStatus(status);
    }

    protected synchronized void setStatus(WorkerStatus.Status status,String info){
        this.status.status=status;
        this.status.info=info;
    }
    public synchronized void setId(int id){
        status.id=id;
    }
    public synchronized int getId(){
        return status.id;
    }
    public synchronized JSONObject getEditableParameters(boolean includeCurrent) throws JSONException {
        JSONObject rt=new JSONObject();
        if (parameterDescriptions != null) rt.put("data",parameterDescriptions.toJson());
        if (includeCurrent) rt.put("values",parameters!=null?parameters:new JSONObject());
        rt.put("configName",status.name);
        rt.put("canDelete",status.canDelete);
        return rt;
    }

    public synchronized void setParameters(JSONObject newParam) throws JSONException {
        if (parameterDescriptions == null) throw new JSONException("no parameters defined");
        parameterDescriptions.check(newParam);
        parameters=newParam;
        paramSequence++;
    }

    public abstract void run() throws JSONException, IOException;

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
    public void check() throws JSONException {}
}
