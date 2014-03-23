package mobac.mapsources.mappacks.avnavbase;

import java.awt.Color;
import java.util.ArrayList;
import java.util.List;

import javax.xml.bind.Unmarshaller;
import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlElementWrapper;
import javax.xml.bind.annotation.XmlElements;
import javax.xml.bind.annotation.XmlList;
import javax.xml.bind.annotation.XmlRootElement;
import javax.xml.bind.annotation.XmlSeeAlso;
import javax.xml.bind.annotation.adapters.XmlJavaTypeAdapter;

import mobac.mapsources.AbstractMultiLayerMapSource;
import mobac.mapsources.custom.CustomCloudMade;
import mobac.mapsources.custom.CustomLocalTileFilesMapSource;
import mobac.mapsources.custom.CustomLocalTileSQliteMapSource;
import mobac.mapsources.custom.CustomLocalTileZipMapSource;
import mobac.mapsources.custom.CustomMapSource;
import mobac.mapsources.custom.CustomMultiLayerMapSource;
import mobac.mapsources.custom.CustomWmsMapSource;
import mobac.mapsources.custom.StandardMapSourceLayer;
import mobac.program.interfaces.MapSource;
import mobac.program.jaxb.ColorAdapter;
import mobac.program.model.TileImageType;

@XmlRootElement
@XmlAccessorType(XmlAccessType.PROPERTY)
@XmlSeeAlso({ CustomMultiLayerMapSource.class })
public class ExCustomMultiLayerMapSource extends AbstractMultiLayerMapSource {
	@XmlElementWrapper(name = "layers")
	@XmlElements({ @XmlElement(name = "customMapSource", type = CustomMapSource.class),
			@XmlElement(name = "exCustomMapSource", type = ExCustomMapSource.class),
			@XmlElement(name = "customWmsMapSource", type = CustomWmsMapSource.class),
			@XmlElement(name = "exCustomWmsMapSource", type = ExCustomWmsMapSource.class),
			@XmlElement(name = "mapSource", type = StandardMapSourceLayer.class),
			@XmlElement(name = "cloudMade", type = CustomCloudMade.class),
			@XmlElement(name = "localTileSQLite", type = CustomLocalTileSQliteMapSource.class),
			@XmlElement(name = "localTileFiles", type = CustomLocalTileFilesMapSource.class),
			@XmlElement(name = "localTileZip", type = CustomLocalTileZipMapSource.class) })
	protected List<CustomMapSource> layers = new ArrayList<CustomMapSource>();
	@XmlList()
	protected List<Float> layersAlpha = new ArrayList<Float>();

	@XmlElement(defaultValue = "#000000")
	@XmlJavaTypeAdapter(ColorAdapter.class)
	protected Color backgroundColor = Color.BLACK;

	public ExCustomMultiLayerMapSource() {
		super();
		mapSources = new MapSource[0];
	}

	public TileImageType getTileType() {
		return tileType;
	}

	public void setTileType(TileImageType tileType) {
		this.tileType = tileType;
	}

	protected void afterUnmarshal(Unmarshaller u, Object parent) {
		mapSources = new MapSource[layers.size()];
		layers.toArray(mapSources);
		initializeValues();
	}

	@XmlElement(name = "name")
	public String getMLName() {
		return name;
	}

	public void setMLName(String name) {
		this.name = name;
	}

	@Override
	public Color getBackgroundColor() {
		return backgroundColor;
	}

	@Override
	protected float getLayerAlpha(int layerIndex) {
		if (layersAlpha.size() <= layerIndex)
			return 1.0f;

		return layersAlpha.get(layerIndex);
	}


}
