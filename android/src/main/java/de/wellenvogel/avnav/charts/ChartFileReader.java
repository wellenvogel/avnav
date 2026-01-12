package de.wellenvogel.avnav.charts;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UnsupportedEncodingException;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;

import de.wellenvogel.avnav.appapi.ExtendedWebResourceResponse;
import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.util.AvnLog;

/**
 * Created by andreas on 06.12.14.
 */
public class ChartFileReader extends ChartFileReaderBase {
    private String urlName;
    private static final String MAPSRCTEMPLATE="    <TileMap \n" +
            "       title=\"%TITLE%\" \n" +
            "       srs=\"OSGEO:41001\" \n" +
            "       href=\"%HREF%\" \n" +
            "       minzoom=\"%MINZOOM%\"\n" +
            "       maxzoom=\"%MAXZOOM%\">\n" +
            "       \n" +
            "       <BoundingBox minlon=\"%MINLON%\" minlat=\"%MINLAT%\" maxlon=\"%MAXLON%\" maxlat=\"%MAXLAT%\"\n" +
            "        title=\"layer\"/>\n" +
            "\n" +
            "       <TileFormat width=\"256\" height=\"256\" mime-type=\"x-png\" extension=\"png\" />\n" +
            "       <LayerZoomBoundings>\n"+
            "       %ZOOMBOUNDINGS%\n"+
            "       </LayerZoomBoundings>\n"+
            "       \n" +
            "    </TileMap>\n";
    private static final String ZOOMBOUNDINGFRAME="<ZoomBoundings zoom=\"%ZOOM%\">\n" +
            "%BOUNDINGS%\n" +
            "</ZoomBoundings>\n";
    private static final String ZOOMBOUNDING="<BoundingBox minx=\"%MINX%\" maxx=\"%MAXX%\" miny=\"%MINY%\" maxy=\"%MAXY%\" />\n";
    private ChartFile chart;
    private final Object overviewLock=new Object();
    private String overview=null;
    public ChartFileReader(ChartFile file, String urlName){
        this.urlName=urlName;
        chart =file;
    }

    @Override
    public ExtendedWebResourceResponse getChartData(int x, int y, int z, int sourceIndex) throws IOException {
        ChartInputStream str=getInputStream(x,y,z,sourceIndex);
        if (str == null)
            return null;
        return new ExtendedWebResourceResponse(str.getLength(),"image/png","",str);
    }

    public ChartInputStream getInputStream(int x, int y, int z, int sourceIndex) throws IOException {
        ChartInputStream rt = chart.getInputStream(x, y, z,sourceIndex);
        AvnLog.d(Constants.LOGPRFX, "loaded chart z=" + z + ", x=" + x + ", y=" + y + ",src=" + sourceIndex + ", rt=" + ((rt != null) ? "OK" : "<null>"));
        return rt;
    }

    @Override
    public int numFiles(){
        return chart.numFiles();
    }
    @Override
    public void close(){
        try {
            chart.close();
        } catch (IOException e) {
            AvnLog.d(Constants.LOGPRFX,"exception while closing chart file "+urlName);
        }
    }



    @Override
    public String getOverview(){
        synchronized (overviewLock){
            if (overview != null) return overview;
        }
        HashMap<Integer,String> sources= chart.getSources();
        List<ChartFile.ChartRange> ranges = chart.getRanges();
        SourceEntry mapSources[]=new SourceEntry[sources.size()];
        int idx=0;
        for (Integer src:sources.keySet()) {
            StringBuilder zoomBoundings=new StringBuilder();
            BoundingBox extend = new BoundingBox();
            int minzoom = 1000;
            int maxzoom = 0;
            //we first have to find out min/max zoom as we only consider max zoom for bounding boxes
            //if we have multiple layers
            HashSet<Integer> zooms=new HashSet<>();
            for (ChartFile.ChartRange range : ranges) {
                if (range.sourceIndex != src.intValue()) continue;
                zooms.add(range.zoom);
                if (range.zoom < minzoom) minzoom = range.zoom;
                if (range.zoom > maxzoom) maxzoom = range.zoom;
                BoundingBox rangeBoundings=range2boundingBox(range);
                extend.extend(rangeBoundings);
            }

            for (Integer zoom : zooms) {
                StringBuilder zb = new StringBuilder();
                for (ChartFile.ChartRange range : ranges) {
                    if (range.sourceIndex != src.intValue()) continue;
                    if (!range.zoom.equals(zoom)) continue;
                    HashMap<String, String> values = new HashMap<String, String>();
                    range.fillValues(values);
                    zb.append(replaceTemplate(ZOOMBOUNDING, values));
                }
                HashMap<String, String> values = new HashMap<String, String>();
                values.put("ZOOM", "" + zoom);
                values.put("BOUNDINGS", zb.toString());
                zoomBoundings.append(replaceTemplate(ZOOMBOUNDINGFRAME, values));
            }

            HashMap<String,String> values=new HashMap<String, String>();
            values.put("HREF", src.toString());
            values.put("MINZOOM", Integer.toString(minzoom));
            values.put("MAXZOOM", Integer.toString(maxzoom));
            extend.fillValues(values);
            values.put("TITLE", "");
            values.put("ZOOMBOUNDINGS",zoomBoundings.toString());
            SourceEntry e= new SourceEntry(src, maxzoom, replaceTemplate(MAPSRCTEMPLATE, values));
            mapSources[idx]=e;
            idx++;
            AvnLog.i(Constants.LOGPRFX, "read chart overview " + chart.getName() + " source=" + sources.get(src) + " ,minzoom= " + minzoom + ", maxzoom=" + maxzoom + " : " + extend.toString());
        }
        //sort layers by maxzoomlevel
        Arrays.sort(mapSources, new Comparator<SourceEntry>() {
            @Override
            public int compare(SourceEntry lhs, SourceEntry rhs) {
                return lhs.compare(rhs);
            }
        });
        StringBuilder sourceString = new StringBuilder();
        for (SourceEntry e: mapSources){
            sourceString.append(e.mapSource);
        }
        HashMap<String,String> values=new HashMap<String, String>();
        values.put("MAPSOURCES",sourceString.toString());
        AvnLog.i(Constants.LOGPRFX, "done read chart overview " + chart.getName());
        String rt=replaceTemplate(SERVICETEMPLATE,values);
        synchronized (overviewLock){
            overview=rt;
        }
        return rt;
    }

    @Override
    public String getScheme(){
        return chart.getScheme();
    }
    @Override
    public String getOriginalScheme(){
        return chart.getOriginalScheme();
    }
    @Override
    public boolean setSchema(String newScheme) throws Exception {
        boolean rt=chart.setScheme(newScheme);
        if (rt){
            synchronized (overviewLock){
                overview=null;
            }
        }
        return rt;
    }
    @Override
    public long getSequence(){
        return chart.getSequence();
    }
}
