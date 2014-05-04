/*
# vim: ts=2 sw=2 et
###############################################################################
# Copyright (c) 2014, Andreas Vogel andreas@wellenvogel.net
# parts of software from movable-type
# http://www.movable-type.co.uk/
# for their license see the file latlon.js
#
#  Permission is hereby granted, free of charge, to any person obtaining a
#  copy of this software and associated documentation files (the "Software"),
#  to deal in the Software without restriction, including without limitation
#  the rights to use, copy, modify, merge, publish, distribute, sublicense,
#  and/or sell copies of the Software, and to permit persons to whom the
#  Software is furnished to do so, subject to the following conditions:
#
#  The above copyright notice and this permission notice shall be included
#  in all copies or substantial portions of the Software.
#
#  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
#  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
#  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
#  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
#  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
#  DEALINGS IN THE SOFTWARE.
###############################################################################

icons partly from http://www.tutorial9.net/downloads/108-mono-icons-huge-set-of-minimal-icons/
*/

goog.require('avnav.gui.Handler');
goog.require('avnav.map.MapHolder');
goog.require('avnav.util.PropertyHandler');
goog.require('avnav.nav.NavObject');
/**
 * currently we must require all pages somewhere
 */
goog.require('avnav.gui.Mainpage');
goog.require('avnav.gui.Statuspage');
goog.require('avnav.gui.Navpage');


var properties={
        NM:1852, //one mile
        slideTime: 300, //time in ms for upzoom
        slideLevels: 3, //start with that many lower zoom levels
		maxUpscale:2, //2 levels upscale (otherwise we need too much mem)
		hideLower: true, //if set, hide smaller zoom layers when completely covered
		maxZoom: 21,  //only allow upscaling up to this zom level
		minGridLedvel: 10,
		showOSM: true,
		rightPanelWidth: 60, //currently not used
		loggingEnabled: true,
		positionQueryTimeout: 1000, //1000ms
		trackQueryTimeout: 5000, //10s
		bearingColor: "#DDA01F",
		bearingWidth: 3,
		trackColor: "#D71038",
		trackWidth: 3,
		trackInterval: 30, //seconds
		initialTrackLength: 24*120, //multiplies with trackInterval - so this gives 24h
		aisQueryTimeout: 5000, //ms
		aisDistance: 20, //distance for AIS query in nm
		maxAisErrors: 3, //after that many errors AIS display will be switched off
		minAISspeed: 0.2, //minimal speed in kn that we consider when computing cpa/tcpa
		maxAisTPA: 3,    //max. computed AIS TPA time in h (otherwise we do not consider this)
		aisWarningCpa: 0.274, //nm for AIS warning (500m)
		aisWarningTpa: 900, //in s - max time for tpa warning (15min)
		aisNearestImage: 'images/ais-nearest.png',
		aisWarningImage: 'images/ais-warning.png',
		statusQueryTimeout: 3000, //ms
                centerDisplayTimeout: 45000, //ms - auto hide measure display (0 - no auto hide)
		navUrl: "avnav_navi.php",
		maxGpsErrors: 3, //after that much invalid responses/timeouts the GPS is dead
		cookieName: "avnav",
		statusErrorImage: "images/RedBubble40.png",
		statusOkImage: "images/GreenBubble40.png",
		pages: ["main","nav","ais","status"],
		statusIcons: {
			INACTIVE: "images/GreyBubble40.png",
			STARTED:  "images/YellowBubble40.png",
			RUNNING:  "images/YellowBubble40.png",
			NMEA:	  "images/GreenBubble40.png",
			ERROR:	  "images/RedBubble40.png"
		}
};

var aisparam={
		distance:{
			headline: 'dist(nm)',
			format: function(v){ return formatDecimal(parseFloat(v.distance||0),3,2);}
		},
		speed: {
			headline: 'speed(kn)',
			format: function(v){ return formatDecimal(parseFloat(v.speed||0),3,1);}
		},
		course:	{
			headline: 'course',
			format: function(v){ return formatDecimal(parseFloat(v.course||0),3,0);}
		},
		cpa:{
			headline: 'cpa',
			format: function(v){ return formatDecimal(parseFloat(v.cpa||0),3,2);}
		},
		tcpa:{
			headline: 'tcpa',
			format: function(v){
				var tval=parseFloat(v.tcpa||0);
				var h=Math.floor(tval/3600);
				var m=Math.floor((tval-h*3600)/60);
				var s=tval-3600*h-60*m;
				return formatDecimal(h,2,0)+':'+formatDecimal(m,2,0)+':'+formatDecimal(s,2,0);
				}
		},
    passFront:{
      headline: 'pass',
      format: function(v){
        if (! v.cpa) return "-";
        if (v.passFront) return "Front";
        return "Back";
      }
    },
		shipname:{
			headline: 'name',
			format: function(v){ return v.shipname;}
		},
		callsign:{
			headline: 'call',
			format: function(v){ return v.callsign;}
		},
		mmsi: {
			headline: 'mmsi',
			format: function(v){ return v.mmsi;}
		},
		shiptype:{
			headline: 'type',
			format: function(v){
				var t=0;
				try{
					t=parseInt(v.shiptype||0);
				}catch (e){}
				if (t>=20 && t<=29) return "WIG";
				if (t==30) return "Fishing";
				if (t==31 || t==32) return "Towing";
				if (t==33) return "Dredging";
				if (t==34) return "Diving";
				if (t==35) return "Military";
				if (t ==36)return "Sail";
				if (t==37) return "Pleasure";
				if (t>=40 && t<=49) return "HighSp";
				if (t==50) return "Pilot";
				if (t==51) return "SAR";
				if (t==52) return "Tug";
				if (t==53) return "PortT";
				if (t==54) return "AntiPol";
				if (t==55) return "Law";
				if (t==58) return "Medical";
				if (t>=60 && t<=69) return "Passenger";
				if (t>=70 && t<=79) return "Cargo";
				if (t>=80 && t<=89) return "Tanker";
				if (t>=91 && t<=94) return "Hazard";
				return "Other";
			}
		},
		position:{
			headline: 'position',
			format: function(v){return formatLonLats({lon:v.lon,lat:v.lat});}
		},
    destination: {
      headline: 'destination',
      format: function(v){ var d=v.destination; if (d) return d; return "unknown";}
    }
		
};


$.cookie.json = true;

function log(txt){
    try{
        console.log(txt);
    }catch(e){}
}

goog.provide('avnav.main');

/**
 * main function called when dom is loaded
 *
 */
avnav.main=function() {
    var propertyHandler=new avnav.util.PropertyHandler(properties);
    propertyHandler.loadUserData();
    var navobject=new avnav.nav.NavObject(propertyHandler);
    var mapholder=new avnav.map.MapHolder(propertyHandler,navobject);
    var gui=new avnav.gui.Handler(propertyHandler,navobject,mapholder);
    gui.showPage("mainpage");
    log("avnav loaded");
};
goog.exportSymbol('avnav.main',avnav.main);
