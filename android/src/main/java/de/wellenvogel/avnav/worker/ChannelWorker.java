package de.wellenvogel.avnav.worker;

import android.content.Context;

import org.json.JSONException;

import de.wellenvogel.avnav.util.NmeaQueue;

public abstract class ChannelWorker extends Worker{
    protected Context context;
    protected NmeaQueue queue;
    ChannelWorker(String name, Context ctx, NmeaQueue queue){
        super(name);
        this.context=ctx;
        this.queue=queue;
    }

    /**
     * to be able to add a channel for a newly detected device
     * we can set this at the worker before we call getParameterDescriptions
     * if supported it should also set the real value at the handler
     * @param device
     * @throws JSONException
     */
    public void setDefaultDevice(String device) throws JSONException{}
}
