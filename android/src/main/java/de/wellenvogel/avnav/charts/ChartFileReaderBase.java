package de.wellenvogel.avnav.charts;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;

import de.wellenvogel.avnav.appapi.ExtendedWebResourceResponse;

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
public abstract class ChartFileReaderBase {
    public static final String SERVICETEMPLATE = "<?xml version=\"1.0\" encoding=\"UTF-8\" ?>\n" +
            " <TileMapService version=\"1.0.0\" >\n" +
            "   <Title>avnav tile map service</Title>\n" +
            "   <TileMaps>\n" +
            "   \n" +
            "   %MAPSOURCES% \n" +
            "       \n" +
            "\n" +
            "   </TileMaps>\n" +
            " </TileMapService>\n" +
            " ";

    static BoundingBox tile2boundingBox(final int x, final int y, final int zoom) {
        BoundingBox bb = new BoundingBox();
        bb.north = ChartFileReaderBase.tile2lat(y, zoom);
        bb.south = ChartFileReaderBase.tile2lat(y + 1, zoom);
        bb.west = ChartFileReaderBase.tile2lon(x, zoom);
        bb.east = ChartFileReaderBase.tile2lon(x + 1, zoom);
        return bb;
    }

    static BoundingBox range2boundingBox(ChartFile.ChartRange range) {
        BoundingBox bb = new BoundingBox();
        bb.north = ChartFileReaderBase.tile2lat(range.yMin, range.zoom);
        bb.south = ChartFileReaderBase.tile2lat(range.yMax + 0.999, range.zoom);
        bb.west = ChartFileReaderBase.tile2lon(range.xMin, range.zoom);
        bb.east = ChartFileReaderBase.tile2lon(range.xMax + 0.999, range.zoom);
        return bb;
    }

    static double tile2lon(double x, int z) {
        return x / Math.pow(2.0, z) * 360.0 - 180;
    }

    static double tile2lat(double y, int z) {
        double n = Math.PI - (2.0 * Math.PI * y) / Math.pow(2.0, z);
        return Math.toDegrees(Math.atan(Math.sinh(n)));
    }

    public abstract ExtendedWebResourceResponse getChartData(int x, int y, int z, int sourceIndex) throws IOException;

    public abstract int numFiles();

    public abstract void close();

    protected String replaceTemplate(String template, HashMap<String, String> values) {
        String rt = template;
        for (String k : values.keySet()) {
            rt = rt.replaceAll("%" + k + "%", values.get(k));
        }
        return rt;
    }

    public InputStream chartOverview() throws UnsupportedEncodingException{
        return new ByteArrayInputStream(getOverview().getBytes(StandardCharsets.UTF_8));
    }

    public String getOverview(){
        return "";
    }

    public String getScheme(){
        return null;
    }

    public String getOriginalScheme(){
        return null;
    }

    public boolean setSchema(String newScheme) throws Exception{
        return true;
    }

    public long getSequence(){
        return 0;
    }

    //from http://wiki.openstreetmap.org/wiki/Slippy_map_tilenames#Java
    static class BoundingBox {
        double north;
        double south;
        double east;
        double west;

        void extend(BoundingBox e) {
            if (e.north > north) north = e.north;
            if (e.south < south) south = e.south;
            if (e.west < west) west = e.west;
            if (e.east > east) east = e.east;
        }

        public BoundingBox() {
            north = -90;
            south = 90;
            east = -180;
            west = 180;
        }

        public String toString() {
            StringBuilder sb = new StringBuilder();
            sb.append("BBox south=").append(south);
            sb.append(", north=").append(north);
            sb.append(", west=").append(west);
            sb.append(", east=").append(east);
            return sb.toString();
        }

        public void fillValues(HashMap<String, String> values) {
            values.put("MAXLON", Double.toString(east));
            values.put("MINLON", Double.toString(west));
            values.put("MINLAT", Double.toString(south));
            values.put("MAXLAT", Double.toString(north));
        }
    }

    protected static class SourceEntry {
        int maxZoom;
        int index;
        String mapSource;

        public SourceEntry(int index, int maxZoom, String mapSource) {
            this.index = index;
            this.mapSource = mapSource;
            this.maxZoom = maxZoom;
        }

        int compare(ChartFileReaderBase.SourceEntry o) {
            return (o.maxZoom - maxZoom);
        }
    }
}
