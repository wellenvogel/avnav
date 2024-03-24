/*
    Copyright (c) 2012,2021,2019,2024 Andreas Vogel andreas@wellenvogel.net
    MIT license
    Permission is hereby granted, free of charge, to any person obtaining a
    copy of this software and associated documentation files (the "Software"),
    to deal in the Software without restriction, including without limitation
    the rights to use, copy, modify, merge, publish, distribute, sublicense,
    and/or sell copies of the Software, and to permit persons to whom the
    Software is furnished to do so, subject to the following conditions:
    The above copyright notice and this permission notice shall be included
    in all copies or substantial portions of the Software.
    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
    OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
    THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
    FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
    DEALINGS IN THE SOFTWARE.
 */
package de.wellenvogel.avnav.util;

import android.os.SystemClock;

import java.util.ArrayList;


public class NmeaQueue {
    public static class Entry{
        public int sequence;
        public String data;
        public String source;
        public int priority=0;
        public long receiveTime=0;
        Entry(int s,String d,String source){
            this.sequence=s;
            this.data=d;
            this.source=source;
            this.receiveTime=SystemClock.uptimeMillis();
        }
        Entry(int s,String d,String source, int priority){
            this.sequence=s;
            this.data=d;
            this.source=source;
            this.priority=priority;
            this.receiveTime=SystemClock.uptimeMillis();
        }
    }
    private int length=30;
    private int sequence=0;
    private ArrayList<Entry> queue =new ArrayList<Entry>();
    public NmeaQueue(int length){
        this.length=length;
    }
    public NmeaQueue(){}

    public synchronized int add(String data,String source,int priority){
        sequence++;
        queue.add(new Entry(sequence,data,source,priority));
        if (queue.size() > length) queue.remove(0);
        notifyAll();
        return sequence;
    }

    public synchronized Entry fetch(int sequence,long maxWait,long maxAge) throws InterruptedException {
        long start= SystemClock.uptimeMillis();
        long end=start+maxWait;
        int queuePos=-1;
        while (queue.size() < 1 || queue.get(queue.size()-1).sequence <= sequence){
            queuePos=queue.size()-1; //where to start searching
            long remain=end-SystemClock.uptimeMillis();
            if (remain <= 0) return null;
            wait(remain);
        }
        long oldest=SystemClock.uptimeMillis()-maxAge;
        //start looking for matching sequences at the last position
        //in the "good case" just one entry was written and exactly at queue pos there is now the next entry
        //if multiple entries had been written, we must go back...
        //we stop going back if the entry is to old any way...
        if (queuePos > 0 && queuePos < queue.size() && queue.get(queuePos).sequence > sequence){
            while (queuePos > 0){
                Entry e=queue.get(queuePos);
                if (e.sequence <= (sequence+1) || e.receiveTime < oldest) break;
                queuePos--;
            }
        }
        else{
            queuePos=0;
        }
        for (int i=queuePos;i<queue.size();i++){
            Entry e=queue.get(i);
            if (e.sequence > sequence && e.receiveTime >= oldest ) return queue.get(i);
        }
        return null;
    }
    public synchronized void clear(){
        queue.clear();
        notifyAll();
    }


}
