package de.wellenvogel.avnav.charts;

import android.content.Context;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.support.annotation.NonNull;
import android.support.v4.provider.DocumentFile;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.util.AvnLog;

/**
 *abstract chart File handler class.
 *

 * @author Andreas Vogel
 *
 */
public abstract class ChartFile {


	protected Context mContext;
	protected DocumentFile mDocument;
	protected File mRealFile;

	// Tile ranges represented within this archive
	protected final List<ChartRange> mRangeData = new ArrayList<ChartRange>();
	// List of tile sources within this archive
	protected final LinkedHashMap<Integer, String> mSources = new LinkedHashMap<Integer, String>();

	public abstract String getScheme();

	public String getOriginalScheme() {return null;}

	public abstract boolean setScheme(String newScheme) throws Exception;

	public abstract long getSequence();


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
		private ParcelFileDescriptor descriptor;
		StreamAbstractFile(ParcelFileDescriptor descriptor) throws IOException{
			this.descriptor=descriptor;
			channel=(new FileInputStream(descriptor.getFileDescriptor())).getChannel();
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
			return channel.size();
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
	 * Constructor to read existing chart archive
	 *
	 * @param pLocation
	 * 		File object representing first GEMF archive file
	 */
	public ChartFile(final File pLocation) throws FileNotFoundException, IOException {
		mRealFile=pLocation;
	}



	public ChartFile(DocumentFile document, Context context) throws IOException{
		mDocument =document;
		mContext=context;
	}

	/**
	 * must be called by derived classes
	 * @throws IOException
	 */
	protected void initialize() throws Exception {
		if (mDocument != null){
			openFilesUri();
		}
		else{
			openFiles();
		}
		readHeader();
	}






	/*
	 * Close open files file handles.
	 */
	public abstract void close() throws IOException ;

	public abstract int numFiles();

	/**
	 * open all necessary files
	 * @throws FileNotFoundException
	 */
	protected abstract void openFiles() throws FileNotFoundException;

	AbstractFile fileFromContentUri(Uri uri) throws IOException{

		ParcelFileDescriptor fdi=mContext.getContentResolver().openFileDescriptor(uri,"r");
		return new StreamAbstractFile(fdi);
	}

	/**
	 * open all files if we have a content uri
	 * @throws IOException
	 */

	protected abstract void openFilesUri() throws IOException;


	@NonNull
	@Override
	protected Object clone() throws CloneNotSupportedException {
		return super.clone();
	}

	/*
	 * Read header of archive, cache Ranges.
	 * fill mRanges,mSources
	 * not thread safe!
	 */
	 protected abstract void readHeader() throws Exception;


	// ===========================================================
	// Public Methods
	// ===========================================================


	/*
	 * Returns the base name of the first file in the GEMF archive.
	 */
	public String getName() {
		if (mDocument != null) return mDocument.getName();
		return mRealFile.getName();
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

		for (final ChartRange rs: mRangeData) {
			zoomLevels.add(rs.zoom);
		}

		return zoomLevels;
	}


	/*
	 * Get an InputStream for the tile data specified by the Z/X/Y coordinates.
	 *
	 * @return InputStream of tile data, or null if not found.
	 */
	public abstract ChartInputStream getInputStream(final int pX, final int pY, final int pZ, final int sourceIndex) throws IOException;

	public List<ChartRange> getRanges(){
		return mRangeData;
	}


	// ===========================================================
	// Inner and Anonymous Classes
	// ===========================================================

	// Class to represent a range of stored tiles within the archive.
	public class ChartRange {
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
					"CHART Range: source=%d, zoom=%d, x=%d-%d, y=%d-%d, offset=0x%08X",
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
	class ChartInputStream extends InputStream {

		AbstractFile raf=null;
		InputStream is=null;
		int remainingBytes;
		long length;

		ChartInputStream(AbstractFile raf, final long offset, final long length) throws IOException {
			this.raf = raf;
			raf.seek(offset);

			this.remainingBytes = (int)length;
			this.length=length;
		}
		ChartInputStream(InputStream is,long len){
			this.is=is;
			this.length=len;
			this.remainingBytes = (int)len;
		}


		@Override
		public int available() {
			return remainingBytes;
		}

		public long getLength(){
			return length;
		}

		@Override
		public void close() throws IOException {
			remainingBytes=0;
			if (is != null){
				is.close();
				return;
			}
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
			if (is != null){
				int rt=is.read(buffer,offset,length);
				if (rt >=0) remainingBytes-=rt;
				return rt;
			}
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
			if (is != null){
				if (remainingBytes > 0){
					remainingBytes--;
					return is.read();
				}
				return -1;
			}
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
