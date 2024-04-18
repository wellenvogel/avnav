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

import net.sf.marineapi.nmea.sentence.SentenceValidator;

import java.util.ArrayList;


public class NmeaQueue {
    public static class Entry{
        public int sequence;
        public String data;
        public String source;
        public int priority=0;
        public boolean validated=false;
        public long receiveTime=0;
        public boolean valid=false;
        Entry(int s,String d,String source){
            this.sequence=s;
            this.data=d;
            this.source=source;
            this.receiveTime=SystemClock.uptimeMillis();
            valid=true;
        }
        Entry(int s,String d,String source, int priority){
            this.sequence=s;
            this.data=d;
            this.source=source;
            this.priority=priority;
            this.receiveTime=SystemClock.uptimeMillis();
            valid=true;
        }
        Entry(int s){
            sequence=s;
            valid=false;
            this.receiveTime=SystemClock.uptimeMillis();
        }
    }

    public static class Fetcher{
        NmeaQueue queue;
        long statusInterval=200;
        public static interface StatusUpdate{
            void update(MovingSum received, MovingSum errors);
        }
        StatusUpdate updater;
        MovingSum received;
        MovingSum errors;
        int sequence=-1;
        public Fetcher(NmeaQueue queue,StatusUpdate updater,long updateInterval){
            this.queue=queue;
            this.updater=updater;
            this.statusInterval=updateInterval;
            received=new MovingSum(10);
            errors=new MovingSum(10);
        }
        public void reset(){
            sequence=-1;
            received.clear();
            errors.clear();
        }
        private void status(){
            if (received.shouldUpdate(this.statusInterval)){
                if (updater != null) {
                    received.add(0);
                    errors.add(0);
                    updater.update(received,errors);
                }
            }
        }
        public boolean hasData(){
            return received.val() > 0;
        }
        public static String getStatusString(MovingSum received,MovingSum errors){
            return String.format("%s NMEA data rcv=%.2f/s,err=%d/10s", (received.val() > 0) ? "receiving" : "no", received.avg(), errors.val());
        }
        public String getStatusString(){
            return getStatusString(received,errors);
        }
        public Entry fetch(long maxWait,long maxAge) throws InterruptedException{
            try {
                Entry rt=queue.fetch(sequence,maxWait,maxAge);
                if (rt == null){
                    status();
                    return rt;
                }
                if (sequence > 0 && rt.sequence > (sequence+1)){
                    errors.add(rt.sequence-sequence-1);
                }
                else{
                    errors.add(0);
                }
                sequence = rt.sequence;
                if (! rt.valid){
                    status();
                    return null;
                }
                if (rt.validated){
                    received.add(1);
                }
                status();
                return rt;
            } catch (InterruptedException e){
                status();
                throw e;
            }
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
        if (data == null) return sequence;
        Entry e=new Entry(sequence,data,source,priority);
        sequence++;
        if ((data.startsWith("$") && SentenceValidator.isValid(data)) || data.startsWith("!")){
            e.validated=true;
        }
        queue.add(e);
        if (queue.size() > length) queue.remove(0);
        notifyAll();
        return sequence;
    }

    public synchronized Entry fetch(int sequence,long maxWait,long maxAge) throws InterruptedException {
        long start= SystemClock.uptimeMillis();
        long end=start+maxWait;
        int queuePos=queue.size()-1;
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
        if (queue.size() < 1) return null;
        //it seems that only outdated entries are in the queue
        //do not check them again - return an invalid entry with
        //the current highest sequence
        //users will start looking only from this sequence when calling again
        int highestSequence=queue.get(queue.size()-1).sequence;
        if (highestSequence > sequence) {
            //we lost messages as they are too old
            //but it makes no sense to query them again
            //so return an invalid entry with the highest sequence
            return new Entry(highestSequence);
        }
        return null;
    }
    public synchronized void clear(){
        queue.clear();
        notifyAll();
    }


}
