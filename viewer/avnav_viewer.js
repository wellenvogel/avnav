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
                  http://ionicons.com/ (MIT license)
*/

avnav.provide('avnav.main');





/**
 * currently we must require all pages somewhere
 */








var propertyDefinitions=function(){
    return {
        layers:{
            ais: new avnav.util.Property(true,"AIS",avnav.util.PropertyType.CHECKBOX),
            track: new avnav.util.Property(true,"Track",avnav.util.PropertyType.CHECKBOX),
            nav: new avnav.util.Property(true,"Navigation",avnav.util.PropertyType.CHECKBOX),
            boat: new avnav.util.Property(true,"Boat",avnav.util.PropertyType.CHECKBOX),
            grid: new avnav.util.Property(true,"Grid",avnav.util.PropertyType.CHECKBOX),
            compass: new avnav.util.Property(true,"Compass",avnav.util.PropertyType.CHECKBOX)
        },
        forceMobile: new avnav.util.Property(false,"forceMobile",avnav.util.PropertyType.CHECKBOX),
        connectedMode:new avnav.util.Property(true,"connected",avnav.util.PropertyType.CHECKBOX),
        NM: new avnav.util.Property(1852), //one mile
        buttonUpdateTime: new avnav.util.Property( 500), //timer for button updates
        slideTime: new avnav.util.Property( 300), //time in ms for upzoom
        slideLevels: new avnav.util.Property( 3), //start with that many lower zoom levels
        maxUpscale: new avnav.util.Property(2), //2 levels upscale (otherwise we need too much mem)
        hideLower: new avnav.util.Property( true), //if set, hide smaller zoom layers when completely covered
        maxZoom: new avnav.util.Property( 21),  //only allow upscaling up to this zom level
        courseAverageFactor: new avnav.util.Property(0.5), //moving average for course up
        courseAverageTolerance: new avnav.util.Property(15,"Rotation Tolerance",avnav.util.PropertyType.RANGE,[1,30]), //tolerance for slow rotation
        minGridLedvel: new avnav.util.Property( 10),
        loggingEnabled: new avnav.util.Property( true),
        positionQueryTimeout: new avnav.util.Property( 1000,"Position",avnav.util.PropertyType.RANGE,[500,5000,10]), //1000ms
        trackQueryTimeout: new avnav.util.Property( 5000,"Track",avnav.util.PropertyType.RANGE,[500,10000,10]), //5s in ms
        routeQueryTimeout: new avnav.util.Property( 1000,"Route",avnav.util.PropertyType.RANGE,[500,10000,10]), //5s in ms
        bearingColor: new avnav.util.Property( "#DDA01F","Color",avnav.util.PropertyType.COLOR),
        bearingWidth: new avnav.util.Property( 3,"Width",avnav.util.PropertyType.RANGE,[1,10]),
        routeColor: new avnav.util.Property( "#27413B","Color",avnav.util.PropertyType.COLOR),
        routeWidth: new avnav.util.Property( 2,"Width",avnav.util.PropertyType.RANGE,[1,10]),
        routeWpSize:new avnav.util.Property( 7,"WPSize",avnav.util.PropertyType.RANGE,[5,30]),
        routeApproach: new avnav.util.Property( 200,"Approach(m)",avnav.util.PropertyType.RANGE,[20,2000]),
        routeShowLL: new avnav.util.Property(false,"showLatLon",avnav.util.PropertyType.CHECKBOX), //show latlon or leg course/len
        navCircleColor: new avnav.util.Property( "#D71038","Circle Color",avnav.util.PropertyType.COLOR),
        navCircleWidth: new avnav.util.Property( 1,"Circle Width",avnav.util.PropertyType.RANGE,[1,10]),
        navCircle1Radius: new avnav.util.Property( 300,"Circle 1 Radius(m)",avnav.util.PropertyType.RANGE,[0,5000,10]),
        navCircle2Radius: new avnav.util.Property( 1000,"Circle 2 Radius(m)",avnav.util.PropertyType.RANGE,[0,5000,10]),
        navCircle3Radius: new avnav.util.Property( 0,"Circle 3 Radius(m)",avnav.util.PropertyType.RANGE,[0,10000,10]),
        gpsXteMax:new avnav.util.Property( 1,"XTE(nm)",avnav.util.PropertyType.RANGE,[0.1,5,0.1,1]),
        trackColor: new avnav.util.Property( "#942eba","Color",avnav.util.PropertyType.COLOR),
        trackWidth: new avnav.util.Property( 3,"Width",avnav.util.PropertyType.RANGE,[1,10]),
        trackInterval: new avnav.util.Property( 30,"Point Dist.(s)",avnav.util.PropertyType.RANGE,[5,300]), //seconds
        initialTrackLength: new avnav.util.Property( 24,"Length(h)",avnav.util.PropertyType.RANGE,[1,48]), //in h
        aisQueryTimeout: new avnav.util.Property( 5000,"AIS",avnav.util.PropertyType.RANGE,[1000,10000,10]), //ms
        aisDistance: new avnav.util.Property( 20,"AIS-Range(nm)",avnav.util.PropertyType.RANGE,[1,100]), //distance for AIS query in nm
        aisClickTolerance: new avnav.util.Property( 80,"Click Tolerance",avnav.util.PropertyType.RANGE,[10,100]),
        maxAisErrors: new avnav.util.Property( 3), //after that many errors AIS display will be switched off
        minAISspeed: new avnav.util.Property( 0.2), //minimal speed in kn that we consider when computing cpa/tcpa
        maxAisTPA: new avnav.util.Property( 3),    //max. computed AIS TPA time in h (otherwise we do not consider this)
        aisWarningCpa: new avnav.util.Property( 500,"AIS Warning-CPA(m)",avnav.util.PropertyType.RANGE,[100,5000,10]), //m for AIS warning (500m)
        aisWarningTpa: new avnav.util.Property( 900,"AIS-Warning-TPA(s)",avnav.util.PropertyType.RANGE,[30,3600,10]), //in s - max time for tpa warning (15min)
        aisTextSize:new avnav.util.Property( 14,"Text Size(px)",avnav.util.PropertyType.RANGE,[8,24]), //in px
        //images are not used any more, just keeping for fallback
        aisNormalImage: new avnav.util.Property( 'images/ais-default.png'),
        aisNearestImage: new avnav.util.Property( 'images/ais-nearest.png'),
        aisWarningImage: new avnav.util.Property( 'images/ais-warning.png'),
        statusQueryTimeout: new avnav.util.Property( 3000), //ms
        centerDisplayTimeout: new avnav.util.Property( 45000), //ms - auto hide measure display (0 - no auto hide)
        navUrl: new avnav.util.Property( "/viewer/avnav_navi.php"),
        maxGpsErrors: new avnav.util.Property( 3), //after that much invalid responses/timeouts the GPS is dead
        settingsName: new avnav.util.Property( "avnav.settings"), //storage name
        routingDataName: new avnav.util.Property( "avnav.routing"),
        routeName: new avnav.util.Property( "avnav.defaultRoute"),
        routingServerError: new avnav.util.Property(true,"ServerError",avnav.util.PropertyType.CHECKBOX), //notify comm errors to server
        routingTextSize:new avnav.util.Property( 14,"Text Size(px)",avnav.util.PropertyType.RANGE,[8,36]), //in px
        centerName: new avnav.util.Property( "avnav.center"),
        statusErrorImage: new avnav.util.Property( "images/RedBubble40.png"),
        statusOkImage: new avnav.util.Property( "images/GreenBubble40.png"),
        statusIcons: {
            INACTIVE: new avnav.util.Property( "images/GreyBubble40.png"),
            STARTED: new avnav.util.Property(  "images/YellowBubble40.png"),
            RUNNING: new avnav.util.Property(  "images/YellowBubble40.png"),
            NMEA: new avnav.util.Property(	  "images/GreenBubble40.png"),
            ERROR: new avnav.util.Property(	  "images/RedBubble40.png")
        },
        nightFade:new avnav.util.Property( 15,"NightDim(%)",avnav.util.PropertyType.RANGE,[1,99]), //in px
        nightChartFade:new avnav.util.Property( 30,"NightChartDim(%)",avnav.util.PropertyType.RANGE,[1,99]), //in %
        //all style members map to less variables
        style:{
            bottomPanelHeight: new avnav.util.Property( 50,"Bottom Height(px)",avnav.util.PropertyType.RANGE,[20,80]),
            nightMode: new avnav.util.Property( 100,"NightMode",avnav.util.PropertyType.RANGE,[0,100]),
            aisPanelWidth:new avnav.util.Property( 90,"AIS Width(px)",avnav.util.PropertyType.RANGE,[50,300]),
            routeInfoPanelWidth:new avnav.util.Property( 120,"RoutePanel Width(px)",avnav.util.PropertyType.RANGE,[50,300]),
            buttonSize:new avnav.util.Property( 60,"Button Size(px)",avnav.util.PropertyType.RANGE,[40,100]),
            centerDisplayHeight:new avnav.util.Property( 30,"+ Display Height(px)",avnav.util.PropertyType.RANGE,[20,80]),
            aisWarningColor: new avnav.util.Property( "#FA584A","Warning",avnav.util.PropertyType.COLOR),
            aisNormalColor: new avnav.util.Property( "#EBEB55","Normal",avnav.util.PropertyType.COLOR),
            aisNearestColor: new avnav.util.Property( '#70F3AF',"Nearest",avnav.util.PropertyType.COLOR),
            routeApproachingColor: new avnav.util.Property( '#FA584A',"Approach",avnav.util.PropertyType.COLOR)
        }
    }
};



function log(txt){
    try{
        //console.log(txt);
    }catch(e){}
}

function getParam(key)
{
    // Find the key and everything up to the ampersand delimiter
    var value=RegExp(""+key+"[^&]+").exec(window.location.search);

    // Return the unescaped value minus everything starting from the equals sign or an empty string
    return unescape(!!value ? value.toString().replace(/^[^=]+./,"") : "");
}

/**
 * main function called when dom is loaded
 *
 */
avnav.main=function() {
    var propertyHandler=new avnav.util.PropertyHandler(propertyDefinitions(),{});
    propertyHandler.loadUserData();
    var navobject=new avnav.nav.NavObject(propertyHandler);
    var mapholder=new avnav.map.MapHolder(propertyHandler,navobject);
    var gui=new avnav.gui.Handler(propertyHandler,navobject,mapholder);
    if (avnav_version !== undefined){
        $('#avi_mainpage_version').text(avnav_version);
    }
    var navurl=getParam('navurl');
    if (navurl){
        propertyHandler.setValueByName('navUrl',navurl);
        propertyHandler.setValueByName('routingServerError',false);
    }
    gui.showPage("mainpage");
    log("avnav loaded");
};

