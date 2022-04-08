#! /usr/bin/env node

import {CourseAverage} from '../../viewer/util/average.js';

/*
class Average{
    constructor(length) {
        this.length=parseInt(length||0);
        this.currentValue=undefined;
        this.values=[];
    }
    reset(opt_length){
        this.currentValue=undefined;
        this.values=[];
        if (opt_length !==undefined){
            this.length=parseInt(opt_length);
        }
    }
    getLength(){
        return this.length;
    }
    add(val){
        if (this.currentValue === undefined || this.length < 1) {
            this.currentValue = val;
            this.values.push(val);
            return val;
        }
        if (this.values.length >= this.length){
            this.currentValue-=this.values.shift();
        }
        this.currentValue+=val;
        this.values.push(val)
        return this.currentValue/this.values.length;
    }
    val(){
        if (this.values.length < 1){
            return this.currentValue;
        }
        return this.currentValue/this.values.length;
    }

}

class CourseAverage extends Average{
    constructor(length) {
        super(length);
    }
    inRange(val){
        while (val >= 360) val-=360;
        while (val < 0) val+=360;
        return val;
    }
    //some simplified (i.e. linearized) sin
    linSin(val){
        val=this.inRange(val);
        if (val >= 0 && val < 90) return val;
        if (val >= 90 && val < 180) return 90-(val-90);
        if (val >= 180 && val < 270) return -(val-180);
        return -90+(val-270);
    }
    //some simplified (i.e. linearized) cos
    linCos(val){
        val=this.inRange(val);
        if (val >= 0 && val < 90) return 90-val;
        if (val >= 90 && val < 180) return -(val-90);
        if (val >= 180 && val < 270) return -90+(val-180);
        return val-270;
    }
    getEntry(val){
        return [this.linSin(val),this.linCos(val)]
    }
    add(val){
        if (this.length < 1) return;
        this.values.push(this.getEntry(val));
        if (this.values.length > this.length ){
            this.values.shift()
        }
    }
    reverse(x,y){
        //to acurate we use the vale that is closer to 90°
        //at 45 x and y should be equal anyway
        if (x >= 0){
            //q1,q2
            if (y >= 0){
                //q1
                return x <= 45 ? x : 90 - y;
            }
            else{
                //q2
                return x <= 45 ? 90 + (90 - x) : 180 - (90 + y)
            }
        }
        else{
            //q3,q4
            if (y >= 0){
                //q4
                return x <= 45 ? 360 + x : 270 + y;
            }
            else{
                //q3
                return x <= 45 ? 180 - x : 270 + y;
            }
        }
    }
    val(){
        if (this.values.length < 1) return undefined;
        let sum=[0,0];
        this.values.forEach((v)=>{
            sum[0]+=v[0];
            sum[1]+=v[1];
        });
        sum[0]=sum[0]/this.values.length;
        sum[1]=sum[1]/this.values.length;
        return this.reverse(sum[0],sum[1]);
    }

}
*/

const range=(start,last,step)=>{
    let rt=[];
    for (let k=start;k<=last;k+=step){
        rt.push(k);
    }
    return rt;
}

let inputs={
    q1: [10,20,30,20,10,20,30,20,10],
    q1_2: [40,50,40,50,42,48,43,47,45,45],
    q1_3: [0,10,20,30,40,50,60,70,80,90,80,70,60,50,40,20],
    q2: [90,100,95,110,120,130,120,125],
    q3: [180,190,185,200,210,220,230,240],
    q4: [275,280,290,300,290,300,290,300,290,300],
    q4q1: [358,359,0,1,358,2,359,361,3,358],
    q1q2: [89,90,91,89,92,88,80,100,90,90.5,89.3],
    q1q2_2: [80,100,81,99,82,98,80,100,70,110],
    r1: range(10,360,5),
    r2: range(-30,540,10)

};
let len=10

let parts=process.argv.slice(2);

let cav=new CourseAverage(len)
let num=0;
for (let k in inputs){
    if (parts.length > 0 && parts.indexOf(k) < 0) continue;
    cav.reset();
    let qinputs=inputs[k];
    console.log("starting ",k)
    num=0;
    qinputs.forEach((i)=>{
        cav.add(i)
        console.log(k,num,i,cav.val())
        num++;
    })
}