#! /usr/bin/env node

import Average, {CourseAverage} from '../../viewer/util/average.mjs';


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
    tq4q1_2: {l:10,v:toggle(355,50,30)},
    tq2q3: toggle(100,190,20),
    tq2q3_2: toggle(170,190,20),
    tq2q3_3: toggle(170,260,20),
    tq3q4: toggle(260,290,20),
    tq3q4_2: toggle(260,350,20),
    tq3q4_3: toggle(190,350,20),
    //we see extrem toggles of +/- 180 - this will lead to some jumps easily
    //as small changes will either go to 0 or 180
    //but in practice this should be no issue 
    //anyway it's not worse the input values jumping by +/- 180
    etq1q3: {l:10,v:toggle(10,190,20)},  //extrem: could either be 0 or 180
    etq1q3_2: {l:10,v:toggle(11,190,20)},
    etq1q3_3: {l:10,v:toggle(10,190,20).concat(toggle(190,190,10))},
    nramp: {t:'normal',l:10,v:range(0,300,10).concat(toggle(300,300,20))},
    ntoggle: {t:'normal',l:10,v:toggle(0,20,30).concat(toggle(20,20,20))}


};
let len=10

let parts=process.argv.slice(2);

let cav=new CourseAverage(len);
let av=new Average(len);
let num=0;
for (let k in inputs){
    if (parts.length > 0 && parts.indexOf(k) < 0) continue;
    let description=inputs[k];
    let qinputs;
    let count=len;
    let type='course';
    if (description instanceof Array){
        qinputs=description;
    }
    else{
        qinputs=description.v;
        if (description.l !== undefined) count=description.l;
        if (description.t !== undefined) type=description.t;
    }
    let ua=cav;
    if (type === 'normal'){
        ua=av;
    }
    ua.reset(count);
    console.log("starting ",k,"type",type,"len",count);
    num=0;
    qinputs.forEach((i)=>{
        ua.add(i)
        console.log(k,num,i,ua.val())
        num++;
    })
}