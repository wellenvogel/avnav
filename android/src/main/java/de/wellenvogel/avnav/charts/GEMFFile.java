package de.wellenvogel.avnav.charts;

import android.content.Context;
import android.net.Uri;
import android.support.v4.provider.DocumentFile;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.util.AvnLog;

/**
 * GEMF File handler class.
 *
 * Reference: https://sites.google.com/site/abudden/android-map-store
 * taken from: https://raw.githubusercontent.com/osmdroid/osmdroid/master/osmdroid-android/src/main/java/org/osmdroid/util/GEMFFile.java
 * improved to handle multiple sources correctly and allow thread safe access to tiles
 * Remark:
 *    all the opening part is not thread safe - so this must be finished within one thread
 *    only later access is allowed to be run in multiple threads
 * @author A. S. Budden
 * @author Erik Burrows
 * @author Andreas Vogel
 *
 */
public class GEMFFile  extends ChartFile {

	// ===========================================================
	// Constants
	// ===========================================================


	private static final int VERSION = 4;
	private static final int TILE_SIZE = 256;

	private static final int U32_SIZE = 4;
	private static final int U64_SIZE = 8;


	// ===========================================================
	// Fields
	// ===========================================================


	// All GEMF file parts for this archive
	private final List<AbstractFile> mFiles = new ArrayList<AbstractFile>();
	private final List<String> mFileNames = new ArrayList<String>();


	// File sizes for offset calculation
	private final List<Long> mFileSizes = new ArrayList<Long>();


	private final Object lock = new Object();


	// ===========================================================
	// Constructors
	// ===========================================================


	@Override
	public String getScheme() {
		return null;
	}

	@Override
	public boolean setScheme(String newScheme) throws Exception{
		throw new Exception("unable to set scheme for gemf files");
	}

	@Override
	public long getSequence() {
		return 1;
	}

	/*
	 * Constructor to read existing GEMF archive
	 *
	 * @param pLocation
	 * 		File object representing first GEMF archive file
	 */
	public GEMFFile(final File pLocation) throws Exception {
		super(pLocation);
		initialize();
	}

	public GEMFFile(DocumentFile document, Context context) throws Exception {
		super(document, context);
		initialize();
	}


	/*
	 * Close open GEMF file handles.
	 */
	@Override
	public void close() throws IOException {
		for (final AbstractFile file : mFiles) {
			file.close();
		}
	}

	@Override
	public int numFiles() {
		return mFileNames.size();
	}


	// ===========================================================
	// Private Methods
	// ===========================================================

	/*
	 * Find all files composing this GEMF archive, open them as RandomAccessFile
	 * and add to the mFiles list.
	 */
	@Override
	protected void openFiles() throws FileNotFoundException {
		// Populate the mFiles array

		final File base = mRealFile;
		mFiles.add(new GRandomAcccesFile(base, "r"));
		mFileNames.add(base.getPath());

		int i = 0;
		for (; ; ) {
			i = i + 1;
			final File nextFile = new File(base.getPath() + "-" + i);
			if (nextFile.exists()) {
				mFiles.add(new GRandomAcccesFile(nextFile, "r"));
				mFileNames.add(nextFile.getPath());
			} else {
				break;
			}
		}
	}

	@Override
	protected void openFilesUri() throws IOException {
		// Populate the mFiles array
		mFiles.add(fileFromContentUri(mDocument.getUri()));
		mFileNames.add(mDocument.getUri().toString());
		DocumentFile directory = mDocument.getParentFile();
		int i = 0;
		for (; ; ) {
			i = i + 1;
			String nextName = mDocument.getName() + "-" + i;
			DocumentFile nextFile = directory.findFile(nextName);
			AbstractFile nextEntry = null;
			if (nextFile != null) {
				nextEntry = fileFromContentUri(nextFile.getUri());
			}
			if (nextEntry != null) {
				mFiles.add(nextEntry);
				mFileNames.add(nextFile.getUri().toString());
			} else {
				break;
			}
		}
	}


	/*
	 * Read header of archive, cache Ranges.
	 * not thread safe!
	 */
	protected void readHeader() throws IOException {
		final AbstractFile baseFile = mFiles.get(0);

		// Get file sizes
		for (final AbstractFile file : mFiles) {
			mFileSizes.add(file.length());
		}

		// Version
		final int version = baseFile.readInt();
		if (version != VERSION) {
			throw new IOException("Bad file version: " + version);
		}

		// Tile Size
		final int tile_size = baseFile.readInt();
		if (tile_size != TILE_SIZE) {
			throw new IOException("Bad tile size: " + tile_size);
		}

		// Read Source List
		final int sourceCount = baseFile.readInt();

		for (int i = 0; i < sourceCount; i++) {
			final int sourceIndex = baseFile.readInt();
			final int sourceNameLength = baseFile.readInt();
			final byte[] nameData = new byte[sourceNameLength];
			baseFile.read(nameData, 0, sourceNameLength);

			final String sourceName = new String(nameData);
			mSources.put(new Integer(sourceIndex), sourceName);
		}

		// Read Ranges
		final int num_ranges = baseFile.readInt();
		for (int i = 0; i < num_ranges; i++) {
			final ChartRange rs = new ChartRange();
			rs.zoom = baseFile.readInt();
			rs.xMin = baseFile.readInt();
			rs.xMax = baseFile.readInt();
			rs.yMin = baseFile.readInt();
			rs.yMax = baseFile.readInt();
			rs.sourceIndex = baseFile.readInt();
			rs.offset = baseFile.readLong();
			mRangeData.add(rs);
		}
	}


	// ===========================================================
	// Public Methods
	// ===========================================================


	/*
	 * Get an InputStream for the tile data specified by the Z/X/Y coordinates.
	 *
	 * @return InputStream of tile data, or null if not found.
	 */
	public ChartInputStream getInputStream(final int pX, final int pY, final int pZ, final int sourceIndex) {
		ChartRange range = null;

		for (final ChartRange rs : mRangeData) {
			if ((pZ == rs.zoom)
					&& (pX >= rs.xMin)
					&& (pX <= rs.xMax)
					&& (pY >= rs.yMin)
					&& (pY <= rs.yMax)
					&& (rs.sourceIndex == sourceIndex)) {
				range = rs;
				break;
			}
		}

		if (range == null) {
			return null;
		}

		long dataOffset;
		int dataLength;

		try {

			// Determine offset to requested tile record in the header
			final int numY = range.yMax + 1 - range.yMin;
			final int xIndex = pX - range.xMin;
			final int yIndex = pY - range.yMin;
			long offset = (xIndex * numY) + yIndex;
			offset *= (U32_SIZE + U64_SIZE);
			offset += range.offset;

			//here we need to lock for reading the offset...
			synchronized (lock) {
				// Read tile record from header, get offset and size of data record
				final AbstractFile baseFile = mFiles.get(0);
				baseFile.seek(offset);
				dataOffset = baseFile.readLong();
				dataLength = baseFile.readInt();
			}

			// Seek to correct data file and offset.
			int index = 0;
			if (dataOffset > mFileSizes.get(0)) {
				final int fileListCount = mFileSizes.size();

				while ((index < (fileListCount - 1)) &&
						(dataOffset > mFileSizes.get(index))) {

					dataOffset -= mFileSizes.get(index);
					index += 1;
				}

			}
			String name = mFileNames.get(index);
			if (name == null) return null;
			if (mDocument == null) {
				return new ChartInputStream(new GRandomAcccesFile(name), dataOffset, dataLength);
			} else {
				return new ChartInputStream(fileFromContentUri(Uri.parse(name)), dataOffset, dataLength);
			}

		} catch (final java.io.IOException e) {
			AvnLog.d(Constants.LOGPRFX, "exception when searching for offset: " + e.getLocalizedMessage());
			return null;
		}
	}
}