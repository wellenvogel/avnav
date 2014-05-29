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
goog.require('avnav.gui.Aispage');


var properties={
        NM:1852, //one mile
        buttonUpdateTime: 500, //timer for button updates
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
		trackQueryTimeout: 5000, //5s in ms
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
        aisNormalImage: 'images/ais-default.png',
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


$.cookie.json = true;

function log(txt){
    try{
        //console.log(txt);
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
