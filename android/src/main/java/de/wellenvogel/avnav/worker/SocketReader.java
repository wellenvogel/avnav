package de.wellenvogel.avnav.worker;

import android.content.Context;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.net.InetSocketAddress;

import de.wellenvogel.avnav.util.NmeaQueue;

/**
 * Created by andreas on 25.12.14.
 */
public class SocketReader extends SingleConnectionHandler {
    static class Creator extends WorkerFactory.Creator{
        @Override
        ChannelWorker create(String name, Context ctx, NmeaQueue queue) throws JSONException {
            return new SocketReader(name,ctx,queue);
        }
    }


    private SocketReader(String name,Context ctx, NmeaQueue queue) throws JSONException {
        super(name,ctx,queue);
        parameterDescriptions.add(IPADDRESS_PARAMETER);
        parameterDescriptions.add(IPPORT_PARAMETER);
    }

    @Override
    public void run(int startSequence) throws JSONException, IOException {
        String target=IPADDRESS_PARAMETER.fromJson(parameters);
        Integer port=IPPORT_PARAMETER.fromJson(parameters);
        InetSocketAddress address=new InetSocketAddress(target,port);
        IpConnection con=new IpConnection(address);
        runInternal(con,startSequence);
    }
}
