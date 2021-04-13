package de.wellenvogel.avnav.mdns;

import android.os.Build;
import android.util.Log;

import net.straylightlabs.hola.dns.ARecord;
import net.straylightlabs.hola.dns.Domain;
import net.straylightlabs.hola.dns.Message;
import net.straylightlabs.hola.dns.Record;
import net.straylightlabs.hola.dns.Response;
import net.straylightlabs.hola.dns.SrvRecord;

import java.io.IOException;
import java.lang.reflect.Array;
import java.net.DatagramPacket;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.SocketAddress;
import java.net.StandardProtocolFamily;
import java.net.StandardSocketOptions;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.ByteBuffer;
import java.nio.channels.DatagramChannel;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;

import de.wellenvogel.avnav.util.AvnLog;

import static net.straylightlabs.hola.sd.Query.MDNS_IP4_ADDRESS;
import static net.straylightlabs.hola.sd.Query.MDNS_PORT;

public class Resolver implements Runnable{
    public static final long RETRIGGER_TIME=6000; //6s
    public static final int MAX_RETRIGGER=5;
    private final Callback<Target.ServiceTarget> defaultCallback;

    private static void fillHost(Target.HostTarget host,ARecord record){
        host.address=record.getAddress();
        host.ttl=record.getTTL();
        host.updated=System.currentTimeMillis()*1000;
    }
    static final String LPRFX="InternalReceiver";
    private SocketAddress mdnsGroupIPv4;
    private NetworkInterface intf;
    DatagramChannel channel;

    HashMap<String, Target.HostTarget> resolvedHosts=new HashMap<>();
    public static interface Callback<T extends Target.ResolveTarget>{
        public void resolve(T target);
    }

    static class QRequest<T extends Target.ResolveTarget>{
        String name;
        long requestTime;
        int retries=0;
        T request;
        Callback<T> callback;
        QRequest(T r,Callback<T> callback){
            request=r;
            this.callback=callback;
        }
        boolean expired(long now){
            if ((requestTime+RETRIGGER_TIME) < now) return true;
            return false;
        }
        boolean outdated(){
            return retries > MAX_RETRIGGER;
        }
    }

    final HashSet<QRequest<Target.ServiceTarget>> openRequests=new HashSet<>();
    final HashSet<QRequest<Target.HostTarget>> openHostRequests=new HashSet<>();

    public Resolver(NetworkInterface intf, Callback<Target.ServiceTarget> defaultCallback) throws IOException {
        this.intf=intf;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && intf != null) {
            channel =DatagramChannel.open(StandardProtocolFamily.INET);
            channel.setOption(StandardSocketOptions.IP_MULTICAST_IF,intf);
        }
        else{
            channel =DatagramChannel.open();
        }
        //without this bind we continously receive 0 length packages (most probably until we send)
        channel.socket().bind(new InetSocketAddress(Inet4Address.getByName("0.0.0.0"),0));
        mdnsGroupIPv4 = new InetSocketAddress(InetAddress.getByName(MDNS_IP4_ADDRESS),MDNS_PORT);
        this.defaultCallback=defaultCallback;
    }


    private abstract class Retrigger<T extends Target.ResolveTarget>{
        final HashSet<QRequest<T>> queue;
        Retrigger(HashSet<QRequest<T>> queue){
            this.queue=queue;
        }
        void run(){
            long now=System.currentTimeMillis();
            ArrayList<QRequest<T>> outdated=new ArrayList<>();
            synchronized (queue) {
                for (QRequest<T> r : queue) {
                    if (r.expired(now)) {
                        if (!r.outdated()) {
                            Log.i(LPRFX, "retrigger query for " + r.name);
                            try {
                                resolve(r.request);
                            }catch(Throwable t){
                                AvnLog.dfs("error when trying to retrigger: %s",t);
                            }
                            r.requestTime = now;
                            r.retries++;
                        } else {
                            outdated.add(r);
                        }
                    }
                }
            }
            for (QRequest<T> sr:outdated){
                openRequests.remove(sr);
            }
        }
        protected abstract void resolve(T r) throws IOException;
    }

    public void checkRetrigger(){
        (new Retrigger<Target.HostTarget>(openHostRequests) {
            @Override
            protected void resolve(Target.HostTarget r) throws IOException {
                Resolver.this.resolve(r);
            }
        }).run();
        (new Retrigger<Target.ServiceTarget>(openRequests) {
            @Override
            protected void resolve(Target.ServiceTarget r) throws IOException {
                Resolver.this.resolve(r);
            }
        }).run();

    }

    public static Resolver createResolver(NetworkInterface intf, Callback<Target.ServiceTarget> defaultCallback) throws IOException {
        Resolver r=new Resolver(intf,defaultCallback);
        Thread thr=new Thread(r);
        thr.setDaemon(true);
        thr.start();
        return r;
    }

    static String hostnameFromMdns(String mdnsName){
        if (mdnsName == null) return null;
        if (mdnsName.endsWith(".")) return mdnsName.substring(0,mdnsName.length()-1);
        return mdnsName;
    }
    static String getNameFromSrv(SrvRecord srv, String type){
        //must have checked type before...
        String suffix=type+Domain.LOCAL.getName();
        return srv.getName().substring(0,srv.getName().length()-suffix.length()-1);
    }
    static String getTypeFromSrv(SrvRecord srv){
        String suffix=Domain.LOCAL.getName();
        String nameAndType=srv.getName().substring(0,srv.getName().length()-suffix.length()-1);
        if (nameAndType.endsWith(".")) nameAndType=nameAndType.substring(0,nameAndType.length()-1);
        String [] parts=nameAndType.split("\\.");
        if (parts.length >= 2){
            return parts[parts.length-2]+"."+parts[parts.length-1]+".";
        }
        return "";
    }
    private class HostAvailableResolver<T extends Target.ResolveTarget>{
        void resolve(HashSet<QRequest<T>> list, HashMap<String, Target.HostTarget> resolved) throws URISyntaxException {
            ArrayList<QRequest<T>> finished=new ArrayList<>();
            synchronized (list) {
                for (QRequest<T> r : list) {
                    String name = hostnameFromMdns(r.request.getHostName());
                    if (name == null) continue;
                    Target.HostTarget resolvedHost = resolved.get(name);
                    if (resolvedHost != null) {
                        r.request.setAddress(resolvedHost.address,intf);
                        if (r.request.isResolved()) {
                            finished.add(r);
                        }
                    }
                }
                for (QRequest<T> r:finished){
                    list.remove(r);
                }
            }
            for (QRequest<T> r:finished){
                if (r.callback != null)
                r.callback.resolve(r.request);
            }
        }
    }
    @Override
    public void run() {
        while (channel.isOpen()){
            ByteBuffer responseBuffer = ByteBuffer.allocate(Message.MAX_LENGTH);
            try {
                SocketAddress addr=channel.receive(responseBuffer);
                if (addr == null){
                    continue;
                }
                responseBuffer.flip();
                byte[] bytes = new byte[responseBuffer.limit()];
                responseBuffer.get(bytes, 0, responseBuffer.limit());
                DatagramPacket responsePacket=new DatagramPacket(bytes,bytes.length);
                Response resp=Response.createFrom(responsePacket);
                Log.i(LPRFX,"response: "+resp);
                boolean hasA=false;
                for (Record record : resp.getRecords()){
                    if (record instanceof ARecord){
                        hasA=true;
                        String name=hostnameFromMdns(record.getName());
                        Target.HostTarget host=new Target.HostTarget(name);
                        fillHost(host,(ARecord)record);
                        resolvedHosts.put(name,host);
                    }
                }
                if (hasA){
                    (new HostAvailableResolver<Target.ServiceTarget>()).resolve(openRequests,resolvedHosts);
                    (new HostAvailableResolver<Target.HostTarget>()).resolve(openHostRequests,resolvedHosts);

                }
                for (Record record:resp.getRecords()){
                    if (record instanceof SrvRecord){
                        SrvRecord srv=(SrvRecord)record;
                        String serviceType=getTypeFromSrv(srv);
                        String serviceName=getNameFromSrv(srv,serviceType);
                        QRequest<Target.ServiceTarget> request=null;
                        synchronized (openRequests) {
                            for (QRequest<Target.ServiceTarget> r : openRequests) {
                                if (r.request.name.equals(serviceName) && r.request.type.equals(serviceType)){
                                    request=r;
                                    break;
                                }
                            }
                            if (request == null){
                                request=new QRequest<Target.ServiceTarget>(new Target.ServiceTarget(serviceType,serviceName),defaultCallback);
                                openRequests.add(request);
                            }
                            request.request.host=hostnameFromMdns(srv.getTarget());
                            request.request.port=srv.getPort();
                            Target.HostTarget host=resolvedHosts.get(request.request.host);
                            if (host != null) request.request.setAddress(host.address,intf);
                        }
                    }
                }
                //now check if we can resolve service requests
                ArrayList<QRequest<Target.ServiceTarget>> finished=new ArrayList<>();
                synchronized (openRequests){
                    for (QRequest<Target.ServiceTarget> r:openRequests){
                        if (r.request.isResolved()){
                            finished.add(r);
                        }
                    }
                    for (QRequest<Target.ServiceTarget> r:finished){
                        openRequests.remove(r);
                    }
                }
                for (QRequest<Target.ServiceTarget> r:finished){
                    if (r.callback != null){
                        r.callback.resolve(r.request);
                    }
                    //TODO: default callback
                }
            } catch (Throwable e) {
                Log.e(LPRFX,"exception in receive",e);
            }
        }
        Log.i(LPRFX,"resolver thread finished");
    }

    private Question serviceQuestion(String name,String type){
        return new Question(name+"."+type+Domain.LOCAL.getName(), Question.QType.SRV, Question.QClass.IN);
    }
    private Question hostQuestion(String name){
        return new Question(name, net.straylightlabs.hola.dns.Question.QType.A, net.straylightlabs.hola.dns.Question.QClass.IN);
    }
    private void resolve(Target.ServiceTarget service) throws IOException {
        Question q= serviceQuestion(service.name,service.type);
        sendQuestion(q);
    }
    private void resolve(Target.HostTarget host) throws IOException {
        Question q= hostQuestion(host.name);
        sendQuestion(q);
    }

    public void resolve(Target.ServiceTarget target, Callback<Target.ServiceTarget> callback, boolean force) throws IOException {
        QRequest<Target.ServiceTarget> r=new QRequest<>(target,callback);
        synchronized (openRequests){
            openRequests.add(r);
        }
        resolve(r.request);
    }

    public void resolve(Target.HostTarget target, Callback<Target.HostTarget> callback, boolean forceNew) throws IOException {
        if (! forceNew){
            Target.HostTarget h=resolvedHosts.get(target.name);
            if (h!=null && callback != null) {
                callback.resolve(h);
                return;
            }

        }
        QRequest<Target.HostTarget> request=new QRequest<>(target,callback);
        synchronized (openHostRequests){
            openHostRequests.add(request);
        }
        resolve(request.request);
    }

    public void sendQuestion(Question question) throws IOException {
        ByteBuffer buffer = question.getBuffer();
        buffer.flip();
        channel.send(buffer,mdnsGroupIPv4);
    }

    private static class CancelResolver<T extends Target.ResolveTarget>{
        void resolve(HashSet<QRequest<T>> list){
            ArrayList<QRequest<T>> finished=new ArrayList<>();
            synchronized (list) {
                for (QRequest<T> r : list) {
                    if (r.callback != null) r.callback.resolve(r.request);
                }
            }
        }
    }
    public void stop() throws IOException {
        channel.close();
        (new CancelResolver<Target.ServiceTarget>()).resolve(openRequests);
        (new CancelResolver<Target.HostTarget>()).resolve(openHostRequests);
        openRequests.clear();
        openHostRequests.clear();
    }
}
