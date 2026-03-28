package de.wellenvogel.avnav.worker;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;

import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.util.NmeaQueue;

/*
# Copyright (c) 2022,2026 Andreas Vogel andreas@wellenvogel.net

#  Permission is hereby granted, free of charge, to any person obtaining a
#  copy of this software and associated documentation files (the "Software"),
#  to deal in the Software without restriction, including without limitation
#  the rights to use, copy, modify, merge, publish, distribute, sublicense,
#  and/or sell copies of the Software, and to permit persons to whom the
#  Software is furnished to do so, subject to the following conditions:
#
#  The above copyright notice and this permission notice shall be included
#  in all copies or substantial portions of the Software.
#
#  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
#  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
#  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
#  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
#  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
#  DEALINGS IN THE SOFTWARE.
*/
public class AisWorker extends Worker{
    public static final EditableParameter.IntegerParameter AIS_AGE= new
            EditableParameter.IntegerParameter("aisAge", R.string.labelSettingsAisLifetime,1200);
    public static final EditableParameter.StringParameter OWN_MMSI= new
            EditableParameter.StringParameter("ownMMSI",R.string.labelSettingsOwnMMSI,"");
    protected AisWorker(String typeName, GpsService ctx) {
        super(typeName, ctx);
        parameterDescriptions.addParams(
                OWN_MMSI,
                AIS_AGE
        );
        status.canEdit=true;
    }

    public static class Creator extends WorkerFactory.Creator{

        @Override
        IWorker create(String name, GpsService ctx, NmeaQueue queue) throws JSONException, IOException {
            return new AisWorker(name,ctx);
        }
    }
    @Override
    public Kind getKind() {
        return Kind.AIS;

    }

    @Override
    public void preRun() throws Exception {
        Decoder decoder=gpsService.getDecoder();
        if (decoder == null) return;
        //migrate from old config at decoder
        JSONObject toMigrate=decoder.parameters;
        for (EditableParameter.EditableParameterInterface p:
                new EditableParameter.EditableParameterInterface[]{AIS_AGE,OWN_MMSI}){
            if (! parameters.has(p.getName()) && toMigrate.has(p.getName())){
                p.addToJson(parameters,toMigrate);
            }
        }
        decoder.updateAisParameters(
                OWN_MMSI.fromJson(parameters),
                AIS_AGE.fromJson(parameters)
        );
    }

    @Override
    public synchronized void setParameters(String child, JSONObject newParam, boolean replace, boolean check) throws JSONException, IOException {
        super.setParameters(child, newParam, replace, check);
        try {
            //set parameters at the decoder
            preRun();
        } catch (Exception e) {
            throw new IOException(e);
        }
    }

    @Override
    protected void run(int startSequence) throws JSONException, IOException {
        setStatus(WorkerStatus.Status.NMEA,"scanning");
        while (! shouldStop(startSequence)){
            String ownMMSI=OWN_MMSI.fromJson(parameters);
            status.setChildStatus("ownMMSI",
                    (ownMMSI != null && ! ownMMSI.isEmpty())? WorkerStatus.Status.NMEA: WorkerStatus.Status.INACTIVE,
                    ownMMSI
                    );
            Decoder decoder=gpsService.getDecoder();
            if (decoder != null){
                int numTargets=decoder.numAisData();
                String lastAisSrc=decoder.getLastAisSource();
                status.setChildStatus("ais",
                        (numTargets>0)? WorkerStatus.Status.NMEA: WorkerStatus.Status.STARTED,
                        String.format("%d targets, src:%s",numTargets,lastAisSrc));
            }
            else {
                status.setChildStatus("ais", WorkerStatus.Status.STARTED, "waiting");
            }
            sleep(1000);
        }
    }
}
