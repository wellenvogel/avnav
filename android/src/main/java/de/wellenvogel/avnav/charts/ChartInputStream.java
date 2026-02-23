package de.wellenvogel.avnav.charts;

import java.io.IOException;
import java.io.InputStream;

// InputStream class to hand to the tile loader system. It wants an InputStream, and it is more
// efficient to create a new open file handle pointed to the right place, than to buffer the file
// in memory.
class ChartInputStream extends InputStream {

    ChartFile.AbstractFile raf = null;
    InputStream is = null;
    int remainingBytes;
    long length;

    ChartInputStream(ChartFile.AbstractFile raf, final long offset, final long length) throws IOException {
        this.raf = raf;
        raf.seek(offset);

        this.remainingBytes = (int) length;
        this.length = length;
    }

    ChartInputStream(InputStream is, long len) {
        this.is = is;
        this.length = len;
        this.remainingBytes = (int) len;
    }


    @Override
    public int available() {
        return remainingBytes;
    }

    public long getLength() {
        return length;
    }

    @Override
    public void close() throws IOException {
        remainingBytes = 0;
        if (is != null) {
            is.close();
            return;
        }
        if (raf == null) return;
        raf.close();
        raf = null;
    }

    @Override
    public boolean markSupported() {
        return false;
    }

    @Override
    public int read(final byte[] buffer, final int offset, int length) throws IOException {
        if (is != null) {
            int rt = is.read(buffer, offset, length);
            if (rt >= 0) remainingBytes -= rt;
            return rt;
        }
        if (raf == null) return -1;

        int read = raf.read(buffer, offset, length > remainingBytes ? remainingBytes : length);
        //AvnAvnLog.d(AvNav.LOGPRFX,"read returns "+read);

        remainingBytes -= read;
        if (read <= 0) {
            close();
        }
        return read;

    }

    @Override
    public int read() throws IOException {
        if (is != null) {
            if (remainingBytes > 0) {
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
