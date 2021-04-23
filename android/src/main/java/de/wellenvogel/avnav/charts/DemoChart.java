package de.wellenvogel.avnav.charts;

import android.content.Context;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.InputStream;
import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;

import de.wellenvogel.avnav.appapi.DirectoryRequestHandler;
import de.wellenvogel.avnav.appapi.ExtendedWebResourceResponse;
import de.wellenvogel.avnav.appapi.RequestHandler;
import de.wellenvogel.avnav.main.BuildConfig;
import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.util.AvnLog;

public class DemoChart extends Chart{
    String fileName;
    String key;
    DemoChart(String fileName, Context ctx) throws UnsupportedEncodingException {
        super(ctx);
        this.fileName=fileName;
        key=Constants.DEMOCHARTS+"/"+ URLEncoder.encode(fileName,"UTF-8");
    }

    @Override
    public boolean isXml() {
        return true;
    }

    @Override
    public JSONObject toJson() throws JSONException, UnsupportedEncodingException {
        String name=fileName.replaceAll("\\.xml$", "");
        AvnLog.d(Constants.LOGPRFX,"found demo chart "+fileName);
        String url="/"+ Constants.CHARTPREFIX+"/"+key;
        JSONObject e = new JSONObject();
        e.put("name", name);
        e.put("url",url);
        e.put("chartKey",key);
        e.put("charturl",url);
        e.put("canDelete",false);
        e.put("canDownload",false);
        e.put("time", BuildConfig.TIMESTAMP/1000);
        e.put("sequence",0);
        e.put("overlayConfig",url.replace('/','@')+CFG_EXTENSION);
        return e;
    }

    @Override
    public ExtendedWebResourceResponse getOverview() throws Exception {
        String safeName = fileName;
        safeName += ".xml";
        String mimeType= RequestHandler.mimeType(safeName);
        InputStream rt = context.getAssets().open(Constants.CHARTPREFIX + "/" + safeName);
        long len = -1;
        return new ExtendedWebResourceResponse(len, mimeType, "", rt);
    }

    @Override
    public String getChartKey() {
        return key;
    }


    @Override
    public boolean canDelete() {
        return false;
    }
}
