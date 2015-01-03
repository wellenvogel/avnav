package de.wellenvogel.avnav.main;

import android.util.Log;
import de.wellenvogel.avnav.util.AvnLog;

import java.io.*;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;

/**
 * Created by andreas on 06.12.14.
 */
public class GemfHandler {
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
            "       <LayerBoundings>\n"+
            "       %LAYERBOUNDINGS%\n"+
            "       </LayerBoundings>\n"+
            "       \n" +
            "    </TileMap>\n";
    private static final String GEMFTEMPLATE="<?xml version=\"1.0\" encoding=\"UTF-8\" ?>\n" +
            " <TileMapService version=\"1.0.0\" >\n" +
            "   <Title>avnav tile map service</Title>\n" +
            "   <TileMaps>\n" +
            "   \n" +
            "   %MAPSOURCES% \n"+
            "       \n" +
            "\n" +
            "   </TileMaps>\n" +
            " </TileMapService>\n" +
            " ";
    private static final String LAYERBOUNDING="<BoundingBox minlon=\"%MINLON%\" minlat=\"%MINLAT%\" maxlon=\"%MAXLON%\" maxlat=\"%MAXLAT%\" title=\"gemfrange\"/>\n";
    private GEMFFile gemf;
    public GemfHandler(GEMFFile file, String urlName){
        this.urlName=urlName;
        gemf=file;
    }
    public GemfHandler(File file) throws IOException {
        gemf=new GEMFFile(file);
        this.urlName=urlName;
    }


    public InputStream getInputStream(int x,int y, int z,int sourceIndex) {
        InputStream rt = gemf.getInputStream(x, y, z,sourceIndex);
        AvnLog.d(AvNav.LOGPRFX, "loaded gemf z=" + z + ", x=" + x + ", y=" + y + ",src=" + sourceIndex + ", rt=" + ((rt != null) ? "OK" : "<null>"));
        return rt;
    }
    public String getUrlName(){
        return urlName;
    }
    public void close(){
        try {
            gemf.close();
        } catch (IOException e) {
            AvnLog.d(AvNav.LOGPRFX,"exception while closing gemf file "+urlName);
        }
    }
    private String replaceTemplate(String template,HashMap<String,String> values){
        String rt=template;
        for (String k: values.keySet()){
            rt=rt.replaceAll("%"+k+"%",values.get(k));
        }
        return rt;
    }


    //from http://wiki.openstreetmap.org/wiki/Slippy_map_tilenames#Java
    class BoundingBox {
        double north;
        double south;
        double east;
        double west;
        void extend(BoundingBox e){
            if (e.north > north) north=e.north;
            if (e.south < south) south=e.south;
            if (e.west < west)west=e.west;
            if (e.east > east) east=e.east;
        }
        public BoundingBox(){
            north=-90;
            south=90;
            east=-180;
            west=180;
        }
        public String toString(){
            StringBuilder sb=new StringBuilder();
            sb.append("BBox south=").append(south);
            sb.append(", north=").append(north);
            sb.append(", west=").append(west);
            sb.append(", east=").append(east);
            return sb.toString();
        }
        public void fillValues(HashMap<String,String> values){
            values.put("MAXLON", Double.toString(east));
            values.put("MINLON", Double.toString(west));
            values.put("MINLAT", Double.toString(south));
            values.put("MAXLAT", Double.toString(north));
        }
    }
    BoundingBox tile2boundingBox(final int x, final int y, final int zoom) {
        BoundingBox bb = new BoundingBox();
        bb.north = tile2lat(y, zoom);
        bb.south = tile2lat(y + 1, zoom);
        bb.west = tile2lon(x, zoom);
        bb.east = tile2lon(x + 1, zoom);
        return bb;
    }
    BoundingBox range2boundingBox(GEMFFile.GEMFRange range) {
        BoundingBox bb = new BoundingBox();
        bb.north = tile2lat(range.yMin, range.zoom);
        bb.south = tile2lat(range.yMax + 0.999, range.zoom);
        bb.west = tile2lon(range.xMin, range.zoom);
        bb.east = tile2lon(range.xMax+0.999, range.zoom);
        return bb;
    }
    static double tile2lon(double x, int z) {
        return x / Math.pow(2.0, z) * 360.0 - 180;
    }

    static double tile2lat(double y, int z) {
        double n = Math.PI - (2.0 * Math.PI * y) / Math.pow(2.0, z);
        return Math.toDegrees(Math.atan(Math.sinh(n)));
    }

    private class SourceEntry{
        int maxZoom;
        int index;
        String mapSource;
        public SourceEntry(int index,int maxZoom,String mapSource){
            this.index=index;
            this.mapSource=mapSource;
            this.maxZoom=maxZoom;
        }
        int compare(SourceEntry o){
            return (o.maxZoom - maxZoom);
        }
    }

    /**
     * create an overview of an GEMF file
     * for the bounding boxes we assume a "nice" file - only
     * @return
     * @throws UnsupportedEncodingException
     */
    public InputStream gemfOverview() throws UnsupportedEncodingException {
        HashMap<Integer,String> sources=gemf.getSources();
        List<GEMFFile.GEMFRange> ranges = gemf.getRanges();
        SourceEntry mapSources[]=new SourceEntry[sources.size()];
        int idx=0;
        boolean multiLayer=sources.keySet().size()>1;
        for (Integer src:sources.keySet()) {
            StringBuilder layerBoundings=new StringBuilder();
            BoundingBox extend = new BoundingBox();
            int minzoom = 1000;
            int maxzoom = 0;
            //we first have to find out min/max zoom as we only consider max zoom for bounding boxes
            //if we have multiple layers
            for (GEMFFile.GEMFRange range : ranges) {
                if (range.sourceIndex != src.intValue()) continue;
                if (range.zoom < minzoom) minzoom = range.zoom;
                if (range.zoom > maxzoom) maxzoom = range.zoom;
            }
            for (GEMFFile.GEMFRange range : ranges) {
                if (range.sourceIndex != src.intValue())continue;
                if (multiLayer && range.zoom != maxzoom) continue;
                BoundingBox rbb = range2boundingBox(range);
                HashMap<String,String> values=new HashMap<String, String>();
                rbb.fillValues(values);
                layerBoundings.append(replaceTemplate(LAYERBOUNDING,values));
                extend.extend(rbb);
            }
            HashMap<String,String> values=new HashMap<String, String>();
            values.put("HREF", src.toString());
            values.put("MINZOOM", Integer.toString(minzoom));
            values.put("MAXZOOM", Integer.toString(maxzoom));
            extend.fillValues(values);
            values.put("TITLE", "");
            values.put("LAYERBOUNDINGS",layerBoundings.toString());
            SourceEntry e=new SourceEntry(src.intValue(),maxzoom,replaceTemplate(MAPSRCTEMPLATE,values));
            mapSources[idx]=e;
            idx++;
            AvnLog.i(AvNav.LOGPRFX, "read gemf overview " + gemf.getName() + " source=" + sources.get(src) + " ,minzoom= " + minzoom + ", maxzoom=" + maxzoom + " : " + extend.toString());
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
        AvnLog.i(AvNav.LOGPRFX, "done read gemf overview " + gemf.getName());
        String rt=replaceTemplate(GEMFTEMPLATE,values);
        return new ByteArrayInputStream(rt.getBytes("UTF-8"));
    }
}
