package mobac.mapsources.mappacks.mymappack;

import java.awt.Color;
import java.awt.Graphics;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;

import javax.imageio.ImageIO;
import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlRootElement;

import mobac.exceptions.UnrecoverableDownloadException;
import mobac.mapsources.custom.CustomMapSource;

@XmlRootElement
public class ExCustomMapSource extends CustomMapSource {
	@XmlElement(required = false, defaultValue = "false")
	private boolean ignoreErrors = false;
	@XmlElement(required = false, defaultValue="1")
	private int retries = 1;
	
	public BufferedImage getTileImage(int zoom, int x, int y, LoadMethod loadMethod)
			throws IOException, UnrecoverableDownloadException, InterruptedException {
		for (int ntry = 0; ntry < retries; ntry++) {
			byte[] data = getTileData(zoom, x, y, loadMethod);
			if (data == null) {
				if (loadMethod == LoadMethod.CACHE)
					return null;
				continue;
			}
			return ImageIO.read(new ByteArrayInputStream(data));
		}
		if (!ignoreErrors)
			return null;
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
