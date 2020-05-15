/**
 * Created by andreas on 04.05.14.
 */
import navobjects from './navobjects';
import NavData from './navdata';
import Base from '../base';
import globalStore from '../util/globalstore.jsx';
import keys,{KeyHelper} from '../util/keys.jsx';
import Formatter from '../util/formatter';
import assign from 'object-assign';
import Requests from '../util/requests.js';
import base from '../base.js';


const ignoredKeys=[
    'source',
    'tag',
    'mode'
];

/**
 * the handler for the gps data
 * query the server...
 * @constructor
 */
const GpsData=function(){

   
    this.timer=null;

    this.gpsErrors=0;
    this.courseAverageData=[];
    this.speedAverageData=[];
    this.latAverageData=[];
    this.lonAverageData=[];
    this.startQuery();
    this.additionalKeys={}; //collect additonal keys here to reset them if not received any more

};

GpsData.prototype.average=function(gpsdata){
    let rt=gpsdata;
    let av;
    let i;
    let self=this;
    ['course','speed','lat','lon'].forEach(function(type) {
        let key=type;
        if (type == 'lat' || type == 'lon'){
            key='position';
        }
        let avData=self[type+"AverageData"];
        av=globalStore.getData(KeyHelper.keyNodeToString(keys.properties)+"."+key+"AverageInterval");
        rt[key+"Average"]=(av>0);
        if (av) {
            avData.push(gpsdata[type]);
            if (avData.length > av) {
                avData.shift();
            }
            if (avData.length > 0) {
                let nv=0;
                for (i = 0; i < avData.length; i++) {
                     nv+= avData[i];
                }
                nv = nv / avData.length;
                rt[type]=nv;
            }
        }
    });
    return rt;
};

GpsData.prototype.writeToStore=function(gpsData,additionalKeys){
    let d=assign({},gpsData,{
        position:new navobjects.Point(gpsData.lon,gpsData.lat),
        sequence:globalStore.getData(keys.nav.gps.sequence,0)+1
    });
    globalStore.storeMultiple(d,assign({},this.getStoreKeys(),additionalKeys));

};
/**
 *
 * @param data
 * @private
 */
GpsData.prototype.handleGpsResponse=function(data, status){
    let gpsdata={
        lat:0,
        lon:0,
        course:0,
        speed:0
    };
    gpsdata.connectionLost=!this.handleGpsStatus(status);
    if (status) {
        gpsdata.valid=(data.lat != null && data.lon != null && data.mode != null && data.mode >=1);
        gpsdata.rtime = null;
        if (data.time != null && data.time !== undefined) gpsdata.rtime = new Date(data.time);
        delete data.time;
        gpsdata.lon = data.lon;
        delete data.lon;
        gpsdata.lat = data.lat;
        delete data.lat;
        gpsdata.course = data.course;
        delete data.course;
        if (gpsdata.course === undefined) gpsdata.course = data.track;
        delete data.track;
        gpsdata.speed = data.speed;
        delete data.speed;
        gpsdata=this.average(gpsdata);
        gpsdata.windAngle = (data.windAngle !== undefined) ? data.windAngle : 0;
        delete data.windAngle;
        gpsdata.windSpeed = (data.windSpeed !== undefined) ? data.windSpeed : 0;
        delete data.windSpeed;
        gpsdata.windReference = data.windReference || 'R';
        delete data.windReference;
        //gpsdata.depthBelowTransducer=data.depthBelowTransducer;
        //delete data.depthBelowTransducer;
    }
    if (!gpsdata.valid){
        //clean average data
        this.speedAverageData=[];
        this.courseAverageData=[];
        this.latAverageData=[];
        this.lonAverageData=[];
    }
    //we write to store if we received valid data
    //or until we consider this as invalid
    if (status || gpsdata.connectionLost) {
        //store any additonal data we received
        //we will unwind any objects to the leaves
        //TODO: get the keys from the server
        let additionalKeys={};
        let predefined=this.getStoreKeys();
        let base=KeyHelper.keyNodeToString(keys.nav.gps);
        for (let k in data){
            if (ignoredKeys.indexOf(k)>=0) continue;
            if (predefined[k]) continue; //ignore any key we use internally
            additionalKeys[k]=this.computeKeys(k,data[k],base);
            gpsdata[k]=data[k];
        }
        assign(this.additionalKeys,additionalKeys);
        this.writeToStore(gpsdata,this.additionalKeys);
    }
};

GpsData.prototype.computeKeys=function(key,data,base){
    let path=base+"."+key;
    if (data instanceof Object){
        let sub={};
        for (let i in data){
           sub[i]=this.computeKeys(i,data[i],path)
        }
        return sub;
    }
    else{
        return path;
    }
};

/**
 * @private
 */
GpsData.prototype.startQuery=function(){
    let self=this;
    let timeout=parseInt(globalStore.getData(keys.properties.positionQueryTimeout,1000));
    Requests.getJson("?request=gps",{checkOk:false}).then(
        (data)=>{
            self.handleGpsResponse(data,true);
            self.timer=window.setTimeout(function(){
                self.startQuery();
            },timeout);
        }
    ).catch(
        (error)=>{
            base.log("query position error");
            self.handleGpsResponse({},false);
            self.timer=window.setTimeout(function(){
                self.startQuery();
            },timeout);
        }
    );


};



/**
 * handle the status and trigger the FPS event
 * @param success
 */
GpsData.prototype.handleGpsStatus=function(success){
    if (! success){
        this.gpsErrors++;
        if (this.gpsErrors > globalStore.getData(keys.properties.maxGpsErrors)){
            base.log("lost gps");
            return false;

            //continue to count errrors...
        }
        else{
            return true;
        }
    }
    else {
        this.gpsErrors=0;
    }
    return true;
};


GpsData.prototype.getStoreKeys=function(){
    let bk=keys.nav.gps;
    return {
        lat:bk.lat,
        lon:bk.lon,
        course:bk.course,
        rtime:bk.rtime,
        valid:bk.valid,
        speed:bk.speed,
        windAngle:bk.windAngle,
        windSpeed:bk.windSpeed,
        windReference:bk.windReference,
        positionAverage:bk.positionAverageOn,
        speedAverage: bk.speedAverageOn,
        courseAverage: bk.courseAverageOn,
        depthBelowTransducer: bk.depthBelowTransducer,
        position:bk.position,
        sequence:bk.sequence,
        connectionLost: bk.connectionLost
    }
};
GpsData.getStoreKeys=GpsData.prototype.getStoreKeys;

module.exports=GpsData;
