package de.wellenvogel.avnav.worker;

import org.json.JSONException;
import org.json.JSONObject;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.ExpectedException;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;

import java.io.IOException;

import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
public class AndroidPositionHandlerTest {
    @Rule
    public final ExpectedException exception=ExpectedException.none();
    @Test
    public void createHandler() throws WorkerFactory.WorkerNotFound, JSONException, IOException {
        IWorker h=WorkerFactory.getInstance().createWorker(WorkerFactory.ANDROID_NAME,null,null);
        assert(h instanceof AndroidPositionHandler);
    }
    @Test
    public void setParameterOk() throws WorkerFactory.WorkerNotFound, JSONException, IOException {
        IWorker h=WorkerFactory.getInstance().createWorker(WorkerFactory.ANDROID_NAME,null,null);
        JSONObject p=new JSONObject();
        p.put("name",WorkerFactory.ANDROID_NAME);
        h.setParameters(p, true);
        assertEquals(true,Worker.ENABLED_PARAMETER.fromJson(h.getConfig()));
    }
    @Test
    public void setParameterOkSource() throws WorkerFactory.WorkerNotFound, JSONException, IOException {
        String sname="test123";
        IWorker h=WorkerFactory.getInstance().createWorker(WorkerFactory.ANDROID_NAME,null,null);
        JSONObject p=new JSONObject();
        p.put("name",WorkerFactory.ANDROID_NAME);
        p.put(Worker.SOURCENAME_PARAMETER.name,sname);
        h.setParameters(p, true);
        assertEquals(true,Worker.ENABLED_PARAMETER.fromJson(h.getConfig()));
        assertEquals(sname,Worker.SOURCENAME_PARAMETER.fromJson(h.getConfig()));
    }
    @Test
    public void setParameterFailInt() throws WorkerFactory.WorkerNotFound, JSONException, IOException {
        String sname="wrongNumber";
        IWorker h=WorkerFactory.getInstance().createWorker(WorkerFactory.ANDROID_NAME,null,null);
        JSONObject p=new JSONObject();
        p.put("name",WorkerFactory.ANDROID_NAME);
        p.put(Worker.TIMEOFFSET_PARAMETER.name,sname);
        exception.expect(org.json.JSONException.class);
        h.setParameters(p, true);
    }

}