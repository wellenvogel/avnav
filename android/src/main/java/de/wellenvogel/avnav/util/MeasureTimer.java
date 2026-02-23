package de.wellenvogel.avnav.util;

import android.os.SystemClock;

import java.util.ArrayList;

/*
# Copyright (c) 2022,2025 Andreas Vogel andreas@wellenvogel.net

#  Permission is hereby granted, free of charge, to any person obtaining a
#  copy of this software and associated documentation files (the "Software"),
#  to deal in the Software without restriction, including without limitation
#  the rights to use, copy, modify, merge, publish, distribute, sublicense,
#  and/or sell copies of the Software, and to permit persons to whom the
#  Software is furnished to do so, subject to the following conditions:
#
#  The above copyright notice and this permission notice shall be included
#  in all copies or substantial portions of the Software.
#
#  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
#  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
#  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
#  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
#  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
#  DEALINGS IN THE SOFTWARE.
*/
public class MeasureTimer {
    private static class TS{
        public String name;
        public long ts;
        public TS(String name,long ts){
            this.name=name;
            this.ts=ts;
        }
    }
    private ArrayList<TS> measures=new ArrayList<>();
    private long start;
    protected long getTs(){
        return SystemClock.uptimeMillis();
    }
    public MeasureTimer(){
        start();
    }
    public void start(){
        measures.clear();
        start=getTs();
    }
    public void add(String name){
        measures.add(new TS(name,getTs()));
    }
    public String toString(){
        StringBuilder sb=new StringBuilder("Timer ");
        long last=start;
        for (TS ts:measures){
            sb.append(ts.name).append(':');
            sb.append(ts.ts-start).append(':');
            sb.append(ts.ts-last).append(", ");
            last=ts.ts;
        }
        return sb.toString();
    }

}
