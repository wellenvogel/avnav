/**
 * Created by andreas on 04.05.14.
 */
import navobjects from './navobjects';
import globalStore from '../util/globalstore.jsx';
import keys,{KeyHelper} from '../util/keys.jsx';
import assign from 'object-assign';
import Requests from '../util/requests.js';
import base from '../base.js';
import Average, {CourseAverage} from "../util/average.mjs";


const ignoredKeys=[
    'source',
    'tag',
    'mode'
];
const specialHandling=[
    'time',
    'track',
    'course',
    'courseAverageOn',
    'speedAverageOn',
    'positionAverageOn'
];
/**
 * the handler for the gps data
 * query the server...
 * @constructor
 */
const GpsData=function(){


    this.timer=null;

    this.gpsErrors=0;

    this.resetAverages();
    globalStore.register(()=>this.resetAverages(),[
        keys.properties.positionAverageInterval,
        keys.properties.courseAverageInterval,
        keys.properties.speedAverageInterval,
        keys.gui.global.propertiesLoaded
    ]);
    this.additionalKeys={}; //collect additonal keys here to reset them if not received any more
    let skeys=this.getStoreKeys();
    this.filteredStoreKeys={};
    this.genericStoreKeys={};
    for (let k in skeys){
        if (ignoredKeys.indexOf(k) >= 0) continue;
        this.filteredStoreKeys[k]=skeys[k];
        if (specialHandling.indexOf(k) >= 0) continue;
        this.genericStoreKeys[k]=skeys[k];
    }
};

const averageLen=(key)=>{
    return globalStore.getData(KeyHelper.keyNodeToString(keys.properties)+'.'+key+'AverageInterval');
}

class GpsAverage extends Average{
    constructor(key) {
        super(averageLen(key));
        this.key=key;
    }
    setEnabled(data){
        if (! data) return;
        data[this.key+'AverageOn']=this.getLength() > 0;
    }
}
class GpsCourseAverage extends CourseAverage{
    constructor(key) {
        super(averageLen(key));
        this.key=key;
    }
    setEnabled(data){
        if (! data) return;
        data[this.key+'AverageOn']=this.getLength() > 0;
    }
}

GpsData.prototype.resetAverages=function(){
    this.averages={
        lat: new GpsAverage('position'),
        lon: new GpsAverage('position'),
        course: new GpsCourseAverage('course'),
        speed: new GpsAverage('speed'),
    }
};

GpsData.prototype.average=function(gpsdata){
    let rt=gpsdata;
    for (let type in this.averages) {
        let avHolder = this.averages[type];
        if (avHolder.getLength()) {
            if (gpsdata[type] !== undefined) {
                avHolder.add(gpsdata[type]);
            }
            rt[type] = avHolder.val();
        }
        avHolder.setEnabled(rt);
    }
    return rt;
};

GpsData.prototype.writeToStore=function(gpsData,additionalKeys){
    let d=assign({},gpsData,{
        position:new navobjects.Point(gpsData.lon,gpsData.lat),
        sequence:globalStore.getData(keys.nav.gps.sequence,0)+1
    });
    globalStore.storeMultiple(d,assign({},this.filteredStoreKeys,additionalKeys));

};

/**
 *
 * @param data
 * @private
 */
GpsData.prototype.handleGpsResponse=function(data, status){
    let gpsdata={
        lat:undefined,
        lon:undefined,
        course:undefined,
        speed:undefined
    };
    gpsdata.connectionLost=!this.handleGpsStatus(status);
    if (status) {
        gpsdata.valid=(data.lat !== null && data.lat !== undefined && data.lon !== null && data.lon !== undefined );
        gpsdata.rtime = undefined;
        if (data.time !== null && data.time !== undefined) gpsdata.rtime = new Date(data.time);
        delete data.time;
        gpsdata.course = data.course;
        delete data.course;
        if (gpsdata.course === undefined) gpsdata.course = data.track;
        delete data.track;
        for (let k in this.genericStoreKeys){
            if (data[k] !== undefined){
                gpsdata[k]=data[k];
                delete data[k];
            }
        }
        gpsdata=this.average(gpsdata);
    }
    if (!gpsdata.valid){
        for (let k in this.averages){
            this.averages[k].reset();
        }
    }
    //we write to store if we received valid data
    //or until we consider this as invalid
    if (status || gpsdata.connectionLost) {
        //store any additonal data we received
        //we will unwind any objects to the leaves
        let base=KeyHelper.keyNodeToString(keys.nav.gps);
        for (let k in data){
            if (ignoredKeys.indexOf(k)>=0) continue;
            if (this.filteredStoreKeys[k]) continue; //ignore any key we use internally
            let keys=this.computeKeys(k,data[k],base);
            if(typeof(keys)=="object" && typeof(this.additionalKeys[k])=="object") {
              keys = assign(this.additionalKeys[k],keys);
            } else {
              this.additionalKeys[k]=keys;
            }
            gpsdata[k]=data[k];
        }
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
 *
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
    return keys.nav.gps.getKeys();
};
GpsData.getStoreKeys=GpsData.prototype.getStoreKeys;

export default GpsData;
