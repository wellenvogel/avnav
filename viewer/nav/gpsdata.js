/**
 * Created by andreas on 04.05.14.
 */
let navobjects=require('./navobjects');
let NavData=require('./navdata');
let StoreApi=require('../util/storeapi');
let Base=require('../base');
let globalStore=require('../util/globalstore.jsx');
let keys=require('../util/keys.jsx');


/**
 * the handler for the gps data
 * query the server...
 * @param {avnav.util.PropertyHandler} propertyHandler
 * @param {NavData} navobject
 * @constructor
 */
let GpsData=function(propertyHandler,navobject){
    this.base_.call(this);
    /** @private */
    this.propertyHandler=propertyHandler;
    /** @private */
    this.navobject=navobject;
    /** @private */
    this.gpsdata=new navobjects.GpsInfo();
    /** @private */
    this.formattedData= {
        gpsPosition:"NO FIX",
        gpsPositionAverage:false,
        gpsCourse:"0",
        gpsCourseAverage:false,
        gpsSpeed:"0",
        gpsSpeedAverage: false,
        gpsTime:"---",
        nmeaStatusColor:"red",
        nmeaStatusText:"???",
        aisStatusColor: "red",
        aisStatusText: "???",
        clock: "00:00",
        alarmInfo:"",
        windAngle:"000.0",
        windSpeed: "---",
        windReference: 'R',
        depthBelowTransducer: "0000.00"
    };
    this.storeKeys=[];
    for (let k in this.formattedData){
        this.storeKeys.push(k);
    }
    /** {avnav.util.Formatter} @private */
    this.formatter=new avnav.util.Formatter();
    this.timer=null;
    /** {Boolean} @private */
    this.validPosition=false;
    this.gpsErrors=0;
    this.NM=this.propertyHandler.getProperties().NM;
    this.courseAverageData=[];
    this.speedAverageData=[];
    this.latAverageData=[];
    this.lonAverageData=[];
    this.startQuery();
    this.alarms=undefined;

};
Base.inherits(GpsData,StoreApi);

GpsData.prototype.average=function(gpsdata){
    let rt=avnav.assign({},gpsdata);
    let av;
    let i;
    let self=this;
    ['course','speed','lat','lon'].forEach(function(type) {
        let key=type;
        if (type == 'lat' || type == 'lon'){
            key='position';
        }
        let avData=self[type+"AverageData"];
        av=self.propertyHandler.getProperties()[key+"AverageInterval"];
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
    let bk=keys.nav.gps;
    let d=this.gpsdata;
    globalStore.storeData(bk.lat,d.lat);
    globalStore.storeData(bk.lon,d.lon);
    globalStore.storeData(bk.position,{lat:d.lat,lon:d.lon});
    globalStore.storeData(bk.course,d.course);
    globalStore.storeData(bk.rtime,d.rtime);
    globalStore.storeData(bk.raw,d.raw);
    globalStore.storeData(bk.valid,d.valid);
    globalStore.storeData(bk.speed,d.speed);
    globalStore.storeData(bk.windAngle,d.windAngle);
    globalStore.storeData(bk.windSpeed,d.windSpeed);
    globalStore.storeData(bk.windReference,d.windReference);
    globalStore.storeData(bk.positionAverageOn,d.positionAverage);
    globalStore.storeData(bk.speedAverageOn,d.speedAverage);
    globalStore.storeData(bk.courseAverageOn,d.courseAverage);
    globalStore.storeData(bk.depthBelowTransducer,d.depthBelowTransducer);
    globalStore.storeData(bk.sequence,globalStore.getData(bk.sequence,0)+1);

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
        gpsdata={valid:false};
        //clean average data
        this.speedAverageData=[];
        this.courseAverageData=[];
        this.latAverageData=[];
        this.lonAverageData=[];
        this.alarms=undefined;
    }
    gpsdata.raw=data.raw;
    this.gpsdata=gpsdata;
    let formattedData={};
    if (status) {
        formattedData.gpsPosition = this.formatter.formatLonLats(gpsdata);
        formattedData.gpsCourse = this.formatter.formatDecimal(gpsdata.course || 0, 3, 0);
        formattedData.gpsSpeed = this.formatter.formatDecimal(gpsdata.speed || 0, 2, 1);
        formattedData.gpsTime = this.formatter.formatTime(gpsdata.rtime || new Date());
        formattedData.clock = this.formatter.formatClock(gpsdata.rtime || new Date());
        formattedData.gpsCourseAverage=gpsdata.courseAverage;
        formattedData.gpsSpeedAverage=gpsdata.speedAverage;
        formattedData.gpsPositionAverage=gpsdata.positionAverage;
    }
    formattedData.nmeaStatusColor="red";
    formattedData.nmeaStatusText="???";
    try {
        if (data.raw && data.raw.status && data.raw.status.nmea){
            formattedData.nmeaStatusColor = data.raw.status.nmea.status;
            formattedData.nmeaStatusText=data.raw.status.nmea.source+":"+data.raw.status.nmea.info;
        }
    }catch(e){}
    formattedData.aisStatusColor="red";
    formattedData.aisStatusText="???";
    try {
        if (data.raw && data.raw.status && data.raw.status.ais){
            formattedData.aisStatusColor = data.raw.status.ais.status;
            formattedData.aisStatusText=data.raw.status.ais.source+":"+data.raw.status.ais.info;
        }
    }catch(e){}
    let key;
    if (data.raw && data.raw.alarms){
        try{
            formattedData.alarmInfo=undefined;
            for (key in data.raw.alarms){
                if (formattedData.alarmInfo) {
                    formattedData.alarmInfo+=",";
                    formattedData.alarmInfo+=key;
                }
                else{
                    formattedData.alarmInfo=key;
                }
            }
        }catch(e){}
    }
    try {
        formattedData.windAngle = this.gpsdata.windAngle.toFixed(1);
        formattedData.windSpeed = this.gpsdata.windSpeed.toFixed(2);
        formattedData.windReference = this.gpsdata.windReference;
    }catch(e){
        formattedData.windReference='R';
        formattedData.windSpeed='00.00';
        formattedData.windAngle='000.0';
    }
    try {
        formattedData.depthBelowTransducer = ( data.depthBelowTransducer !== undefined) ? data.depthBelowTransducer.toFixed(2) : '0000.00';
    }catch(e){
        formattedData.depthBelowTransducer = '0000.00';
    }
    this.formattedData=formattedData;
    this.writeToStore();
};

/**
 * @private
 */
GpsData.prototype.startQuery=function(){
    let url=this.propertyHandler.getProperties().navUrl;
    let timeout=this.propertyHandler.getProperties().positionQueryTimeout;
    let self=this;
    $.ajax({
        url: url,
        dataType: 'json',
        cache:	false,
        success: function(data,status){
            if ( data.lon != null && data.lat != null &&
                data.mode != null && data.mode >=1){
                self.handleGpsResponse(data,true);
                avnav.log("gpsdata: "+self.formattedData.gpsPosition);
                self.handleGpsStatus(true);
            }
            else{
                self.handleGpsResponse(data,false);
                self.handleGpsStatus(false);
            }
            self.timer=window.setTimeout(function(){
                self.startQuery();
            },timeout);
        },
        error: function(status,data,error){
            avnav.log("query position error");
            self.handleGpsStatus(false);
            self.timer=window.setTimeout(function(){
                self.startQuery();
            },timeout);
        },
        timeout: 10000
    });

};

GpsData.prototype.stopAlarm=function(type){
    let url=this.propertyHandler.getProperties().navUrl+"?request=alarm&stop="+type;
    let timeout=this.propertyHandler.getProperties().positionQueryTimeout;
    let self=this;
    $.ajax({
        url: url,
        dataType: 'json',
        cache:	false,
        success: function(data,status){

        },
        error: function(status,data,error){
            avnav.log("unable to stop alarm "+type);
        },
        timeout: 10000
    });

};

/**
 * handle the status and trigger the FPS event
 * @param success
 */
GpsData.prototype.handleGpsStatus=function(success){
    if (! success){
        this.gpsErrors++;
        if (this.gpsErrors > this.propertyHandler.getProperties().maxGpsErrors){
            avnav.log("lost gps");
            this.validPosition=false;
            this.gpsdata.valid=false;

            //continue to count errrors...
        }
        else{
            return;
        }
    }
    else {
        this.gpsErrors=0;
        this.validPosition=true;
    }
    this.navobject.gpsEvent();
    this.callCallbacks(this.storeKeys);
};

/**
 * return the current gpsdata
 * @returns {navobjects.GpsInfo}
 */
GpsData.prototype.getGpsData=function(){
    return this.gpsdata;
};

/**
 * get the formatted value of a GPS item
 * currently the status is not considered
 * @param name
 * @returns {*}
 */
GpsData.prototype.getDataLocal=function(name){
    return this.formattedData[name];
};

/**
 * get the currently defined names for formatted data
 * @returns {Array}
 */
GpsData.prototype.getValueNames=function(){
    let rt=new Array();
    for (let k in this.formattedData){
        rt.push(k);
    }
    return rt;
};

module.exports=GpsData;
