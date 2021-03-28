package de.wellenvogel.avnav.util;

import java.util.ArrayList;


public class NmeaQueue {
    public static class Entry{
        public int sequence;
        public String data;
        public String source;
        Entry(int s,String d,String source){
            this.sequence=s;
            this.data=d;
            this.source=source;
        }
    }
    private int length=30;
    private int sequence=0;
    private ArrayList<Entry> queue =new ArrayList<Entry>();
    public NmeaQueue(int length){
        this.length=length;
    }
    public NmeaQueue(){}

    public synchronized int add(String data,String source){
        sequence++;
        queue.add(new Entry(sequence,data,source));
        if (queue.size() > length) queue.remove(0);
        notifyAll();
        return sequence;
    }

    public synchronized Entry fetch(int sequence,long maxWait) throws InterruptedException {
        long start=System.currentTimeMillis();
        long end=start+maxWait;
        while (queue.size() < 1 || queue.get(queue.size()-1).sequence <= sequence){
            long remain=end-System.currentTimeMillis();
            if (remain <= 0) return null;
            wait(remain);
        }
        for (int i=0;i<queue.size();i++){
            if (queue.get(i).sequence > sequence) return queue.get(i);
        }
        return null;
    }
    public synchronized void clear(){
        queue.clear();
        notifyAll();
    }


}
