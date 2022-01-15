/**
 * Created by andreas on 28.07.19.
 */

import Formatter from '../util/formatter.js';

const aisparam={
    nameOrmmsi: {
        headline: 'name/mmsi',
        format: function (v) {
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
            return Formatter.formatDirection(v.headingTo || 0);
        },
        unit: '°'
    },
    speed: {
        headline: 'speed(kn)',
            format: function (v) {
            return Formatter.formatSpeed(v.speed || 0);
        },
        unit: 'kn'
    },
    course: {
        headline: 'course',
            format: function (v) {
            return Formatter.formatDirection(v.course || 0);
        },
        unit: '°'
    },
    cpa: {
        headline: 'cpa',
            format: function (v) {
            return Formatter.formatDistance(v.cpa || 0);
        }
    },
    tcpa: {
        headline: 'tcpa',
            format: function (v) {
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
            return v.shipname;
        }
    },
    callsign: {
        headline: 'call',
            format: function (v) {
            return v.callsign;
        }
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
        }
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
        }
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
            if (v.type == 1 || v.type == 2 || v.type == 3) return "A";
            if (v.type == 18 || v.type == 19) return "B";
            if (v.type == 4) return "S";
            return "";
        }
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
    }
};

export default AisFormatter;
