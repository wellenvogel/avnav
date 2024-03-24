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

import java.util.Arrays;

public class MovingSum {
    int [] values;
    int sum=0;
    long last=0;
    int idx=0;
    long lastUpdate=0;
    public MovingSum(int len){
        values=new int[len];
    }
    public synchronized void clear(){
        sum=0;
        idx=0;
        Arrays.fill(values, 0);
    }
    public synchronized int num(){
        return values.length;
    }
    public synchronized int val(){
        return sum;
    }
    public synchronized float avg(){
        if (values.length <1) return 0;
        return (float)sum/(float)(values.length);
    }
    public  boolean add(){
        return add(0);
    }
    public synchronized boolean add(int v){
        long now= SystemClock.uptimeMillis()/1000;
        if (last == 0){
            last=now;
        }
        long diff=now-last;
        last=now;
        boolean rt=false;
        if (diff > 0){
            rt=true;
            if (diff > values.length){
                clear();
            }
            else{
                while (diff > 0){
                    idx++;
                    diff--;
                    if (idx >= values.length) idx=0;
                    sum-=values[idx];
                    values[idx]=0;
                }
            }
            values[idx]=v;
            sum+=v;
        }
        else{
            values[idx]+=v;
            sum+=v;
        }
        return rt;
    }
    public synchronized boolean shouldUpdate(long interval){
        long now=SystemClock.uptimeMillis();
        if (lastUpdate == 0 || now >= (lastUpdate+interval)){
            lastUpdate=now;
            add(0);
            return true;
        }
        return false;
    }

}
