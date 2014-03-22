package mobac.mapsources.mappacks.mymappack;

import java.awt.Color;
import java.awt.Graphics;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;

import javax.imageio.ImageIO;
import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlRootElement;
import javax.xml.bind.annotation.adapters.XmlJavaTypeAdapter;

import mobac.exceptions.UnrecoverableDownloadException;
import mobac.mapsources.custom.CustomWmsMapSource;
import mobac.program.jaxb.ColorAdapter;

/**
 * extend the CustomWmsMapSource by some features...
 */
@XmlRootElement
public class ExCustomWmsMapSource extends CustomWmsMapSource {
	/**
	 * a number of retries
	 */
	@XmlElement(required = false, defaultValue="1")
	private int retries = 1;
	@XmlElement(required = false, defaultValue = "false")
	private boolean ignoreErrors = false;
	@XmlElement(defaultValue = "#000000")
	@XmlJavaTypeAdapter(ColorAdapter.class)
	private Color backgroundColor = Color.BLACK;

	@Override
	public BufferedImage getTileImage(int zoom, int x, int y, LoadMethod loadMethod)
			throws IOException, UnrecoverableDownloadException, InterruptedException {
		for (int ntry=0;ntry<retries;ntry++){
			byte[] data = getTileData(zoom, x, y, loadMethod);
			if (data == null) {
				if (loadMethod == LoadMethod.CACHE) return null;
				continue;
			}
			return ImageIO.read(new ByteArrayInputStream(data));
		}
		if (!ignoreErrors)
			return null;
		else {
			BufferedImage image = new BufferedImage(256, 256, BufferedImage.TYPE_4BYTE_ABGR);
			Graphics g = (Graphics) image.getGraphics();
			try {
				g.setColor(backgroundColor);
				g.fillRect(0, 0, 256, 256);
			} finally {
				g.dispose();
			}
			return image;
		}
		
	}
	

}
