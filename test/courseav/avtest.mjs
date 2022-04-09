#! /usr/bin/env node

import {CourseAverage} from '../../viewer/util/average.mjs';


const range=(start,last,step)=>{
    let rt=[];
    for (let k=start;k<=last;k+=step){
        rt.push(k);
    }
    return rt;
}
const toggle=(v1,v2,num)=>{
    let rt=[];
    for (let i=0;i<num;i++){
        if (i%2) rt.push(v2);
        else rt.push(v1);
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
    jq1: {l:20,v:[5].concat(toggle(60,60,20))},
    r1: range(10,360,5),
    r2: range(-30,540,10),
    tq1q2: {l:10,v:toggle(30,150,30)},
    tq1q2_2: {l:10,v:toggle(45,135,30)},
    tq1q2_3: {l:10,v:toggle(40,110,30)},
    tq4q1: {l:10,v:toggle(355,5,30)},
    tq4q1_2: {l:10,v:toggle(355,50,30)}


};
let len=10

let parts=process.argv.slice(2);

let cav=new CourseAverage(len)
let num=0;
for (let k in inputs){
    if (parts.length > 0 && parts.indexOf(k) < 0) continue;
    let description=inputs[k];
    let qinputs;
    let count=len;
    let type='normal';
    if (description instanceof Array){
        qinputs=description;
    }
    else{
        qinputs=description.v;
        if (description.l !== undefined) count=description.l;
        if (description.t !== undefined) type=description.t;
    }
    cav.reset(count);
    console.log("starting ",k,"type",type,"len",count);
    num=0;
    qinputs.forEach((i)=>{
        cav.add(i)
        console.log(k,num,i,cav.val())
        num++;
    })
}