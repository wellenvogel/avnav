package de.wellenvogel.avnav.worker;

import org.json.JSONException;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;

import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
public class WorkerTest {
    @Test
    public void toJson() throws JSONException {
        Worker.WorkerStatus st=new Worker.WorkerStatus();
        st.name="test1";
        JSONObject o=st.toJson();
        assertEquals(false,o.getBoolean("canEdit"));
        assertEquals(false,o.getBoolean("canDelete"));
        assertEquals("test1",o.getString("name"));
        assertEquals("INACTIVE",o.getJSONObject("info").getJSONArray("items").getJSONObject(0).getString("status"));
    }
    @Test
    public void toJsonEditDelete() throws JSONException {
        Worker.WorkerStatus st=new Worker.WorkerStatus();
        st.canDelete=true;
        st.canEdit=true;
        JSONObject o=st.toJson();
        assertEquals(true,o.getBoolean("canEdit"));
        assertEquals(true,o.getBoolean("canDelete"));
    }
    @Test
    public void toJsonStatusNMEA() throws JSONException {
        Worker.WorkerStatus st=new Worker.WorkerStatus();
        st.status= Worker.WorkerStatus.Status.NMEA;
        st.info="test2";
        JSONObject o=st.toJson();
        assertEquals("NMEA",o.getJSONObject("info").getJSONArray("items").getJSONObject(0).getString("status"));
        assertEquals("test2",o.getJSONObject("info").getJSONArray("items").getJSONObject(0).getString("info"));
    }
}