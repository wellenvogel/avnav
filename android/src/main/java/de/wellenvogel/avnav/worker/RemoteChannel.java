package de.wellenvogel.avnav.worker;

import org.json.JSONException;

import java.io.IOException;
import java.util.HashSet;

import de.wellenvogel.avnav.appapi.IWebSocket;
import de.wellenvogel.avnav.appapi.IWebSocketHandler;
import de.wellenvogel.avnav.appapi.RequestHandler;
import de.wellenvogel.avnav.util.AvnLog;

public class RemoteChannel extends Worker implements IWebSocketHandler {
    final HashSet<IWebSocket> clients=new HashSet<>();
    protected RemoteChannel(String typeName, GpsService ctx) {
        super(typeName, ctx);
        parameterDescriptions.addParams(ENABLED_PARAMETER);
        status.canEdit=true;
    }

    private static String channelFromWs(IWebSocket socket){
        String url=socket.getUrl();
        if (! url.startsWith("/"+ RequestHandler.TYPE_REMOTE)) return null;
        url=url.substring(RequestHandler.TYPE_REMOTE.length()+2);
        url=url.replaceAll("[^0-9]*","");
        if (url.isEmpty()) return null;
        return url;
    }

    private void closeAll(){
        synchronized (clients){
            for (IWebSocket socket:clients){
                socket.close(false);
            }
            clients.clear();
        }
    }
    @Override
    protected void run(int startSequence) throws JSONException, IOException {
        while (! shouldStop(startSequence)){
            sleep(1000);
        }
        closeAll();
    }

    @Override
    public void check() throws JSONException {
        super.check();
        HashSet<IWebSocket> current=null;
        synchronized (clients){
            current=new HashSet<>(clients);
            for (IWebSocket socket:current) {
                if (!socket.isOpen()) clients.remove(socket);
            }
        }
    }

    @Override
    public void onReceive(String msg, IWebSocket socket) {
        try {
            if (! ENABLED_PARAMETER.fromJson(parameters)) return;
        } catch (JSONException e) {
            return;
        }
        String channel=channelFromWs(socket);
        if (channel == null) return;
        AvnLog.ifs("remote message %s",msg);
        synchronized (clients){
            for (IWebSocket target:clients){
                if (target.getId() == socket.getId()) continue;
                if (! channel.equals(channelFromWs(target))) continue;
                try {
                    target.send(msg);
                } catch (IOException e) {
                    AvnLog.dfs("error sending message %s to client %d",msg,target.getId());
                }
            }
        }
    }

    @Override
    public void onConnect(IWebSocket socket) {
        AvnLog.dfs("added new client %d",socket.getId());
        String channel=channelFromWs(socket);
        if (channel == null){
            AvnLog.e("invalid remote channel request "+socket.getUrl());
            try{
                socket.close(false);
            }catch (Throwable t){}
            return;
        }
        synchronized (clients){
            clients.add(socket);
        }
    }

    @Override
    public void onClose(IWebSocket socket) {
        synchronized (clients){
            clients.remove(socket);
        }
    }

    @Override
    public void onError(String error, IWebSocket socket) {
        AvnLog.e("error on remote channel: "+error);
        socket.close(false);
        synchronized (clients){
            clients.remove(socket);
        }
    }
}
