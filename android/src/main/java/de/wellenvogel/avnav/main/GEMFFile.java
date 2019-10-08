package de.wellenvogel.avnav.main;

import android.content.Context;
import android.net.Uri;
import android.os.ParcelFileDescriptor;

import de.wellenvogel.avnav.util.AvnLog;

import java.io.File;
import java.io.FileDescriptor;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

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
public class GEMFFile {

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

	// Path to first GEMF file (additional files as <basename>-1, <basename>-2, ...
	private String mLocation="";



	private Context mContext;
	private Uri mUri;

	// All GEMF file parts for this archive
	private final List<AbstractFile> mFiles = new ArrayList<AbstractFile>();
	private final List<String> mFileNames = new ArrayList<String>();

	// Tile ranges represented within this archive
	private final List<GEMFRange> mRangeData = new ArrayList<GEMFRange>();

	// File sizes for offset calculation
	private final List<Long> mFileSizes = new ArrayList<Long>();

	// List of tile sources within this archive
	private final LinkedHashMap<Integer, String> mSources = new LinkedHashMap<Integer, String>();


	private Object lock=new Object();

	static interface AbstractFile{
		public void close() throws IOException;
		int read(byte[] buffer, int offset, int length) throws IOException;
		int readInt() throws IOException;
		long readLong() throws IOException;
		long length() throws IOException;
		void seek(long offset) throws IOException;
		int read() throws IOException;
	}

	class GRandomAcccesFile extends RandomAccessFile implements AbstractFile{

		public GRandomAcccesFile(File file, String mode) throws FileNotFoundException {
			super(file, mode);
		}
		public GRandomAcccesFile(String name) throws FileNotFoundException{
			super(name,"r");
		}
	}

	class StreamAbstractFile implements AbstractFile{

		private FileChannel channel;
		private long length=0;
		StreamAbstractFile(FileInputStream is,long length) throws IOException{
			channel=is.getChannel();
			this.length=length;
		}

		@Override
		public void close() throws IOException {
			channel.close();
		}

		@Override
		public int read(byte[] buffer, int offset, int length) throws IOException {
			return channel.read(ByteBuffer.wrap(buffer,offset,length));
		}

		@Override
		public int readInt() throws IOException {
			ByteBuffer rt=ByteBuffer.allocate(Integer.SIZE/Byte.SIZE);
			int rd=channel.read(rt);
			if (rd<rt.limit()) throw new IOException("unable to read int");
			return rt.getInt(0);
		}

		@Override
		public long readLong() throws IOException {
			ByteBuffer rt=ByteBuffer.allocate(Long.SIZE/Byte.SIZE);
			int rd=channel.read(rt);
			if (rd<rt.limit()) throw new IOException("unable to read long");
			return rt.getLong(0);
		}

		@Override
		public long length() throws IOException {
			return length;
		}

		@Override
		public void seek(long offset) throws IOException {
			channel.position(offset);
		}

		@Override
		public int read() throws IOException {
			ByteBuffer out=ByteBuffer.allocate(1);
			int num=channel.read(out);
			if (num == 1){
				return  out.get(0);
			}
			return -1;
		}
	}


	// ===========================================================
	// Constructors
	// ===========================================================


	/*
	 * Constructor to read existing GEMF archive
	 *
	 * @param pLocation
	 * 		File object representing first GEMF archive file
	 */
	public GEMFFile (final File pLocation) throws FileNotFoundException, IOException {
		this(pLocation.getAbsolutePath());
	}


	/*
	 * Constructor to read existing GEMF archive
	 *
	 * @param pLocation
	 * 		String object representing path to first GEMF archive file
	 */
	public GEMFFile (final String pLocation) throws FileNotFoundException, IOException {
		mLocation = pLocation;
		openFiles();
		readHeader();
	}

	public GEMFFile(Uri contentUri,Context context) throws IOException{
		mUri=contentUri;
		mContext=context;
		openFilesUri();
		readHeader();
	}




	// ===========================================================
	// Private Methods
	// ===========================================================


	/*
	 * Close open GEMF file handles.
	 */
	public void close() throws IOException {
		for (final AbstractFile file: mFiles) {
			file.close();
		}
	}


	/*
	 * Find all files composing this GEMF archive, open them as RandomAccessFile
	 * and add to the mFiles list.
	 */
	private void openFiles() throws FileNotFoundException {
		// Populate the mFiles array

		final File base = new File(mLocation);
		mFiles.add(new GRandomAcccesFile(base, "r"));
		mFileNames.add(base.getPath());

		int i = 0;
		for(;;) {
			i = i + 1;
			final File nextFile = new File(mLocation + "-" + i);
			if (nextFile.exists()) {
				mFiles.add(new GRandomAcccesFile(nextFile, "r"));
				mFileNames.add(nextFile.getPath());
			} else {
				break;
			}
		}
	}

	private AbstractFile fileFromContentUri(Uri uri) throws IOException{
		ParcelFileDescriptor fdi=mContext.getContentResolver().openFileDescriptor(uri,"r");
		if (fdi == null) throw new FileNotFoundException("URI: "+uri+" not found");
		return new StreamAbstractFile(new FileInputStream(fdi.getFileDescriptor()),fdi.getStatSize());
	}

	private void openFilesUri() throws IOException {
		// Populate the mFiles array
		mFiles.add(fileFromContentUri(mUri));
		mFileNames.add(mUri.toString());

		int i = 0;
		for(;;) {
			i = i + 1;
			Uri nextUri=Uri.parse(mUri.toString()+"-"+i);
			AbstractFile nextFile=null;
			try {
				nextFile = fileFromContentUri(nextUri);
			}catch (IOException e) {
			}
			if (nextFile != null){
				mFiles.add(nextFile);
				mFileNames.add(nextUri.toString());
			} else {
				break;
			}
		}
	}


	/*
	 * Read header of archive, cache Ranges.
	 * not thread safe!
	 */
	private void readHeader() throws IOException {
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

		for (int i=0;i<sourceCount;i++) {
			final int sourceIndex = baseFile.readInt();
			final int sourceNameLength = baseFile.readInt();
			final byte[] nameData = new byte[sourceNameLength];
			baseFile.read(nameData, 0, sourceNameLength);

			final String sourceName = new String(nameData);
			mSources.put(new Integer(sourceIndex), sourceName);
		}

		// Read Ranges
		final int num_ranges = baseFile.readInt();
		for (int i=0;i<num_ranges;i++) {
			final GEMFRange rs = new GEMFRange();
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
	 * Returns the base name of the first file in the GEMF archive.
	 */
	public String getName() {
		if (mUri != null) return mUri.getLastPathSegment();
		return mLocation;
	}

	/*
	 * Returns a LinkedHashMap of the sources in this archive, as names and indexes.
	 */
	public LinkedHashMap<Integer, String> getSources() {
		return mSources;
	}


	/*
	 * Return list of zoom levels contained within this archive.
	 */
	public Set<Integer> getZoomLevels() {
		final Set<Integer> zoomLevels = new TreeSet<Integer>();

		for (final GEMFRange rs: mRangeData) {
			zoomLevels.add(rs.zoom);
		}

		return zoomLevels;
	}


	/*
	 * Get an InputStream for the tile data specified by the Z/X/Y coordinates.
	 *
	 * @return InputStream of tile data, or null if not found.
	 */
	public GEMFInputStream getInputStream(final int pX, final int pY, final int pZ, final int sourceIndex) {
		GEMFRange range = null;

		for (final GEMFRange rs: mRangeData)
		{
			if ((pZ == rs.zoom)
					&& (pX >= rs.xMin)
					&& (pX <= rs.xMax)
					&& (pY >= rs.yMin)
					&& (pY <= rs.yMax)
					&& (rs.sourceIndex == sourceIndex) ) {
				range = rs;
				break;
			}
		}

		if (range == null)	{
			return null;
		}

		long dataOffset;
		int dataLength;

		try	{

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
			if (dataOffset > mFileSizes.get(0))	{
				final int fileListCount = mFileSizes.size();

				while ((index < (fileListCount - 1)) &&
						(dataOffset > mFileSizes.get(index))) {

					dataOffset -= mFileSizes.get(index);
					index += 1;
				}

			}
			String name=mFileNames.get(index);
			if (name == null) return null;
			if (mUri == null) {
				return new GEMFInputStream(new GRandomAcccesFile(name), dataOffset, dataLength);
			}
			else{
				return new GEMFInputStream(fileFromContentUri(Uri.parse(name)),dataOffset,dataLength);
			}

		} catch (final java.io.IOException e) {
			AvnLog.d(Constants.LOGPRFX, "exception when searching for offset: " + e.getLocalizedMessage());
			return null;
		}
	}

	public List<GEMFRange> getRanges(){
		return mRangeData;
	}


	// ===========================================================
	// Inner and Anonymous Classes
	// ===========================================================

	// Class to represent a range of stored tiles within the archive.
	public class GEMFRange	{
		public Integer zoom;
		public Integer xMin;
		public Integer xMax;
		public Integer yMin;
		public Integer yMax;
		public Integer sourceIndex;
		public Long offset;

		@Override
		public String toString() {
			return String.format(
					"GEMF Range: source=%d, zoom=%d, x=%d-%d, y=%d-%d, offset=0x%08X",
					sourceIndex, zoom, xMin, xMax, yMin, yMax, offset);
		}
		public void fillValues(HashMap<String,String> map){
			if (map == null) return;
			map.put("MINX",""+xMin);
			map.put("MINY",""+yMin);
			map.put("MAXX",""+xMax);
			map.put("MAXY",""+yMax);
			map.put("ZOOM",""+zoom);
		}
	}

	// InputStream class to hand to the tile loader system. It wants an InputStream, and it is more
	// efficient to create a new open file handle pointed to the right place, than to buffer the file
	// in memory.
	class GEMFInputStream extends InputStream {

		AbstractFile raf=null;
		int remainingBytes;
		int length;

		GEMFInputStream(AbstractFile raf, final long offset, final int length) throws IOException {
			this.raf = raf;
			raf.seek(offset);

			this.remainingBytes = length;
			this.length=length;
		}


		@Override
		public int available() {
			return remainingBytes;
		}

		public int getLength(){
			return length;
		}

		@Override
		public void close() throws IOException {
			remainingBytes=0;
			if (raf == null) return;
			raf.close();
			raf=null;
		}

		@Override
		public boolean markSupported() {
			return false;
		}

		@Override
		public int read(final byte[] buffer, final int offset, int length) throws IOException {
			if (raf == null ) return -1;

			int read= raf.read(buffer, offset, length > remainingBytes ? remainingBytes : length);
			//AvnAvnLog.d(AvNav.LOGPRFX,"read returns "+read);

			remainingBytes -= read;
			if (read <= 0) {
				close();
			}
			return read;

		}

		@Override
		public int read() throws IOException {
			if (raf == null) throw new IOException("already closed");
			if (remainingBytes > 0) {
				remainingBytes--;
				return raf.read();
			} else {
				close();
				return -1;
			}
		}

		@Override
		public long skip(final long byteCount) {
			return 0;
		}
	}
}
