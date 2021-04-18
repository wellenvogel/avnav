package de.wellenvogel.avnav.worker;

import org.json.JSONException;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
public class WorkerTest {
    @Test
    public void toJson() throws JSONException {
        WorkerStatus st=new WorkerStatus("test1");
        JSONObject o=st.toJson();
        assertEquals(false,o.getBoolean("canEdit"));
        assertEquals(false,o.getBoolean("canDelete"));
        assertEquals("test1",o.getString("name"));
        assertEquals("INACTIVE",o.getJSONObject("info").getJSONArray("items").getJSONObject(0).getString("status"));
    }
    @Test
    public void toJsonEditDelete() throws JSONException {
        WorkerStatus st=new WorkerStatus("test2");
        st.canDelete=true;
        st.canEdit=true;
        JSONObject o=st.toJson();
        assertEquals(true,o.getBoolean("canEdit"));
        assertEquals(true,o.getBoolean("canDelete"));
    }
    @Test
    public void toJsonStatusNMEA() throws JSONException {
        WorkerStatus st=new WorkerStatus("test3");
        st.status= WorkerStatus.Status.NMEA;
        st.info="test2";
        JSONObject o=st.toJson();
        assertEquals("NMEA",o.getJSONObject("info").getJSONArray("items").getJSONObject(0).getString("status"));
        assertEquals("test2",o.getJSONObject("info").getJSONArray("items").getJSONObject(0).getString("info"));
    }
    @Test
    public void addRemoveClaim() throws IOException {
        String testKind="test";
        String testName="name";
        class TWorker extends Worker{
            protected TWorker(String typeName) {
                super(typeName);
            }
            @Override
            protected void run(int startSequence) throws JSONException, IOException {
            }
            public void testAddClaim() throws IOException {
                addClaim(testKind,testName,true);
            }
        }
        TWorker tw=new TWorker("test");
        tw.testAddClaim();
        List<String> tlist=new ArrayList<String>();
        tlist.add(testName);
        tlist.add("test2");
        List<String> filtered=tw.filterByClaims(testKind,tlist,false);
        assertEquals(1,filtered.size());
        assertEquals("test2",filtered.get(0));
        tw.stop();
        filtered=tw.filterByClaims(testKind,tlist,false);
        assertEquals(2,filtered.size());
        assertEquals(testName,filtered.get(0));
    }
}