package de.wellenvogel.avnav.worker;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.security.Key;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;

import de.wellenvogel.avnav.appapi.RequestHandler;
import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.util.NmeaQueue;

/**
 * Created by andreas on 25.12.14.
 */
public class TcpServiceReader extends SingleConnectionHandler {
    String serviceType;
    public static class Description{
        String serviceType;
        String displayName;
        Description(String serviceType,String displayName){
            this.displayName=displayName;
            this.serviceType=serviceType;
        }
        WorkerFactory.Creator getCreator(){
            return new WorkerFactory.Creator() {
                @Override
                ChannelWorker create(String name, GpsService ctx, NmeaQueue queue) throws JSONException, IOException {
                    return new TcpServiceReader(displayName,ctx,queue,serviceType);
                }

                @Override
                boolean canAdd(GpsService ctx) {
                    return ctx.discoveredServices(serviceType).size()>0;
                }
            };
        }
    }

    static Description[] SERVICES = new Description[]{
            new Description("_nmea-0183._tcp.", "SignalK NMEA0183"),
            new Description("_avnav-nmea-0183._tcp.", "AvNav NMEA0183")
    };

    private EditableParameter.StringListParameter servicesParameter=
            new EditableParameter.StringListParameter("service", R.string.labelSettingsSelectService,null);


    private TcpServiceReader(String name, GpsService ctx, NmeaQueue queue,String typeName) throws JSONException {
        super(name,ctx,queue);
        this.serviceType=typeName;
        servicesParameter.listBuilder= new EditableParameter.ListBuilder<String>() {
            @Override
            public List<String> buildList(EditableParameter.StringListParameter param) {
                List<String> rt=gpsService.discoveredServices(serviceType);
                return filterByClaims(CLAIM_SERVICE, rt, true, new Comparator<String>() {
                    @Override
                    public int compare(String o1, String o2) {
                        o2=getClaimName(o2);
                        if (o1 == null) return (o2==null)?0:1;
                        return o1.equals(o2)?0:1;
                    }
                });
            }
        };
        parameterDescriptions.addParams(servicesParameter,
                WRITE_TIMEOUT_PARAMETER,
                CONNECT_TIMEOUT_PARAMETER,
                READTIMEOUT_CLOSE_PARAMETER);
    }
    private String getClaimName(String service){
        return serviceType+"."+service;
    }

    @Override
    protected void checkParameters(JSONObject newParam) throws JSONException, IOException {
        super.checkParameters(newParam);
        checkClaim(CLAIM_SERVICE,getClaimName(servicesParameter.fromJson(newParam)),true);
    }

    @Override
    public void run(int startSequence) throws JSONException, IOException {
        String target=servicesParameter.fromJson(parameters);
        addClaim(CLAIM_SERVICE,getClaimName(target),true);
        while (! shouldStop(startSequence)) {
            InetSocketAddress address=resolveService(serviceType,target,startSequence,true);
            if (address == null){
                setStatus(WorkerStatus.Status.ERROR,"unable to resolve "+target);
                sleep(3000);
                continue;
            }
            IpConnection con = new IpConnection(address, gpsService);
            runInternal(con, startSequence);
        }
    }
}
