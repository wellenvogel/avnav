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

var NavData=require('./nav/navdata');
var React=require('react');
var ReactDOM=require('react-dom');
var OverlayDialog=require('./components/OverlayDialog.jsx');
ol.DEFAULT_TILE_CACHE_HIGH_WATER_MARK=256;



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
            compass: new avnav.util.Property(true,"Compass",avnav.util.PropertyType.CHECKBOX),
            measures: new avnav.util.Property(true,"Measures",avnav.util.PropertyType.CHECKBOX)
        },
        connectedMode:new avnav.util.Property(true,"connected",avnav.util.PropertyType.CHECKBOX),
        readOnlyServer: new avnav.util.Property(false),
        onAndroid:new avnav.util.Property(false),
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
        maxButtons: new avnav.util.Property(8),
        positionQueryTimeout: new avnav.util.Property( 1000,"Position (ms)",avnav.util.PropertyType.RANGE,[500,5000,10]), //1000ms
        trackQueryTimeout: new avnav.util.Property( 5000,"Track (ms)",avnav.util.PropertyType.RANGE,[500,10000,10]), //5s in ms
        routeQueryTimeout: new avnav.util.Property( 1000,"Route (ms)",avnav.util.PropertyType.RANGE,[500,10000,10]), //5s in ms
        courseAverageInterval: new avnav.util.Property( 0,"Course average",avnav.util.PropertyType.RANGE,[0,20,1]), //unit: query interval
        speedAverageInterval: new avnav.util.Property( 0,"Speed average",avnav.util.PropertyType.RANGE,[0,20,1]), //unit: query interval
        positionAverageInterval: new avnav.util.Property( 0,"Position average",avnav.util.PropertyType.RANGE,[0,20,1]), //unit: query interval
        bearingColor: new avnav.util.Property( "#DDA01F","Color",avnav.util.PropertyType.COLOR),
        bearingWidth: new avnav.util.Property( 3,"Width",avnav.util.PropertyType.RANGE,[1,10]),
        routeColor: new avnav.util.Property( "#27413B","Color",avnav.util.PropertyType.COLOR),
        routeWidth: new avnav.util.Property( 2,"Width",avnav.util.PropertyType.RANGE,[1,10]),
        routeWpSize:new avnav.util.Property( 7,"WPSize",avnav.util.PropertyType.RANGE,[5,30]),
        routeApproach: new avnav.util.Property( 200,"Approach(m)",avnav.util.PropertyType.RANGE,[20,2000]),
        routeShowLL: new avnav.util.Property(false,"showLatLon",avnav.util.PropertyType.CHECKBOX), //show latlon or leg course/len
        navCircleColor: new avnav.util.Property( "#D71038","Circle Color",avnav.util.PropertyType.COLOR),
        navCircleWidth: new avnav.util.Property( 1,"Circle Width",avnav.util.PropertyType.RANGE,[1,10]),
        anchorCircleColor: new avnav.util.Property( "#D71038","Anchor Circle Color",avnav.util.PropertyType.COLOR),
        anchorCircleWidth: new avnav.util.Property( 1,"Anchor Circle Width",avnav.util.PropertyType.RANGE,[1,10]),
        navCircle1Radius: new avnav.util.Property( 300,"Circle 1 Radius(m)",avnav.util.PropertyType.RANGE,[0,5000,10]),
        navCircle2Radius: new avnav.util.Property( 1000,"Circle 2 Radius(m)",avnav.util.PropertyType.RANGE,[0,5000,10]),
        navCircle3Radius: new avnav.util.Property( 0,"Circle 3 Radius(m)",avnav.util.PropertyType.RANGE,[0,10000,10]),
        anchorWatchDefault: new avnav.util.Property( 300,"AnchorWatch(m)",avnav.util.PropertyType.RANGE,[0,1000,1]),
        gpsXteMax:new avnav.util.Property( 1,"XTE(nm)",avnav.util.PropertyType.RANGE,[0.1,5,0.1,1]),
        trackColor: new avnav.util.Property( "#942eba","Color",avnav.util.PropertyType.COLOR),
        trackWidth: new avnav.util.Property( 3,"Width",avnav.util.PropertyType.RANGE,[1,10]),
        trackInterval: new avnav.util.Property( 30,"Point Dist.(s)",avnav.util.PropertyType.RANGE,[5,300]), //seconds
        initialTrackLength: new avnav.util.Property( 24,"Length(h)",avnav.util.PropertyType.RANGE,[1,48]), //in h
        aisQueryTimeout: new avnav.util.Property( 5000,"AIS (ms)",avnav.util.PropertyType.RANGE,[1000,10000,10]), //ms
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
        aisBrowserWorkaround: new avnav.util.Property(600,"Browser AisPage Workaround(ms)",avnav.util.PropertyType.RANGE,[0,6000,10]),
        statusQueryTimeout: new avnav.util.Property( 3000), //ms
        wpaQueryTimeout: new avnav.util.Property( 4000), //ms
        centerDisplayTimeout: new avnav.util.Property( 45000), //ms - auto hide measure display (0 - no auto hide)
        navUrl: new avnav.util.Property( "/viewer/avnav_navi.php"),
        maxGpsErrors: new avnav.util.Property( 3), //after that much invalid responses/timeouts the GPS is dead
        settingsName: new avnav.util.Property( "avnav.settings"), //storage name
        routingDataName: new avnav.util.Property( "avnav.routing"),
        routeName: new avnav.util.Property( "avnav.route"), //prefix for route names
        routingServerError: new avnav.util.Property(true,"ServerError",avnav.util.PropertyType.CHECKBOX), //notify comm errors to server
        routingTextSize:new avnav.util.Property( 14,"Text Size(px)",avnav.util.PropertyType.RANGE,[8,36]), //in px
        centerName: new avnav.util.Property( "avnav.center"),
        statusErrorImage: new avnav.util.Property( "images/RedBubble40.png"),
        statusOkImage: new avnav.util.Property( "images/GreenBubble40.png"),
        statusYellowImage: new avnav.util.Property( "images/YellowBubble40.png"),
        statusUnknownImage: new avnav.util.Property( "images/GreyBubble40.png"),
        statusIcons: {
            INACTIVE: new avnav.util.Property( "images/GreyBubble40.png"),
            STARTED: new avnav.util.Property(  "images/YellowBubble40.png"),
            RUNNING: new avnav.util.Property(  "images/YellowBubble40.png"),
            NMEA: new avnav.util.Property(    "images/GreenBubble40.png"),
            ERROR: new avnav.util.Property(   "images/RedBubble40.png")
        },
        nightFade:new avnav.util.Property( 50,"NightDim(%)",avnav.util.PropertyType.RANGE,[1,99]), //in px
        nightChartFade:new avnav.util.Property( 30,"NightChartDim(%)",avnav.util.PropertyType.RANGE,[1,99]), //in %
        baseFontSize:new avnav.util.Property( 14,"Base Font(px)",avnav.util.PropertyType.RANGE,[8,28]),
        widgetFontSize:new avnav.util.Property( 16,"Widget Base Font(px)",avnav.util.PropertyType.RANGE,[8,28]),
        allowTwoWidgetRows:new avnav.util.Property(true,"2 widget rows",avnav.util.PropertyType.CHECKBOX),
        showClock:new avnav.util.Property(true,"show clock",avnav.util.PropertyType.CHECKBOX),
        showZoom:new avnav.util.Property(true,"show zoom",avnav.util.PropertyType.CHECKBOX),
        autoZoom:new avnav.util.Property(true,"automatic zoom",avnav.util.PropertyType.CHECKBOX),
        nightMode: new avnav.util.Property( false,"NightMode",avnav.util.PropertyType.CHECKBOX),
        nightColorDim:new avnav.util.Property( 60,"Night Dim for Colors",avnav.util.PropertyType.RANGE,[5,100]), //should match @nightModeVale in less
        smallBreak:new avnav.util.Property( 480,"portrait layout below (px)",avnav.util.PropertyType.RANGE,[200,9999]), 

        style:{
            buttonSize:new avnav.util.Property( 60,"Button Size(px)",avnav.util.PropertyType.RANGE,[35,100]),
            aisWarningColor: new avnav.util.Property( "#FA584A","Warning",avnav.util.PropertyType.COLOR),
            aisNormalColor: new avnav.util.Property( "#EBEB55","Normal",avnav.util.PropertyType.COLOR),
            aisNearestColor: new avnav.util.Property( '#70F3AF',"Nearest",avnav.util.PropertyType.COLOR),
            aisTrackingColor:new avnav.util.Property( '#CAD5BE',"Tracking",avnav.util.PropertyType.COLOR),
            routeApproachingColor: new avnav.util.Property( '#FA584A',"Approach",avnav.util.PropertyType.COLOR),
            widgetMargin:new avnav.util.Property( 3,"Widget Margin(px)",avnav.util.PropertyType.RANGE,[1,20])
        }
    }
};




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
    //some workaround for lees being broken on IOS browser
    //less.modifyVars();
    $("body").show();

    if (getParam('log')) avnav.debugMode=true;
    var propertyHandler=new avnav.util.PropertyHandler(propertyDefinitions(),{});
    propertyHandler.loadUserData();
    var navurl=getParam('navurl');
    if (navurl){
        propertyHandler.setValueByName('navUrl',navurl);
        propertyHandler.setValueByName('routingServerError',false);
    }
    else {
        propertyHandler.setValueByName('routingServerError',true);
    }
    var navdata=new NavData(propertyHandler);
    var mapholder=new avnav.map.MapHolder(propertyHandler,navdata);
    var gui=new avnav.gui.Handler(propertyHandler,navdata,mapholder);

    if (getParam('onAndroid')){
        propertyHandler.setValueByName('onAndroid',true);
    }
    else {
        propertyHandler.setValueByName('onAndroid',false);
    }
    var ro="readOnlyServer";
    if (getParam(ro) && getParam(ro) == "true"){
        propertyHandler.setValueByName(ro,true);
        propertyHandler.setValueByName('connectedMode',false);
    }
    else{

        propertyHandler.setValueByName(ro,false);
    }
    if (avnav_version !== undefined){
        $('#avi_mainpage_version').text(avnav_version);
    }
    //make the android API available as avnav.android
    if (window.avnavAndroid){
        avnav.log("android integration enabled");
        propertyHandler.setValueByName('onAndroid',true);
        avnav.android=window.avnavAndroid;
        propertyHandler.setValueByName('routingServerError',false);
        propertyHandler.setValueByName('connectedMode',true);
        $('#avi_mainpage_version').text(avnav.android.getVersion());
        avnav.android.applicationStarted();
    }
    ReactDOM.render(React.createElement(OverlayDialog,{
            showCallback: function(id){gui.addActiveInput(id);},
            hideCallback: function(id){gui.removeActiveInput(id);}
        }),
        document.getElementById('avi_dialog_container'));
    gui.showPage("mainpage");
    //ios browser sometimes has issues with less...
    setTimeout(function(){
        propertyHandler.updateLayout();
        $(document).trigger(avnav.util.PropertyChangeEvent.EVENT_TYPE,new avnav.util.PropertyChangeEvent(propertyHandler));
    },1000);
    avnav.log("avnav loaded");
};

