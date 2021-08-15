package mobac.mapsources.mappacks.avnavbase;

import java.util.ArrayList;
import java.util.HashMap;


import jakarta.xml.bind.Unmarshaller;
import jakarta.xml.bind.annotation.XmlElement;
import jakarta.xml.bind.annotation.XmlElementWrapper;
import jakarta.xml.bind.annotation.XmlElements;
import jakarta.xml.bind.annotation.XmlRootElement;
import mobac.mapsources.MapSourceTools;

/**
 * extend the CustomWmsMapSource by some features...
 */
@XmlRootElement
public class ExCustomWmsMapSource extends ExCustomMapSource {
	
	public static class LayerMapping{
		public String zoom;
		public String layers;
	}
	
	/**
	 * tested with 1.1.1, but should work with other versions
	 */
	@XmlElement(required = true, name = "version")
	private String version = "1.1.1";

	/**
	 * no spaces allowed, must be replaced with %20 in the url
	 */
	@XmlElement(required = true, name = "layers")
	private String layers = "";

	/**
	 * currently only the coordinate system epsg:4326 is supported
	 */
	@XmlElement(required = true, name = "coordinatesystem", defaultValue = "EPSG:4326")
	private String coordinatesystem = "EPSG:4326";

	/**
	 * some wms needs more parameters: &amp;EXCEPTIONS=BLANK&amp;Styles= .....
	 */
	@XmlElement(required = false, name = "aditionalparameters")
	private String aditionalparameters = "";
	
	/**
	 * a mapping list for zoom level to layers
	 * each element looks like
	 * <zoomMapping>
	 * 		<zoomlevel>3,4,5,6</zoomlevel>
	 * 		<layers>someLayerName,someOtherLayer</layers>
	 * <zoomMapping>
	 */
	@XmlElementWrapper(name="layerMappings")
	@XmlElements({ @XmlElement(name = "layerMapping", type = LayerMapping.class)})
	private ArrayList<LayerMapping>layermappings=new ArrayList<LayerMapping>();
	
	private HashMap<Integer, String> zoomToLayer=new HashMap<Integer, String>();
	protected void afterUnmarshal(Unmarshaller u, Object parent) {
		for(LayerMapping z: layermappings){
			String levels[]=z.zoom.split(" *, *");
			for (String l: levels){
				try {
					int lvl=Integer.parseInt(l);
					zoomToLayer.put(new Integer(lvl), z.layers);
				}catch (NumberFormatException e){}
			}
		}
		
		super.afterUnmarshal(u, parent);
		
	}

	@Override
	public String getTileUrl(int zoom, int tilex, int tiley) {
		double[] coords = MapSourceTools.calculateLatLon(this, zoom, tilex, tiley);
		String clayers=layers;
		String zlayers=zoomToLayer.get(new Integer(zoom));
		if (zlayers != null){
			clayers=zlayers;
		}
		String url = this.url + "REQUEST=GetMap" + "&LAYERS=" + clayers + "&SRS=" + coordinatesystem + "&VERSION="
				+ version + "&FORMAT=image/" + tileType.getMimeType() + "&BBOX=" + coords[0] + "," + coords[1] + ","
				+ coords[2] + "," + coords[3] + "&WIDTH=256&HEIGHT=256" + aditionalparameters;
		return url;
	}

	public String getVersion() {
		return version;
	}

	public String getLayers() {
		return layers;
	}

	public String getCoordinatesystem() {
		return coordinatesystem;
	}


	

}
