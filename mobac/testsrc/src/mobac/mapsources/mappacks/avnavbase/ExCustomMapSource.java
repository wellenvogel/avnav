package mobac.mapsources.mappacks.avnavbase;

import java.awt.Color;
import java.awt.Graphics;
import java.awt.Image;
import java.awt.image.BufferedImage;
import java.awt.image.FilteredImageSource;
import java.awt.image.RGBImageFilter;
import java.awt.image.WritableRaster;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;

import javax.imageio.ImageIO;
import javax.xml.bind.Unmarshaller;
import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlElementWrapper;
import javax.xml.bind.annotation.XmlElements;
import javax.xml.bind.annotation.XmlList;
import javax.xml.bind.annotation.XmlRootElement;
import javax.xml.bind.annotation.XmlTransient;
import javax.xml.bind.annotation.adapters.XmlJavaTypeAdapter;

import org.apache.log4j.Logger;

import mobac.exceptions.UnrecoverableDownloadException;
import mobac.mapsources.MapSourceTools;
import mobac.mapsources.mappacks.avnavbase.ExCustomWmsMapSource.LayerMapping;
import mobac.mapsources.mapspace.MercatorPower2MapSpace;
import mobac.program.download.TileDownLoader;
import mobac.program.interfaces.HttpMapSource;
import mobac.program.interfaces.MapSourceListener;
import mobac.program.interfaces.MapSpace;
import mobac.program.jaxb.ColorAdapter;
import mobac.program.model.MapSourceLoaderInfo;
import mobac.program.model.TileImageType;
import mobac.program.tilestore.TileStore;
import mobac.program.tilestore.TileStoreEntry;

@XmlRootElement
public class ExCustomMapSource implements HttpMapSource {
	private Logger log = Logger.getLogger(ExCustomMapSource.class);
	
	private HashMap<Integer, Integer> converterMap=new HashMap<Integer, Integer>();
	void initConverter(HashMap<Color, Color> cconvert){
		for (Color k: cconvert.keySet()){
			this.converterMap.put(k.getRGB()&0xffffff,cconvert.get(k).getRGB()&0xffffff);
		}
	}
	
	
	public static class ColorMapping{
		@XmlJavaTypeAdapter(ColorAdapter.class)
		public Color in;
		@XmlJavaTypeAdapter(ColorAdapter.class)
		public Color out;
	}
	
	@XmlElement(required = false, defaultValue="1")
	protected int retries = 1;
	
	/*
	 * an option to use zoomed tiles from lower levels
	 */
	@XmlElement(required = false, defaultValue="0")
	protected int numLowerLevels = 0;
	
	@XmlElement(nillable = false, defaultValue = "Custom")
	private String name = "Custom";

	@XmlElement(defaultValue = "0")
	protected int minZoom = 0;

	@XmlElement(required = true)
	protected int maxZoom = 0;

	@XmlElement(defaultValue = "PNG")
	protected TileImageType tileType = TileImageType.PNG;

	@XmlElement(defaultValue = "NONE")
	protected HttpMapSource.TileUpdate tileUpdate;

	@XmlElement(required = true, nillable = false)
	protected String url = "http://127.0.0.1/{$x}_{$y}_{$z}";

	@XmlElement(defaultValue = "false")
	private boolean invertYCoordinate = false;

	@XmlElement(defaultValue = "#000000")
	@XmlJavaTypeAdapter(ColorAdapter.class)
	protected Color backgroundColor = Color.BLACK;

	@XmlElement(required = false, defaultValue = "false")
	protected boolean ignoreErrors = false;

	@XmlElement(required = false, defaultValue = "")
	@XmlList
	private String[] serverParts = null;
	private int currentServerPart = 0;
	
	@XmlElementWrapper(name="colorMappings")
	@XmlElements({ @XmlElement(name = "colorMapping", type = ColorMapping.class)})
	private ArrayList<ColorMapping>colormappings=new ArrayList<ColorMapping>();
	
	protected void afterUnmarshal(Unmarshaller u, Object parent) {
		HashMap<Color, Color> cvmap=new HashMap<Color, Color>();
		for(ColorMapping c: colormappings){
			cvmap.put(c.in, c.out);
			log.debug("adding color mapping from "+c.in+" to "+c.out);
			initConverter(cvmap);
		}
		if (tileType == null){
			throw new RuntimeException("invalid tileType - null");
		}
		
	}

	private MapSourceLoaderInfo loaderInfo = null;

	/**
	 * Constructor without parameters - required by JAXB
	 */
	protected ExCustomMapSource() {
	}

	public ExCustomMapSource(String name, String url) {
		this.name = name;
		this.url = url;
	}

	public TileUpdate getTileUpdate() {
		return tileUpdate;
	}

	public int getMaxZoom() {
		return maxZoom;
	}

	public int getMinZoom() {
		return minZoom;
	}

	public String getName() {
		return name;
	}

	public String getStoreName() {
		return name;
	}

	public TileImageType getTileImageType() {
		return tileType;
	}

	public HttpURLConnection getTileUrlConnection(int zoom, int tilex, int tiley) throws IOException {
		String url = getTileUrl(zoom, tilex, tiley);
		if (url == null)
			return null;
		return (HttpURLConnection) new URL(url).openConnection();
	}

	public String getTileUrl(int zoom, int tilex, int tiley) {
		if (serverParts == null || serverParts.length == 0) {
			return MapSourceTools.formatMapUrl(url, zoom, tilex, tiley);
		} else {
			currentServerPart = (currentServerPart + 1) % serverParts.length;
			String serverPart = serverParts[currentServerPart];
			return MapSourceTools.formatMapUrl(url, serverPart, zoom, tilex, tiley);
		}
	}
	
	/*
	 * unfortunately the API always expects a byte array here - so when upscaling we must convert back...
	 * (non-Javadoc)
	 * @see mobac.program.interfaces.MapSource#getTileData(int, int, int, mobac.program.interfaces.MapSource.LoadMethod)
	 */
	public byte[] getTileData(int zoom, int x, int y, LoadMethod loadMethod) throws IOException,
	UnrecoverableDownloadException, InterruptedException {
		int currentZoom=zoom;
		int currSize=256;
		int currentFactor=1;
		int orix=x;
		int oriy=y;
		for (int nz = 0; nz <= numLowerLevels && currentZoom >= getMinZoom(); nz++) {
			for (int ntry = 0; ntry < retries; ntry++) {
				byte[] data = fetchTileData(currentZoom, x, y, loadMethod);
				if (data == null || data.length == 0) {
					continue;
				}
				if (zoom == currentZoom)
					return data;
				
				BufferedImage i = ImageIO.read(new ByteArrayInputStream(data));
				// we must zoom the image and pick the right part from it...
				int xoffset = (orix % currentFactor) * (256/currentFactor);
				int yoffset = (oriy % currentFactor) * (256/currentFactor);
				log.trace("zooming up for tile "+getName()+": z="+zoom+", nz="+currentZoom+", x="+orix+", y="+oriy+", xofs="+xoffset+", yoffs="+yoffset+", fac="+currentFactor);
				BufferedImage image = new BufferedImage(256, 256, BufferedImage.TYPE_4BYTE_ABGR);
				Graphics g = (Graphics) image.getGraphics();
				g.drawImage(i, 0, 0, 256, 256, xoffset, yoffset, xoffset + currSize, yoffset
						+ currSize, null);
				ByteArrayOutputStream os = new ByteArrayOutputStream();
				ImageIO.write(image, "png", os);
				g.dispose();
				return os.toByteArray();
			}
			//try to load from a lower zoom level
			currentZoom-=1;
			//TODO: handle invert y
			x=x/2;
			y=y/2;
			currSize/=2;
			currentFactor*=2;
		}
		if (!ignoreErrors)
			return null;
		log.warn("creating empty tile "+getName()+": z="+zoom+", x="+x+", y="+y);
		BufferedImage image = new BufferedImage(256, 256, BufferedImage.TYPE_4BYTE_ABGR);
		Graphics g = (Graphics) image.getGraphics();
		try {
			// transparent background
			g.setColor(new Color(0, 0, 0, 0));
			g.fillRect(0, 0, 256, 256);
		} finally {
			g.dispose();
		}
		ByteArrayOutputStream os=new ByteArrayOutputStream();
		ImageIO.write(image,"png",os);
		return os.toByteArray();
	}
		
				
	
	
	private byte[] fetchTileData(int zoom, int x, int y, LoadMethod loadMethod) throws IOException,
				UnrecoverableDownloadException, InterruptedException {
		if (invertYCoordinate)
			y = ((1 << zoom) - y - 1);

		if (loadMethod == LoadMethod.CACHE) {
			TileStoreEntry entry = TileStore.getInstance().getTile(x, y, zoom, this);
			if (entry == null)
				return null;
			byte[] data = entry.getData();
			if (Thread.currentThread() instanceof MapSourceListener) {
				((MapSourceListener) Thread.currentThread()).tileDownloaded(data.length);
			}
			return data;
		}
		if (!ignoreErrors && ! (retries > 1))
			return TileDownLoader.getImage(x, y, zoom, this);
		else
			try {
				return TileDownLoader.getImage(x, y, zoom, this);
			} 
			catch (RuntimeException e) {
				return null;
			}
			catch(Exception e){
				return null;
			}

	}

	
		

	
	@Override
	public String toString() {
		return name;
	}

	public MapSpace getMapSpace() {
		return MercatorPower2MapSpace.INSTANCE_256;
	}

	public Color getBackgroundColor() {
		return backgroundColor;
	}

	@XmlTransient
	public MapSourceLoaderInfo getLoaderInfo() {
		return loaderInfo;
	}

	public void setLoaderInfo(MapSourceLoaderInfo loaderInfo) {
		if (this.loaderInfo != null)
			throw new RuntimeException("LoaderInfo already set");
		this.loaderInfo = loaderInfo;
	}
	
	void replaceColors(BufferedImage image){
		if (converterMap.size() == 0)return;
		int width = image.getWidth();
        int height = image.getHeight();
        int lastin=0;
        int lastout=0;

        for (int xx = 0; xx < width; xx++) {
            for (int yy = 0; yy < height; yy++) {
            	int pix=image.getRGB(xx, yy);
            	if ((pix & 0xff000000) == 0) continue;
            	int val=pix&0xffffff;
            	if (val == lastin){
            		if (val == lastout) continue;
            		val = lastout;
            		image.setRGB(xx, yy, pix&0xff000000 | val);
            		continue;
            	}
            	lastin=val;
            	Integer ov=converterMap.get(new Integer(val));
            	if (ov == null){
            		lastout=val;
            		continue;
            	}
            	val=ov.intValue()&0xffffff;
            	lastout=val;
            	image.setRGB(xx, yy, pix&0xff000000|val);
            }
        }
	}

	/**
	 * get image with extended error handling and retries
	 */
	
	public BufferedImage getTileImage(int zoom, int x, int y, LoadMethod loadMethod)
			throws IOException, UnrecoverableDownloadException, InterruptedException {
		byte[] data = getTileData(zoom, x, y, loadMethod);
		if (data == null || data.length == 0) {
			if (!ignoreErrors)return null;
		}
		else {
			BufferedImage i=ImageIO.read(new ByteArrayInputStream(data));
			replaceColors(i);
			return i;
		}
		log.warn("creating empty tile "+getName()+": z="+zoom+", x="+x+", y="+y);
		BufferedImage image = new BufferedImage(256, 256, BufferedImage.TYPE_4BYTE_ABGR);
		Graphics g = (Graphics) image.getGraphics();
		try {
			// transparent background
			g.setColor(new Color(0, 0, 0, 0));
			g.fillRect(0, 0, 256, 256);
		} finally {
			g.dispose();
		}
		return image;
	}
	

}
