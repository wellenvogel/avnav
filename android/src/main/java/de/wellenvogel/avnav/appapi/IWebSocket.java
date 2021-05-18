package de.wellenvogel.avnav.appapi;

import java.io.IOException;

public interface IWebSocket {
    static final int opcodeContinue = 0x0;
    static final int opcodeText = 0x1;
    static final int opcodeBinary = 0x2;
    static final int opcodeClose = 0x8;
    static final int opcodePing = 0x9;
    static final int opcodePong = 0xa;
    String getUrl();
    boolean send(String msg) throws IOException;
    int getId();
    void close(boolean callHandler);
    boolean isOpen();
}
