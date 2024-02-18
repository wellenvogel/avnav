/**
 * Created by andreas on 28.07.19.
 */

import Formatter from '../util/formatter.js';

export const AIS_CLASSES={
    A:'A',
    B:'B',
    Station:'S',
    Aton:'T'
};
const aisparam={
    nameOrmmsi: {
        headline: 'name/mmsi',
        format: function (v) {
            if (v.type == 21){
                if (v.name && v.name !== 'unknown') return v.name;
            }
            if (v.shipname && v.shipname !== 'unknown') return v.shipname;
            return v.mmsi;
        }
    },
    distance: {
        headline: 'dist(nm)',
        format: function (v) {
            return Formatter.formatDistance(v.distance || 0);
        },
        unit: 'nm'

    },
    heading: {
        headline: 'hdg',
        format: function (v) {
            if (v.heading === undefined) return '---';
            return Formatter.formatDirection(v.heading );
        },
        unit: '°',
        classes: [AIS_CLASSES.A,AIS_CLASSES.B]
    },
    turn: {
        headline: 'rot(°/min)',
        format: function (v) {
            if (v.turn === undefined) return '-';
            return Formatter.formatDecimal(v.turn,1,0);
        },
        unit: '°',
        classes: [AIS_CLASSES.A,AIS_CLASSES.B]
    },
    speed: {
        headline: 'speed(kn)',
        format: function (v) {
            return Formatter.formatSpeed(v.speed || 0);
        },
        unit: 'kn',
        classes:[AIS_CLASSES.A,AIS_CLASSES.B]
    },
    course: {
        headline: 'course',
        format: function (v) {
            return Formatter.formatDirection(v.course || 0);
        },
        unit: '°',
        classes:[AIS_CLASSES.A,AIS_CLASSES.B]
    },
    headingTo:{
        headline: 'hdt',
        format: function (v) {
            return Formatter.formatDirection(v.headingTo || 0);
        },
        unit: '°'
    },
    cpa: {
        headline: 'cpa',
            format: function (v) {
            if (v.cpa === undefined) return '----';
            return Formatter.formatDistance(v.cpa || 0);
        }
    },
    tcpa: {
        headline: 'tcpa',
            format: function (v) {
            if (v.tcpa === undefined) return "---------";
            let tval = parseFloat(v.tcpa || 0);
            let sign = "";
            if (tval < 0) {
                sign = "-";
                tval = -tval;
            }
            let h = Math.floor(tval / 3600);
            let m = Math.floor((tval - h * 3600) / 60);
            let s = tval - 3600 * h - 60 * m;
            return sign + Formatter.formatDecimal(h, 2, 0).replace(" ", "0") + ':' + Formatter.formatDecimal(m, 2, 0).replace(" ", "0") + ':' + Formatter.formatDecimal(s, 2, 0).replace(" ", "0");
        }
    },
    passFront: {
        headline: 'pass',
            format: function (v) {
            if (!v.cpa) return "-";
            if (v.passFront !== undefined) {
                if (v.passFront > 0) return "Front";
                if (v.passFront < 0) return "Pass";
                return "Back";
            }
            return "Done";
        }
    },
    shipname: {
        headline: 'name',
            format: function (v) {
            if ((v.shipname === undefined || v.shipname === 'unknown') && v.type == 21) return v.name;
            return v.shipname;
        },
        classes: [AIS_CLASSES.A,AIS_CLASSES.B,AIS_CLASSES.Aton]
    },
    callsign: {
        headline: 'call',
            format: function (v) {
            return v.callsign;
        },
        classes: [AIS_CLASSES.A,AIS_CLASSES.B]
    },
    mmsi: {
        headline: 'mmsi',
            format: function (v) {
            return v.mmsi;
        }
    },
    shiptype: {
        headline: 'type',
            format: function (v) {
            let t = 0;
            try {
                t = parseInt(v.shiptype || 0);
            } catch (e) {
            }
            if (t >= 20 && t <= 29) return "WIG";
            if (t == 30) return "Fishing";
            if (t == 31 || t == 32) return "Towing";
            if (t == 33) return "Dredging";
            if (t == 34) return "Diving";
            if (t == 35) return "Military";
            if (t == 36)return "Sail";
            if (t == 37) return "Pleasure";
            if (t >= 40 && t <= 49) return "HighSp";
            if (t == 50) return "Pilot";
            if (t == 51) return "SAR";
            if (t == 52) return "Tug";
            if (t == 53) return "PortT";
            if (t == 54) return "AntiPol";
            if (t == 55) return "Law";
            if (t == 58) return "Medical";
            if (t >= 60 && t <= 69) return "Passenger";
            if (t >= 70 && t <= 79) return "Cargo";
            if (t >= 80 && t <= 89) return "Tanker";
            if (t >= 91 && t <= 94) return "Hazard";
            return "Other";
        },
        classes: [AIS_CLASSES.A,AIS_CLASSES.B]
    },
    status:{
        headline: 'status',
        format: function(v){
            if (v.status === undefined){
                return "----";
            }
            let st=parseInt(v.status);
            switch (st){
                case 0: return 'Under way using engine';
                case 1: return 'At anchor';
                case 2: return 'Not under command';
                case 3: return 'Restricted manoeuverability';
                case 4: return 'Constrained by her draught';
                case 5: return 'Moored';
                case 6: return 'Aground';
                case 7: return 'Engaged in Fishing';
                case 8: return 'Under way sailing';
                case 9:
                case 10:
                case 11:
                case 12:
                case 13: return '[reserved]';
                case 14: return 'AIS-SART is active';
            }
            return st+' [unknown]'
        },
        classes:[AIS_CLASSES.A,AIS_CLASSES.B]
    },
    age: {
        headline: 'age',
        format: function(v){
            if (v.age === undefined) return '----';
            let age=v.age;
            if (v.receiveTime !== undefined){
                let now=(new Date()).getTime();
                age+=(now-v.receiveTime)/1000.0;
            }
            return Formatter.formatDecimal(age,5,2);
        },
        unit: 's'
    },
    position: {
        headline: 'position',
            format: function (v) {
            return Formatter.formatLonLats({lon: v.lon, lat: v.lat});
        }
    },
    destination: {
        headline: 'destination',
            format: function (v) {
            let d = v.destination;
            if (d) return d;
            return "unknown";
        },
        classes: [AIS_CLASSES.A,AIS_CLASSES.B]
    },
    warning: {
        headline: 'warning',
            format: function (v) {
            return v.warning || false
        }
    },
    nearest: {
        headline: 'nearest',
            format: function (v) {
            return v.nearest || false
        }
    },
    clazz: {
        headline: 'class',
        format: function(v){
            if (typeof(v) !== 'object') return '';
            if (v.type == 1 || v.type == 2 || v.type == 3) return AIS_CLASSES.A;
            if (v.type == 18 || v.type == 19) return AIS_CLASSES.B;
            if (v.type == 4) return AIS_CLASSES.Station;
            if (v.type == 21) return AIS_CLASSES.Aton;
            return "";
        }
    },
    length: {
        headline: 'length',
        format: function(v){
            if (v.length === undefined) return '---';
            return Formatter.formatDecimal(v.length,3)
        },
        unit: 'm'
    },
    beam: {
        headline: 'beam',
        format: function(v){
            if (v.beam === undefined) return '---';
            return Formatter.formatDecimal(v.beam,3);
        },
        unit: 'm'
    },
    draught: {
        headline: 'draught',
        format: function(v){
            if (v.draught === undefined) return '---';
            return Formatter.formatDecimal(v.draught,2,1);
        },
        unit: 'm',
        classes: [AIS_CLASSES.A,AIS_CLASSES.B]
    },
    aid_type: {
        headline: 'type',
        format: function (v){
            if (v.aid_type === undefined) return '---';
            let type=parseInt(v.aid_type);
            switch (type) {
                case 0:
                    return "not specified";
                case 1:
                    return "Reference point";
                case 2:
                    return "RACON";
                case 3:
                    return "Fixed structures off-shore";
                case 4:
                    return "Emergency Wreck Marking Buoy";
                case 5:
                    return "Light, without sectors";
                case 6:
                    return "Light, with sectors";
                case 7:
                    return "Leading Light Front";
                case 8:
                    return "Leading Light Rear";
                case 9:
                    return "Beacon, Cardinal N";
                case 10:
                    return "Beacon, Cardinal E";
                case 11:
                    return "Beacon, Cardinal S";
                case 12:
                    return "Beacon, Cardinal W";
                case 13:
                    return "Beacon, Port hand";
                case 14:
                    return "Beacon, Starboard hand";
                case 15:
                    return "Beacon, Preferred Channel port hand";
                case 16:
                    return "Beacon, Preferred Channel starboard hand";
                case 17:
                    return "Beacon, Isolated danger";
                case 18:
                    return "Beacon, Safe water";
                case 19:
                    return "Beacon, Special mark";
                case 20:
                    return "Cardinal Mark N";
                case 21:
                    return "Cardinal Mark E";
                case 22:
                    return "Cardinal Mark S";
                case 23:
                    return "Cardinal Mark W";
                case 24:
                    return "Port hand Mark";
                case 25:
                    return "Starboard hand Mark";
                case 26:
                    return "Preferred Channel Port hand";
                case 27:
                    return "Preferred Channel Starboard hand";
                case 28:
                    return "Isolated danger";
                case 29:
                    return "Safe Water";
                case 30:
                    return "Special Mark";
                case 31:
                    return "Light Vessel/LANBY/Rigs";
            }
            return type+" (unknown)";
        },
        classes: [AIS_CLASSES.Aton]
    }

};

const AisFormatter={
    /**
     * the formatter for AIS data
     * @private
     * @type {{distance: {headline: string, format: format}, speed: {headline: string, format: format}, course: {headline: string, format: format}, cpa: {headline: string, format: format}, tcpa: {headline: string, format: format}, passFront: {headline: string, format: format}, shipname: {headline: string, format: format}, callsign: {headline: string, format: format}, mmsi: {headline: string, format: format}, shiptype: {headline: string, format: format}, position: {headline: string, format: format}, destination: {headline: string, format: format}}}
     */

    getHeadline:function(key){
        let d=aisparam[key];
        if (! d) return ;
        return d.headline;
    },
    format(key,aisobject,inlcudeUnit){
        let d=aisparam[key];
        if (! d) return ;
        if (aisobject === undefined) return;
        let rt=d.format(aisobject);
        if (inlcudeUnit && d.unit !== undefined){
            rt+=" "+d.unit;
        }
        return rt;
    },
    getItemFromList(list,mmsi){
        if (! list) return;
        for (let i=0;i<list.length;i++){
            if (list[i].mmsi == mmsi) return list[i];
        }
    },
    getLabels(){
        let rt=[];
        for(let k in aisparam){
            rt.push({label:aisparam[k].headline,value:k});
        }
        return rt;
    },
    filterDisplay(list,item){
        let cl=aisparam.clazz.format(item);
        let rt=[];
        for (let idx in list){
            let inv=list[idx];
            let name=(typeof(inv) === 'object')?inv.name:inv;
            let param=aisparam[name];
            if (! param) continue;
            if (param.classes !== undefined){
                if (param.classes.indexOf(cl) < 0){
                    continue;
                }
            }
            rt.push(inv);
        }
        return rt;
    },
    shouldShow(key,item){
        let cl=aisparam.clazz.format(item);
        let param=aisparam[key];
        if (! param) return;
        if ( param.classes === undefined) return true;
        return param.classes.indexOf(cl) >= 0;
    }

};

export default AisFormatter;
