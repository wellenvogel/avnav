/*******************************************************************************
 * Copyright (c) MOBAC developers
 * Copyright (c) Andreas Vogel andreas@wellenvogel.de
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 ******************************************************************************/
package mobac.mapsources.mappacks.avnavbase;

import jakarta.xml.bind.*;
import mobac.exceptions.TileException;
import mobac.mapsources.AbstractHttpMapSource;
import mobac.mapsources.MapSourcesManager;
import mobac.mapsources.custom.*;
import mobac.program.interfaces.FileBasedMapSource;
import mobac.program.interfaces.MapSource;
import mobac.program.interfaces.WrappedMapSource;
import mobac.program.model.MapSourceLoaderInfo;
import mobac.program.model.MapSourceLoaderInfo.LoaderType;
import mobac.program.model.Settings;
import mobac.program.model.TileImageType;
import mobac.utilities.file.FileExtFilter;

import javax.swing.*;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.UnsupportedEncodingException;
import java.net.URLDecoder;
import java.util.Arrays;

/**
 * Example map source template.
 */
public class ExtendedXmlMapSource extends AbstractHttpMapSource implements ValidationEventHandler {


	public ExtendedXmlMapSource() {
		super("LoaderMapSource", 0, 17, TileImageType.PNG, TileUpdate.None);
	}

	@Override
	public String getTileUrl(int zoom, int tilex, int tiley) {
		return null;
	}


	@Override
	public byte[] getTileData(int zoom, int x, int y, LoadMethod loadMethod) throws IOException,
			TileException, InterruptedException {
		InputStream is = this.getClass().getResourceAsStream("Default.png");
		byte[] buffer = new byte[10000];
		is.read(buffer, 0, buffer.length);
		return buffer;
	}

	@Override
	public String toString() {
		return "DummySource - do not use!";
	}


	@Override
	//some dirty trick here - this method is called after we have been loaded
	public void setLoaderInfo(MapSourceLoaderInfo loaderInfo) {
		super.setLoaderInfo(loaderInfo);
		init();
		loadCustomMapSources();
	}


	private Unmarshaller unmarshaller = null;

	private void init() {
		try {
			Class<?>[] customMapClasses = new Class[]{CustomMapSource.class, CustomWmsMapSource.class,
					CustomMultiLayerMapSource.class,  CustomLocalTileFilesMapSource.class,
					CustomLocalTileZipMapSource.class, CustomLocalTileSQliteMapSource.class,
					ExCustomWmsMapSource.class, ExCustomMultiLayerMapSource.class, ExCustomMapSource.class};
			JAXBContext context = JAXBContext.newInstance(customMapClasses);
			unmarshaller = context.createUnmarshaller();
			unmarshaller.setEventHandler(this);
		} catch (JAXBException e) {
			throw new RuntimeException("Unable to create JAXB context for custom map sources", e);
		}
	}

	/**
	 * we extend extend the features of the mapsources that mobac provides...
	 */
	private void loadCustomMapSources() {
		MapSourcesManager mapSourcesManager = MapSourcesManager.getInstance();
		File mapSourcesDir = Settings.getInstance().getMapSourcesDirectory();
		if (mapSourcesDir == null || !mapSourcesDir.isDirectory())
			throw new RuntimeException("Map sources directory is unset");
		File[] customMapSourceFiles = mapSourcesDir.listFiles(new FileExtFilter(".exml"));
		Arrays.sort(customMapSourceFiles);
		for (File f : customMapSourceFiles) {
			try {
				MapSource customMapSource;
				Object o = unmarshaller.unmarshal(f);
				if (o instanceof WrappedMapSource)
					customMapSource = ((WrappedMapSource) o).getMapSource();
				else
					customMapSource = (MapSource) o;
				customMapSource.setLoaderInfo(new MapSourceLoaderInfo(LoaderType.XML, f));
				if (!(customMapSource instanceof FileBasedMapSource) && customMapSource.getTileImageType() == null)
					log.warn("A problem occured while loading \"" + f.getName()
							+ "\": tileType is null - some atlas formats will produce an error!");
				log.trace("Custom map source loaded: " + customMapSource + " from file \"" + f.getName() + "\"");
				mapSourcesManager.addMapSource(customMapSource);
			} catch (Exception e) {
				log.error("failed to load custom map source \"" + f.getName() + "\": " + e.getMessage(), e);
			}
		}
	}


	public boolean handleEvent(ValidationEvent event) {
		ValidationEventLocator loc = event.getLocator();
		String file = loc.getURL().getFile();
		try {
			file = URLDecoder.decode(file, "UTF-8");
		} catch (UnsupportedEncodingException e) {
			throw new RuntimeException(e);
		}
		int lastSlash = file.lastIndexOf('/');
		if (lastSlash > 0)
			file = file.substring(lastSlash + 1);

		String errorMsg = event.getMessage();
		if (errorMsg == null) {
			Throwable t = event.getLinkedException();
			while (t != null && errorMsg == null) {
				errorMsg = t.getMessage();
				t = t.getCause();
			}
		}

		JOptionPane
				.showMessageDialog(null, "<html><h3>Failed to load a custom map</h3><p><i>" + errorMsg
								+ "</i></p><br><p>file: \"<b>" + file + "</b>\"<br>line/column: <i>" + loc.getLineNumber()
								+ "/" + loc.getColumnNumber() + "</i></p>", "Error: custom map loading failed",
						JOptionPane.ERROR_MESSAGE);
		log.error(event.toString());
		return false;
	}
}



