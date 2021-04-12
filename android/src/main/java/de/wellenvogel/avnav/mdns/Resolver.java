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
    static final String SERVICE_TYPE="_http._tcp";
    static class Host{
        InetAddress address;
        String name;
        long ttl;
        long updated;
        public Host(String name, InetAddress address,long ttl){
            updated=System.currentTimeMillis()*1000;
            this.ttl=ttl;
            this.name=name;
            this.address=address;
        }
        public Host(ARecord record){
            this(record.getName(),record.getAddress(),record.getTTL());
        }
    }
    static final String LPRFX="InternalReceiver";
    static final String SUFFIX=SERVICE_TYPE+Domain.LOCAL.getName();
    ResolveCallback resolveCallback;
    private SocketAddress mdnsGroupIPv4;
    private NetworkInterface intf;
    DatagramChannel channel;
    HashMap<String,Host> hostAddresses=new HashMap<>();
    HashSet<SrvRecord> waitingServices=new HashSet<>();
    public static interface ResolveCallback{
        public void resolve(Target target);
    }
    public static interface ResolveHostCallback{
        public void resolve(String name,InetAddress host);
    }
    static class ServiceRequest{
        String name;
        long requestTime;
        int retries=0;
        ServiceRequest(String name){
            this.name=name;
            requestTime=System.currentTimeMillis();
        }
        boolean expired(long now){
            if ((requestTime+RETRIGGER_TIME) < now) return true;
            return false;
        }
    }
    final HashSet<ServiceRequest> openRequests=new HashSet<>();
    static class HostRequest{
        String name;
        long requestTime;
        int retries=0;
        ResolveHostCallback callback;
        InetAddress address;
        HostRequest(String name,ResolveHostCallback callback){
            this.name=name;
            requestTime=System.currentTimeMillis();
            this.callback=callback;
        }
        boolean expired(long now){
            if ((requestTime+RETRIGGER_TIME) < now) return true;
            return false;
        }
    }
    final HashSet<HostRequest> openHostRequests=new HashSet<>();

    public Resolver(ResolveCallback resolveCallback, NetworkInterface intf) throws IOException {
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
        this.resolveCallback = resolveCallback;
    }

    public void checkRetrigger(){
        long now=System.currentTimeMillis();
        synchronized (openRequests){
            ArrayList<ServiceRequest> outdated=new ArrayList<>();
            for (ServiceRequest r:openRequests){
                if (r.expired(now)){
                    if( r.retries < MAX_RETRIGGER) {
                        Log.i(LPRFX, "retrigger query for " + r.name);
                        resolveService(r.name, false);
                        r.requestTime = now;
                        r.retries++;
                    }
                    else{
                        outdated.add(r);
                    }
                }
            }
            for (ServiceRequest sr:outdated){
                openRequests.remove(sr);
            }
        }
        synchronized (openHostRequests){
            ArrayList<HostRequest> outdated=new ArrayList<>();
            for (HostRequest r:openHostRequests){
                if (r.expired(now)){
                    if (r.retries < MAX_RETRIGGER) {
                        Log.i(LPRFX, "retrigger query for " + r.name);
                        resolveHost(r.name, null, true);
                        r.requestTime = now;
                        r.retries++;
                    }
                    else{
                        outdated.add(r);
                    }
                }
            }
            for (HostRequest hr:outdated){
                openHostRequests.remove(hr);
            }
        }
    }

    public static Resolver createResolver(ResolveCallback callback, NetworkInterface intf) throws IOException {
        Resolver r=new Resolver(callback,intf);
        Thread thr=new Thread(r);
        thr.setDaemon(true);
        thr.start();
        return r;
    }
    private void sendResolved(SrvRecord srv, Host host){
        Target target=new Target();
        target.name=srv.getName().substring(0,srv.getName().length()-SUFFIX.length()-1);
        target.host=srv.getTarget();
        target.intf=intf;
        synchronized (openRequests){
            ArrayList<ServiceRequest> finished=new ArrayList<>();
            for (ServiceRequest r:openRequests){
                if (r.name.equals(target.name)) finished.add(r);
            }
            for (ServiceRequest r: finished){
                openRequests.remove(r);
            }
        }
        try {
            target.uri = new URI("http", null, host.address.getHostAddress(), srv.getPort(), null, null, null);
            Log.i(LPRFX, "resolve success for " + target.name+" "+target.uri);
            resolveCallback.resolve(target);
        } catch (URISyntaxException e) {
            Log.e(LPRFX, e.getMessage());
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
                        hostAddresses.put(record.getName(),new Host((ARecord)record));
                    }
                }
                if (hasA){
                    ArrayList<SrvRecord> resolved=new ArrayList<>();
                    for (SrvRecord record:waitingServices){
                        Host host=hostAddresses.get(record.getTarget());
                        if (host != null){
                            sendResolved(record,host);
                            resolved.add(record);
                        }
                    }
                    for (SrvRecord record:resolved){
                        waitingServices.remove(record);
                    }
                    ArrayList<HostRequest> resolvedHosts=new ArrayList<>();
                    synchronized (openHostRequests){
                        for (HostRequest hr:openHostRequests){
                            Host h=hostAddresses.get(hr.name+".");
                            if (h != null){
                                hr.address=h.address;
                                resolvedHosts.add(hr);
                            }
                        }
                        for (HostRequest hr:resolvedHosts){
                            openHostRequests.remove(hr);
                        }
                    }
                    for (HostRequest hr:resolvedHosts){
                        try {
                            hr.callback.resolve(hr.name, hr.address);
                        }catch (Throwable t){
                            AvnLog.e("error in host resolve callback for "+hr.name,t);
                        }
                    }
                }
                for (Record record:resp.getRecords()){
                    if (record instanceof SrvRecord){
                        SrvRecord srv=(SrvRecord)record;
                        Host host=hostAddresses.get(srv.getTarget());
                        if (host != null){
                            sendResolved(srv,host);
                        }
                        else{
                            waitingServices.add(srv);
                            Question q=hostQuestion(srv.getTarget());
                            try{
                                sendQuestion(q);
                            }catch (Exception e){
                                Log.e(LPRFX,"exception when sending aquery",e);
                            }

                        }
                    }
                }
            } catch (Throwable e) {
                Log.e(LPRFX,"exception in receive",e);
            }
        }
        Log.i(LPRFX,"resolver thread finished");
    }

    private Question serviceQuestion(String name){
        return new Question(name+"."+SUFFIX, Question.QType.SRV, Question.QClass.IN);
    }
    private Question hostQuestion(String name){
        return new Question(name, net.straylightlabs.hola.dns.Question.QType.A, net.straylightlabs.hola.dns.Question.QClass.IN);
    }
    public void resolveService(String name,boolean storeRequest){
        Question q= serviceQuestion(name);
        if (storeRequest){
            synchronized (openRequests){
                openRequests.add(new ServiceRequest(name));
            }
        }
        Thread st=new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    sendQuestion(q);
                } catch (IOException e) {
                    Log.e(LPRFX,"unable to send query",e);
                }
            }
        });
        st.setDaemon(true);
        st.start();
    }
    public void resolveHost(String name,ResolveHostCallback callback,boolean forceNew) {
        if (! forceNew){
            Host h=hostAddresses.get(name);
            if (h!=null) {
                callback.resolve(name,h.address);
                return;
            }

        }
        Question q= hostQuestion(name);
        if (callback != null){
            synchronized (openHostRequests){
                openHostRequests.add(new HostRequest(name,callback));
            }
        }
        try {
            sendQuestion(q);
        }catch (IOException e){
            AvnLog.e("unable to send host query for "+name,e);
        }
    }

    public void sendQuestion(Question question) throws IOException {
        ByteBuffer buffer = question.getBuffer();
        buffer.flip();
        channel.send(buffer,mdnsGroupIPv4);
    }

    public void stop() throws IOException {
        channel.close();
        waitingServices.clear();
        hostAddresses.clear();
        openRequests.clear();
        openHostRequests.clear();
    }
}
