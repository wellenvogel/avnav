package de.wellenvogel.avnav.util;

import java.io.IOException;
import java.io.InputStream;
import java.io.RandomAccessFile;

import de.wellenvogel.avnav.charts.ChartFile;

public class RafInputStream extends InputStream {

    RandomAccessFile raf=null;
    long pos=0;
    long length;
    public RafInputStream(RandomAccessFile raf, long offset) throws IOException {
        this.raf = raf;
        this.length=raf.length();
        if (offset < 0) offset=0;
        if (offset >= length) offset=length-1;
        raf.seek(offset);
        pos=offset;
    }


    @Override
    public int available() {
        if (raf == null) return 0;
        return (int)(length-pos);
    }


    @Override
    public void close() throws IOException {
        pos=length;
        if (raf == null) return;
        raf.close();
        raf=null;
    }

    @Override
    public boolean markSupported() {
        return false;
    }

    @Override
    public int read(final byte[] buffer, final int offset, int len) throws IOException {
        if (raf == null) return -1;
        int btor=(len<=this.available())?len:this.available();
        if (btor == 0) {
            close();
            return -1;
        }
        int read= raf.read(buffer, offset, btor);
        if (read <= 0) {
            close();
            return -1;
        }
        else{
            pos+=read;
        }
        return read;

    }

    @Override
    public int read() throws IOException {
        if (available()>0){
            pos++;
            return raf.read();
        }
        else {
            close();
            return -1;
        }
    }

    @Override
    public long skip(long byteCount) {
        if (raf == null) return 0;
        try {
            if (byteCount < 0) {
                byteCount = -byteCount;
                if (byteCount > pos) byteCount = pos;
                raf.seek(pos - byteCount);
                return -byteCount;
            }
            if (byteCount > available()){
                byteCount=available();
            }
            raf.seek(pos+byteCount);
            pos+=byteCount;
            return byteCount;
        }catch (Exception e){
            return 0;
        }
    }
}
