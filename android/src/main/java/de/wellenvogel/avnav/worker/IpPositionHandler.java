package de.wellenvogel.avnav.worker;

import android.content.Context;

import java.net.InetSocketAddress;

/**
 * Created by andreas on 25.12.14.
 */
public class IpPositionHandler extends SocketPositionHandler {

    IpPositionHandler(Context ctx, InetSocketAddress address, Properties prop){
        super("IpPositionHandler",ctx,new AbstractSocket(address,prop.connectTimeout),prop);
    }

    @Override
    public String getName() {
        return "IP";
    }
}
