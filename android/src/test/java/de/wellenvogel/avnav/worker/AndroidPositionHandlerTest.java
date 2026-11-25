package de.wellenvogel.avnav.worker;

import android.os.Handler;
import android.os.Looper;

import org.json.JSONException;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.mockito.Mockito;

import java.io.IOException;

import static org.junit.Assert.*;

public class AndroidPositionHandlerTest {
    private MockedStatic<Looper> loopers;
    private MockedConstruction<Handler> handlers;

    @Before
    public void mockAndroidHandler() {
        loopers = Mockito.mockStatic(Looper.class);
        handlers = Mockito.mockConstruction(Handler.class);
    }

    @After
    public void closeAndroidMocks() {
        if (handlers != null) handlers.close();
        if (loopers != null) loopers.close();
    }

    @Test
    public void createHandler() throws WorkerFactory.WorkerNotFound, JSONException, IOException {
        IWorker h=WorkerFactory.getInstance().createWorker(WorkerFactory.ANDROID_NAME,null,null);
        assertTrue(h instanceof AndroidPositionHandler);
    }
    @Test
    public void setParameterOk() throws WorkerFactory.WorkerNotFound, JSONException, IOException {
        IWorker h=WorkerFactory.getInstance().createWorker(WorkerFactory.ANDROID_NAME,null,null);
        JSONObject p=new JSONObject();
        p.put("name",WorkerFactory.ANDROID_NAME);
        h.setParameters(null,p, true,true);
        assertEquals(true,Worker.ENABLED_PARAMETER.fromJson(h.getConfig()));
    }
    @Test
    public void setParameterOkSource() throws WorkerFactory.WorkerNotFound, JSONException, IOException {
        String sname="test123";
        IWorker h=WorkerFactory.getInstance().createWorker(WorkerFactory.ANDROID_NAME,null,null);
        JSONObject p=new JSONObject();
        p.put("name",WorkerFactory.ANDROID_NAME);
        p.put(Worker.SOURCENAME_PARAMETER.name,sname);
        h.setParameters(null,p, true,true);
        assertEquals(true,Worker.ENABLED_PARAMETER.fromJson(h.getConfig()));
        assertEquals(sname,Worker.SOURCENAME_PARAMETER.fromJson(h.getConfig()));
    }
    @Test(expected = JSONException.class)
    public void setParameterFailInt() throws WorkerFactory.WorkerNotFound, JSONException, IOException {
        String sname="wrongNumber";
        IWorker h=WorkerFactory.getInstance().createWorker(WorkerFactory.ANDROID_NAME,null,null);
        JSONObject p=new JSONObject();
        p.put("name",WorkerFactory.ANDROID_NAME);
        p.put(Worker.SOURCE_PRIORITY_PARAMETER.name,sname);
        h.setParameters(null,p,true, true);
    }

}