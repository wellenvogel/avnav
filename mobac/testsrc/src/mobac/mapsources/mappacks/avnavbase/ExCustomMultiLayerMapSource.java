package mobac.mapsources.mappacks.avnavbase;

import java.awt.AlphaComposite;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.IOException;
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

import mobac.exceptions.TileException;
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
import mobac.program.interfaces.MapSource.LoadMethod;
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
	
	@XmlElement(defaultValue="true")
	protected boolean failonerror=true;

	public ExCustomMultiLayerMapSource() {
		super();
		mapSources = new MapSource[0];
		tileType = TileImageType.PNG;
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
		if (tileType == null){
			this.log.warn("tile type is null, setting to png");
			tileType=TileImageType.PNG;
		}
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

	public BufferedImage getTileImage(int zoom, int x, int y, LoadMethod loadMethod)
			throws IOException, InterruptedException, TileException {
		int tileSize = getMapSpace().getTileSize();
		BufferedImage image = new BufferedImage(tileSize, tileSize, BufferedImage.TYPE_3BYTE_BGR);
		Graphics2D g2 = image.createGraphics();
		try {
			g2.setColor(getBackgroundColor());
			g2.fillRect(0, 0, tileSize, tileSize);
			boolean used = false;
			for (int i = 0; i < mapSources.length; i++) {
				MapSource layerMapSource = mapSources[i];
				BufferedImage layerImage = layerMapSource.getTileImage(zoom, x, y, loadMethod);
				if (layerImage != null) {
					log.debug("Multi layer loading: " + layerMapSource + " z=" +zoom+", x="+ x + ",y= " + y );
					g2.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER,
							getLayerAlpha(i)));
					g2.drawImage(layerImage, 0, 0, null);
					used = true;
				}
				else {
					if (failonerror){
						log.error("unable to load tile for "+layerMapSource.getName()+" z="+zoom+", x="+x+", y="+y);
						return null;
					}
				}
			}
			if (used)
				return image;
			else
				return null;
		} finally {
			g2.dispose();
		}
	}

}
