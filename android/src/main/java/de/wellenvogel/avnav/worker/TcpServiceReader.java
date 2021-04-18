package de.wellenvogel.avnav.worker;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.List;

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
    static final String NMEA_SERVICE_TYPE ="_nmea-0183._tcp.";
    static Description[] SERVICES = new Description[]{
            new Description(NMEA_SERVICE_TYPE, "NMEA0183 service")
    };

    private EditableParameter.StringListParameter servicesParameter=
            new EditableParameter.StringListParameter("service", R.string.labelSettingsSelectService,null);


    private TcpServiceReader(String name, GpsService ctx, NmeaQueue queue,String typeName) throws JSONException {
        super(name,ctx,queue);
        this.serviceType=typeName;
        servicesParameter.listBuilder= new EditableParameter.ListBuilder<String>() {
            @Override
            public List<String> buildList(EditableParameter.StringListParameter param) {
                return gpsService.discoveredServices(serviceType);
            }
        };
        parameterDescriptions.insertParams(servicesParameter);
        parameterDescriptions.addParams(
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
    }

    @Override
    public void run(int startSequence) throws JSONException, IOException {
        String target=servicesParameter.fromJson(parameters);
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
