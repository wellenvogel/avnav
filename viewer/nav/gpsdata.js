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


/**
 * the handler for the gps data
 * query the server...
 * @constructor
 */
const GpsData=function(){
    /** @private */
    this.gpsdata=new navobjects.GpsInfo();

   
    this.timer=null;

    this.gpsErrors=0;
    this.NM=globalStore.getData(keys.properties.NM);
    this.courseAverageData=[];
    this.speedAverageData=[];
    this.latAverageData=[];
    this.lonAverageData=[];
    this.startQuery();
    this.alarms=undefined;

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

GpsData.prototype.writeToStore=function(){
    let d=assign({},this.gpsdata,{
        position:new navobjects.Point(this.gpsdata.lon,this.gpsdata.lat),
        alarms:this.gpsdata.raw?this.gpsdata.raw.alarms:undefined,
        sequence:globalStore.getData(keys.nav.gps.sequence,0)+1
    });
    globalStore.storeMultiple(d,this.getStoreKeys());

};
/**
 *
 * @param data
 * @private
 */
GpsData.prototype.handleGpsResponse=function(data, status){
    let gpsdata=new navobjects.GpsInfo();
    gpsdata.valid=false;
    if (status) {
        gpsdata.rtime = null;this.latAverageData=[];
        if (data.time != null) gpsdata.rtime = new Date(data.time);
        gpsdata.lon = data.lon;
        gpsdata.lat = data.lat;
        gpsdata.course = data.course;
        if (gpsdata.course === undefined) gpsdata.course = data.track;
        gpsdata.speed = data.speed * 3600 / this.NM;
        gpsdata=this.average(gpsdata);
        gpsdata.windAngle = (data.windAngle !== undefined) ? data.windAngle : 0;
        gpsdata.windSpeed = (data.windSpeed !== undefined) ? data.windSpeed : 0;
        gpsdata.windReference = data.windReference || 'R';
        gpsdata.valid = true;
        this.alarms=data.alarms;
    }
    else{
        gpsdata.valid=false;
        //clean average data
        this.speedAverageData=[];
        this.courseAverageData=[];
        this.latAverageData=[];
        this.lonAverageData=[];
        this.alarms=undefined;
    }
    gpsdata.raw=data.raw;
    this.gpsdata=gpsdata;
    this.writeToStore();
};

/**
 * @private
 */
GpsData.prototype.startQuery=function(){
    let self=this;
    let timeout=globalStore.getData(keys.properties.positionQueryTimeout,1000);
    Requests.getJson("?request=gps",{checkOk:false}).then(
        (data)=>{
            if ( data.lon != null && data.lat != null &&
                data.mode != null && data.mode >=1){
                self.handleGpsResponse(data,true);
                self.handleGpsStatus(true);
            }
            else{
                self.handleGpsResponse(data,false);
                self.handleGpsStatus(false);
            }
            self.timer=window.setTimeout(function(){
                self.startQuery();
            },timeout);
        }
    ).catch(
        (error)=>{
            avnav.log("query position error");
            self.handleGpsStatus(false);
            self.timer=window.setTimeout(function(){
                self.startQuery();
            },timeout);
        }
    );


};

GpsData.prototype.stopAlarm=function(type){
    //we also remove the alarm from the store to ensure that all widgets get updated
    let alarms=assign({},globalStore.getData(keys.nav.gps.alarms));
    delete alarms[type];
    globalStore.storeData(keys.nav.gps.alarms,alarms);
    Requests.getJson("?request=alarm&stop="+type).then(
        (json)=>{

        }
    ).catch(
        (error)=>{
            avnav.log("unable to stop alarm "+type);
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
            avnav.log("lost gps");
            this.gpsdata.valid=false;

            //continue to count errrors...
        }
        else{
            return;
        }
    }
    else {
        this.gpsErrors=0;
        this.gpsdata.valid=true;
    }
};

/**
 * return the current gpsdata
 * @returns {navobjects.GpsInfo}
 */
GpsData.prototype.getGpsData=function(){
    return this.gpsdata;
};

GpsData.prototype.getStoreKeys=function(){
    let bk=keys.nav.gps;
    return {
        lat:bk.lat,
        lon:bk.lon,
        course:bk.course,
        rtime:bk.rtime,
        raw: bk.raw,
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
        alarms:bk.alarms,
        sequence:bk.sequence
    }
};
GpsData.getStoreKeys=GpsData.prototype.getStoreKeys;

module.exports=GpsData;
