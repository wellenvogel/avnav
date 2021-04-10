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
}
