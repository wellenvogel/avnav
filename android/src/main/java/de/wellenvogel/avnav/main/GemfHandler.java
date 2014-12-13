package de.wellenvogel.avnav.main;

import android.util.Log;

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
    private GEMFFile gemf;
    public GemfHandler(GEMFFile file, String urlName){
        this.urlName=urlName;
        gemf=file;
    }
    public GemfHandler(File file) throws IOException {
        gemf=new GEMFFile(file);
        this.urlName=urlName;
    }

    public InputStream getInputStream(int x,int y, int z) {
        InputStream rt = gemf.getInputStream(x, y, z);
        Log.d(AvNav.LOGPRFX, "loaded gemf z=" + z + ", x=" + x + ", y=" + y);
        return rt;
    }
    public InputStream getInputStream(int x,int y, int z,int sourceIndex) {
        InputStream rt = gemf.getInputStream(x, y, z,sourceIndex);
        Log.d(AvNav.LOGPRFX, "loaded gemf z=" + z + ", x=" + x + ", y=" + y);
        return rt;
    }
    public String getUrlName(){
        return urlName;
    }
    public void close(){
        try {
            gemf.close();
        } catch (IOException e) {
            Log.d(AvNav.LOGPRFX,"exception while closing gemf file "+urlName);
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
        bb.south = tile2lat(range.yMax + 1, range.zoom);
        bb.west = tile2lon(range.xMin, range.zoom);
        bb.east = tile2lon(range.xMax+1, range.zoom);
        return bb;
    }
    static double tile2lon(int x, int z) {
        return x / Math.pow(2.0, z) * 360.0 - 180;
    }

    static double tile2lat(int y, int z) {
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

    public InputStream gemfOverview() throws UnsupportedEncodingException {
        HashMap<Integer,String> sources=gemf.getSources();
        List<GEMFFile.GEMFRange> ranges = gemf.getRanges();
        SourceEntry mapSources[]=new SourceEntry[sources.size()];
        int idx=0;
        for (Integer src:sources.keySet()) {
            BoundingBox extend = new BoundingBox();
            int minzoom = 1000;
            int maxzoom = 0;
            for (GEMFFile.GEMFRange range : ranges) {
                if (range.sourceIndex != src.intValue())continue;
                BoundingBox rbb = range2boundingBox(range);
                extend.extend(rbb);
                if (range.zoom < minzoom) minzoom = range.zoom;
                if (range.zoom > maxzoom) maxzoom = range.zoom;
            }
            HashMap<String,String> values=new HashMap<String, String>();
            values.put("HREF",src.toString());
            values.put("MINZOOM",Integer.toString(minzoom));
            values.put("MAXZOOM",Integer.toString(maxzoom));
            values.put("MAXLON", Double.toString(extend.east));
            values.put("MINLON", Double.toString(extend.west));
            values.put("MINLAT", Double.toString(extend.south));
            values.put("MAXLAT", Double.toString(extend.north));
            values.put("TITLE","");
            SourceEntry e=new SourceEntry(src.intValue(),maxzoom,replaceTemplate(MAPSRCTEMPLATE,values));
            mapSources[idx]=e;
            idx++;
            Log.i(AvNav.LOGPRFX, "read gemf overview " + gemf.getName() + " source=" + sources.get(src) + " ,minzoom= " + minzoom + ", maxzoom=" + maxzoom + " : " + extend.toString());
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
        Log.i(AvNav.LOGPRFX, "done read gemf overview " + gemf.getName() );
        return new ByteArrayInputStream(replaceTemplate(GEMFTEMPLATE,values).getBytes("UTF-8"));
    }
}
