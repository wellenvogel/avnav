package de.wellenvogel.avnav.worker;

import android.content.Context;

import org.json.JSONException;

import java.net.InetSocketAddress;

import de.wellenvogel.avnav.util.NmeaQueue;

/**
 * Created by andreas on 25.12.14.
 */
public class SocketReader extends ConnectionHandler {

    SocketReader(Context ctx, NmeaQueue queue) throws JSONException {
        super("SocketReader",ctx,queue);
        parameterDescriptions.add(IPADDRESS_PARAMETER);
        parameterDescriptions.add(IPPORT_PARAMETER);
    }

    @Override
    public void run() throws JSONException {
        String target=IPADDRESS_PARAMETER.fromJson(parameters);
        InetSocketAddress address=new InetSocketAddress(target,IPPORT_PARAMETER.fromJson(parameters));
        IpConnection con=new IpConnection(address);
        runInternal(con);
    }
}
