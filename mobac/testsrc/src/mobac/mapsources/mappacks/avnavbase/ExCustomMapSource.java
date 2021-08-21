package mobac.mapsources.mappacks.avnavbase;

import java.awt.Color;
import java.awt.Graphics;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.ProtocolException;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;

import javax.imageio.ImageIO;


import jakarta.xml.bind.Unmarshaller;
import jakarta.xml.bind.annotation.*;
import jakarta.xml.bind.annotation.adapters.XmlJavaTypeAdapter;
import org.apache.log4j.Logger;

import mobac.exceptions.UnrecoverableDownloadException;
import mobac.mapsources.MapSourceTools;
//import mobac.mapsources.mappacks.avnavbase.ExCustomWmsMapSource.LayerMapping;
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
	
	private HashMap<Integer, Color> converterMap=new HashMap<Integer, Color>();

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
	
	/**
	 * merge in lower levels if my current tile has transparent areas
	 * only considered in numLowerLevels > 0
	 */
	@XmlElement(required=false,defaultValue="false")
	protected boolean mergeLevels=false;
	
	@XmlElement(nillable = false, defaultValue = "Custom")
	private String name = "Custom";

	@XmlElement(defaultValue = "0")
	protected int minZoom = 0;

	@XmlElement(required = true)
	protected int maxZoom = 0;

	@XmlElement(defaultValue = "PNG")
	protected TileImageType tileType = TileImageType.PNG;
	@XmlElement(defaultValue = "PNG")
	protected String intermediateTileFormat="PNG";

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

	@XmlElement(nillable = true)
	protected String userAgent;
	
	/**
	 * set a list of HTTP error codes that will lead to 
	 * storing an empty tile in the cache - thus avoiding repeated downloads
	 */
	
	@XmlElement(required = false, defaultValue = "")
	@XmlList
	private String[] serverParts = null;
	private int currentServerPart = 0;

	/**
	 * set some http headers if required
	 */
	@XmlElement(required = false, defaultValue = "")
	@XmlList
	private String[] httpHeader = null;

	@XmlElementWrapper(name="colorMappings")
	@XmlElements({ @XmlElement(name = "colorMapping", type = ColorMapping.class)})
	private ArrayList<ColorMapping>colormappings=new ArrayList<ColorMapping>();
	
	
	
	protected void afterUnmarshal(Unmarshaller u, Object parent) {
		for(ColorMapping c: colormappings){
			log.debug("adding color mapping from "+c.in+" to "+c.out);
			converterMap.put(c.in.getRGB()&0xffffff,
					c.out);
		}
		if (tileType == null){
			throw new RuntimeException("invalid tileType - null");
		}
		if (tileUpdate == null){
			tileUpdate=TileUpdate.None;
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
		log.trace("geTileUrlConnection: "+url);
		if (url == null)
			return null;
		HttpURLConnection rt=(HttpURLConnection) new URL(url).openConnection();
		if (userAgent != null && !userAgent.isEmpty()){
			rt.setRequestProperty("User-agent",userAgent);
		}
		if (httpHeader != null && httpHeader.length>0){
			for(String header: httpHeader){
				String nv[]=header.split(":",2);
				rt.setRequestProperty(nv[0],nv[1]);
			}
		}
		return rt;
	}

	@Override
	public void prepareConnection(HttpURLConnection httpURLConnection) throws ProtocolException {

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
	
	
	private byte[] imageToBytes(BufferedImage image){
		ByteArrayOutputStream os = new ByteArrayOutputStream();
		try {
			ImageIO.write(image, intermediateTileFormat, os);
			return os.toByteArray();
		} catch (IOException e) {
			return null;
		}
	}
	
	
	private byte[]
	fetchTileData(int zoom, int x, int y, LoadMethod loadMethod) throws IOException,
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
			
			catch (Throwable e) {
				log.debug(name + " download failed with Exception (retries)" + e);
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
	
	/**
	 * replace Colors and check for alpha==0
	 * @param image
	 */
	protected boolean replaceColors(BufferedImage image){
		boolean doConversions=converterMap.size() != 0;
		if (!doConversions && ! (mergeLevels && (numLowerLevels>0)))return false;
		if (!doConversions && ! image.getColorModel().hasAlpha()) return false;
		int width = image.getWidth();
        int height = image.getHeight();
        int lastin=0;
        int lastout=0;
        boolean hasAlpha0=false;
        for (int xx = 0; xx < width; xx++) {
            for (int yy = 0; yy < height; yy++) {
            	int pix=image.getRGB(xx, yy);
            	if (! doConversions){
            		if ((pix & 0xff000000) == 0) return true;
            	}
            	if ((pix & 0xff000000) == 0) {
            		hasAlpha0=true;
            		continue;
            	}
            	int val=pix&0xffffff;
            	if (val == lastin){
            		if (val == lastout) continue;
            		val = lastout;
            		if ((lastout & 0xff000000) == 0xff000000) {
            			//no alpha
						image.setRGB(xx, yy, pix & 0xff000000 | val);
					}
					else{
						//alpha
						image.setRGB(xx, yy, val);
					}
            		continue;
            	}
            	lastin=val;
            	Color ov=converterMap.get(val);
            	if (ov == null){
            		lastout=val;
            		continue;
            	}
				lastout=ov.getRGB();
            	if (ov.getAlpha() == 255){
            		//no alpha
					image.setRGB(xx, yy, pix&0xff000000| lastout & 0xffffff);
				}
				else{
					//take alpha from conversion
					image.setRGB(xx, yy, lastout);
				}

            }
        }
        return hasAlpha0;
	}

	/**
	 * get image with extended error handling and retries
	 */
	public BufferedImage getTileImage(int zoom, int x, int y, LoadMethod loadMethod)
			throws IOException, UnrecoverableDownloadException, InterruptedException {
		byte [] data=getTileData(zoom, x, y, loadMethod);
		if (data == null || data.length==0) {
			log.debug(name+" no data in getTileImage for z="+zoom+", x="+x+", y="+y);
			return null;
		}
		BufferedImage i = ImageIO.read(new ByteArrayInputStream(data));
		return i;
	}
	/*
	 * we have to do all conversion already when loading into the cache
	 */
	public byte[] getTileData(int zoom, int x, int y, LoadMethod loadMethod)
			throws IOException, UnrecoverableDownloadException, InterruptedException {
		int currentZoom=zoom;
		int currSize=256;
		int currentFactor=1;
		int orix=x;
		int oriy=y;
		log.trace(name+" getTileData z="+zoom+", x="+x+", y="+y+", loadMethod="+loadMethod);
		ArrayList<BufferedImage> stack=new ArrayList<BufferedImage>(numLowerLevels+1);
		for (int nz = 0; nz <= numLowerLevels && currentZoom >= getMinZoom(); nz++) {
			for (int ntry = 0; ntry < retries; ntry++) {
				byte[] data = fetchTileData(currentZoom, x, y, loadMethod);
				if (data == null || data.length == 0) {
					if (ntry < (retries-1)) log.debug(name+"retrying download for z="+zoom+", x="+x+", y="+y);
					else log.debug(name+" unable to download after retry for z="+zoom+", x="+x+", y="+y);
					continue;
				}
				if (zoom == currentZoom && ! mergeLevels && converterMap.size() == 0){
					return data;
				}
				BufferedImage i = ImageIO.read(new ByteArrayInputStream(data));
				boolean hasAlpha0=replaceColors(i);
				//if there is no alpha in the image and we are at the right level - and no conversions...
				if (!hasAlpha0 && (zoom ==currentZoom) && converterMap.size() == 0){
					return data;
				}
				BufferedImage image=null;
				if (zoom != currentZoom) {
					// we must zoom the image and pick the right part from it...
					int xoffset = (orix % currentFactor) * (256 / currentFactor);
					int yoffset = (oriy % currentFactor) * (256 / currentFactor);
					log.trace("zooming up for tile " + getName() + ": z=" + zoom + ", nz="
							+ currentZoom + ", x=" + orix + ", y=" + oriy + ", xofs=" + xoffset
							+ ", yoffs=" + yoffset + ", fac=" + currentFactor);
					image = new BufferedImage(256, 256, BufferedImage.TYPE_4BYTE_ABGR);
					Graphics g = (Graphics) image.getGraphics();
					g.drawImage(i, 0, 0, 256, 256, xoffset, yoffset, xoffset + currSize, yoffset
							+ currSize, null);
					g.dispose();
				}
				else{
					image=i;
				}
				stack.add(image);
				if (hasAlpha0){
					continue;
				}
				//here we are if the image has no alpha but is already a lower zoom level
				break;
			}
			//try to load from a lower zoom level
			currentZoom-=1;
			//TODO: handle invert y
			x=x/2;
			y=y/2;
			currSize/=2;
			currentFactor*=2;
		}
		if (stack.size() == 1){
			return imageToBytes(stack.get(0));
		}
		if (stack.size()>0){
			log.trace("creating merged tile ("+stack.size()+" elements) "+getName()+" z="+zoom+", x="+x+",y= "+y);
			//we must now merge the images in the stack (top down...)
			BufferedImage image = new BufferedImage(256, 256, BufferedImage.TYPE_4BYTE_ABGR);
			Graphics g = (Graphics) image.getGraphics();
			for (int i=stack.size()-1;i>=0;i--){
				g.drawImage(stack.get(i), 0, 0,256, 256, 0, 0, 256, 256, null);
			}
			g.dispose();
			return imageToBytes(image);
		}
		if (! ignoreErrors)
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
		replaceColors(image);
		return imageToBytes(image);
	}
	

}
