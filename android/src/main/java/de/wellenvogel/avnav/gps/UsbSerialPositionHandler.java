package de.wellenvogel.avnav.gps;

import android.content.Context;

import java.io.IOException;
import java.io.InputStream;
import java.net.InetSocketAddress;

/**
 * Created by andreas on 25.12.14.
 */
public class UsbSerialPositionHandler extends SocketPositionHandler {

    static private class UsbSerialSocket extends AbstractSocket{
        UsbSerialSocket(){
            super();
        }
        @Override
        public void connect() throws IOException {
            super.connect();
        }

        @Override
        public InputStream getInputStream() throws IOException {
            return super.getInputStream();
        }

        @Override
        public void close() throws IOException {
            super.close();
        }

        @Override
        public String getId() {
            return "USBSerial";
        }
    }

    UsbSerialPositionHandler(Context ctx, InetSocketAddress address, Properties prop){
        super("UsbSerialPositionHandler",ctx,new UsbSerialSocket(),prop);
    }

    @Override
    public String getName() {
        return "IP";
    }
}
