package de.wellenvogel.avnav.worker;

import android.content.Context;

import java.net.InetSocketAddress;

import de.wellenvogel.avnav.util.NmeaQueue;

/**
 * Created by andreas on 25.12.14.
 */
public class IpPositionHandler extends SocketPositionHandler {

    IpPositionHandler(Context ctx, InetSocketAddress address, Properties prop, NmeaQueue queue){
        super("IpPositionHandler",ctx,new AbstractSocket(address,prop.connectTimeout),prop,queue);
    }

    @Override
    public String getName() {
        return "IP";
    }
}
