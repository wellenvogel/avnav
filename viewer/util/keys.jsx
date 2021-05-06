/**
 * Created by andreas on 27.07.19.
 */

import assign from 'object-assign';
import greyBubble from '../images/GreyBubble40.png';
import redBubble from '../images/RedBubble40.png';
import greenBubble from '../images/GreenBubble40.png';
import yellowBubble from '../images/YellowBubble40.png';
import aisDefaultImage from '../images/ais-default.png';
import aisNearestImage from '../images/ais-nearest.png';
import aisWarningImage from '../images/ais-warning.png';

const K=999; //the real value does not matter
const V=888; //keys that can be used as value display

let valueKeys=[]; // a list of keys that can be used to display values in widgets


export const PropertyType={
    CHECKBOX:0,
    RANGE:1,
    LIST:2,
    COLOR:3,
    LAYOUT:4
};

/**
 * data holder for property description
 * @param defaultv
 * @param opt_label
 * @param opt_type
 * @param opt_values either min,max,[step],[decimal] for range or a list of value:label for list
 * @constructor
 */
export const Property=function(defaultv,opt_label,opt_type,opt_values){
    this.defaultv=defaultv;
    this.label=opt_label;
    this.type=(opt_type !== undefined)?opt_type:PropertyType.RANGE;
    this.values=(opt_values !== undefined)?opt_values:[0,1000]; //assume range 0...1000
    this.canChange=opt_type !== undefined;
};

/**
 * key with description
 * @param description
 * @constructor
 */
const D=function(description){
    this.description=description;
};

/**
 * key with description for values that can be used in widgets
 * @param description
 * @constructor
 */
const VD=function(description){
    this.description=description;
};

let keyDescriptions={}; //will be filled on first module loading

export class KeyNode{
    constructor(original,path){
        assign(this,original);
        this.__path=path;
    }
}

//the global definition of all used store keys
//every leaf entry having the value "K" will be replaced with its path as a string
let keys={
    nav:{
        gps:{
            lat:V,
            lon:V,
            position: new D("an instance of navobjects.Point"),
            course: V,
            speed: V,
            rtime: V,
            valid: K,
            windAngle: V,
	// anfang plugin
  			AWD:V,
  			TWD:V,
  			TWS:V,
  			TWA:V,
  			HDG_m:V,
  			HDG_t:V,
  			STW:V,
  			TSS:V,
			LLBB:V,
			LLSB:V,
	// ende plugin
            windTWA: V,
            windTWS: V,
            windSpeed: V,
            windReference: V,
            positionAverageOn:K,
            speedAverageOn: K,
            courseAverageOn: K,
            windAngleAverageOn: K,
            windSpeedAverageOn: K,
            depthBelowTransducer: V,
            sequence: K, //will be incremented as last operation on each receive
            connectionLost: K,
            updatealarm: new D("update counter for alarms"),
            updateleg: new D("update counter for leg")
        },
        alarms:{
            all:K,
        },
        center:{
            course: V,
            distance: V,
            markerCourse: V,
            markerDistance: V
        },
        wp:{
            course: V,
            distance: V,
            eta: V,
            xte: V,
            vmg: V,
            position: V,
            name: V
        },
        anchor:{
            distance: V,
            direction:V,
            watchDistance: V
        },
        route:{
            name: V,
            numPoints: V,
            len:V,
            remain: V,
            eta: V,
            nextCourse: V,
            isApproaching: V
        },

        ais:{
            nearest: K, //to be displayed
            list:K,
            trackedMmsi: K,
            updateCount:K
        },
        routeHandler:{
            activeName: K,
            routeForPage: K,
            pageRouteIndex: K,
            editingRoute:K,
            editingIndex: K,
            currentLeg: new D("the current leg used for routing"),
            currentIndex: new D("the index when working directly on the active route (currentLeg)")
        },
        track:{
            currentTrack:K
        }
    },
    map:{
        lockPosition: K,
        courseUp: K,
        currentZoom:K,
        requiredZoom:K,
        centerPosition:K,
        lastClickTime: K
        },
    gui:{
        capabilities:{
            addons:K,
            uploadCharts:K,
            plugins:K,
            uploadRoute:K,
            uploadLayout:K,
            uploadUser:K,
            uploadImages:K,
            uploadImport: K,
            uploadOverlays: K,
            uploadTracks: K,
            canConnect: K,
            config: K,
            debugLevel: K
        },
        global:{
            smallDisplay: K,
            pageName: K,
            pageOptions:K,
            onAndroid:K,
            propertySequence:K,
            hasActiveInputs: K,
            currentDialog: K, //holds the data for the currently visible dialog - if any
            windowDimensions: K,
            layoutEditing:K,
            layoutSequence: K, //updated on layout load
            reloadSequence: K, //will be changed if new data from server
            toastText:K,
            toastTimeout:K,
            toastCallback:K,
            soundEnabled: new D("only enable sound once we reach the mainpage"),
            dimActive: K,
            computedButtonHeight: K,
            computedButtonWidth: K,
            isFullScreen: K,

        },
        gpspage:{
            pageNumber:K,
        },
        aispage:{
            sortField:K,
        },
        addonpage:{
            activeAddOn:K,
        },
        addresspage:{
            addressList:K
        },
        wpapage:{
            interface:K,
            wpaItems:K,
            showAccess:K
        },
        routepage:{
            initialName:K,
        },
        downloadpage:{
            type:K,
            currentItems:K,
            downloadParameters:K,
            fileInputKey:K,
            enableUpload:K,
            uploadInfo:K,
            requestedUploadId: new D("the last requested upload for android"),
            addOns:K,
            chartImportExtensions:K,
            chartImportSubDir:K
        },
        settingspage:{
            hasChanges:K,
            values:K,
            section:K,
            leftPanelVisible: K
        }

    },
    //all keys below this one are the former properties
    //they will be written to local storage on change
    //and the store will be filled with initial values on start
    properties: {
        layers: {
            instrument: new Property(true, "Instrument", PropertyType.CHECKBOX),
            ais: new Property(true, "AIS", PropertyType.CHECKBOX),
            track: new Property(true, "Track", PropertyType.CHECKBOX),
            nav: new Property(true, "Navigation", PropertyType.CHECKBOX),
            boat: new Property(true, "Boat", PropertyType.CHECKBOX),
            grid: new Property(true, "Grid", PropertyType.CHECKBOX),
            compass: new Property(true, "Compass", PropertyType.CHECKBOX),
            base: new Property(true, "Base", PropertyType.CHECKBOX)
        },
        localAlarmSound: new Property(true, "Alarm Sound", PropertyType.CHECKBOX),
        connectedMode: new Property(true, "connected", PropertyType.CHECKBOX),
        readOnlyServer: new Property(false),
        silenceSound: new Property("sounds/1-minute-of-silence.mp3"),
        slideTime: new Property(300), //time in ms for upzoom
        slideLevels: new Property(3), //start with that many lower zoom levels
        maxUpscale: new Property(2), //2 levels upscale (otherwise we need too much mem)
        maxZoom: new Property(21),  //only allow upscaling up to this zom level
        courseAverageFactor: new Property(0.5), //moving average for course up
        courseAverageTolerance: new Property(15, "Rotation Tolerance", PropertyType.RANGE, [1, 30]), //tolerance for slow rotation
        maxButtons: new Property(8),
        positionQueryTimeout: new Property(1000, "Position (ms)", PropertyType.RANGE, [500, 5000, 10]), //1000ms
        trackQueryTimeout: new Property(5000, "Track (ms)", PropertyType.RANGE, [500, 10000, 10]), //5s in ms
        routeQueryTimeout: new Property(1000, "Route (ms)", PropertyType.RANGE, [500, 10000, 10]), //5s in ms
        chartQueryTimeout: new Property(30000, "ChartOverview (ms)", PropertyType.RANGE, [500, 200000, 100]), //5s in ms
        courseAverageInterval: new Property(0, "Course average", PropertyType.RANGE, [0, 20, 1]), //unit: query interval
        speedAverageInterval: new Property(0, "Speed average", PropertyType.RANGE, [0, 20, 1]), //unit: query interval
        windSpeedAverageInterval: new Property(0, "WindSpeed average", PropertyType.RANGE, [0, 20, 1]), //unit: query interval
        windAngleAverageInterval: new Property(0, "WindAngle average", PropertyType.RANGE, [0, 20, 1]), //unit: query interval
        positionAverageInterval: new Property(0, "Position average", PropertyType.RANGE, [0, 20, 1]), //unit: query interval
        bearingColor: new Property("#DDA01F", "Color", PropertyType.COLOR),
        bearingWidth: new Property(3, "Width", PropertyType.RANGE, [1, 10]),
        routeColor: new Property("#27413B", "Color", PropertyType.COLOR),
        routeWidth: new Property(2, "Width", PropertyType.RANGE, [1, 10]),
        routeWpSize: new Property(7, "WPSize", PropertyType.RANGE, [5, 30]),
        routeApproach: new Property(200, "Approach(m)", PropertyType.RANGE, [20, 2000]),
        routeShowLL: new Property(false, "showLatLon", PropertyType.CHECKBOX), //show latlon or leg course/len
        navCircleColor: new Property("#D71038", "Circle Color", PropertyType.COLOR),
        navCircleWidth: new Property(1, "Circle Width", PropertyType.RANGE, [1, 10]),
        navBoatCourseTime: new Property(600,"Boat Course Vector Length(sec)", PropertyType.RANGE,[1,3600]),
        anchorCircleColor: new Property("#D71038", "Anchor Circle Color", PropertyType.COLOR),
        anchorCircleWidth: new Property(1, "Anchor Circle Width", PropertyType.RANGE, [1, 10]),
        navCircle1Radius: new Property(300, "Circle 1 Radius(m)", PropertyType.RANGE, [0, 5000, 10]),
        navCircle2Radius: new Property(1000, "Circle 2 Radius(m)", PropertyType.RANGE, [0, 5000, 10]),
        navCircle3Radius: new Property(0, "Circle 3 Radius(m)", PropertyType.RANGE, [0, 10000, 10]),
        boatIconScale: new Property(1,"Boat Icon Scale",PropertyType.RANGE, [0.5,5,0.1]),
        windScaleAngle: new Property(50, "red/green Angle Wind", PropertyType.RANGE, [5, 90, 1]),
        anchorWatchDefault: new Property(300, "AnchorWatch(m)", PropertyType.RANGE, [0, 1000, 1]),
        gpsXteMax: new Property(1, "XTE(nm)", PropertyType.RANGE, [0.1, 5, 0.1, 1]),
        trackColor: new Property("#942eba", "Color", PropertyType.COLOR),
        trackWidth: new Property(3, "Width", PropertyType.RANGE, [1, 10]),
        trackInterval: new Property(30, "Point Dist.(s)", PropertyType.RANGE, [5, 300]), //seconds
        initialTrackLength: new Property(24, "Length(h)", PropertyType.RANGE, [1, 48]), //in h
        aisQueryTimeout: new Property(5000, "AIS (ms)", PropertyType.RANGE, [1000, 10000, 10]), //ms
        aisDistance: new Property(20, "AIS-Range(nm)", PropertyType.RANGE, [1, 100]), //distance for AIS query in nm
        aisUseCourseVector: new Property(true, "AIS Use Course Vector", PropertyType.CHECKBOX),
        aisIconBorderWidth: new Property(3, "Border Width", PropertyType.RANGE, [0, 10]),
        aisIconScale: new Property(1,"Icon Scale",PropertyType.RANGE, [0.5,5,0.1]),
        clickTolerance: new Property(60, "Click Tolerance", PropertyType.RANGE, [10, 120]),
        maxAisErrors: new Property(3), //after that many errors AIS display will be switched off
        minAISspeed: new Property(0.1), //minimal speed in m/s that we consider when computing cpa/tcpa
        maxAisTPA: new Property(3),    //max. computed AIS TPA time in h (otherwise we do not consider this)
        aisWarningCpa: new Property(500, "AIS Warning-CPA(m)", PropertyType.RANGE, [100, 5000, 10]), //m for AIS warning (500m)
        aisWarningTpa: new Property(900, "AIS-Warning-TPA(s)", PropertyType.RANGE, [30, 3600, 10]), //in s - max time for tpa warning (15min)
        aisTextSize: new Property(14, "Text Size(px)", PropertyType.RANGE, [8, 24]), //in px
        //images are not used any more, just keeping for fallback
        aisNormalImage: new Property(aisDefaultImage),
        aisNearestImage: new Property(aisNearestImage),
        aisWarningImage: new Property(aisWarningImage),
        statusQueryTimeout: new Property(3000), //ms
        networkTimeout: new Property(3000,"Network timeout(ms)",PropertyType.RANGE,[1000,10000,100]),
        wpaQueryTimeout: new Property(4000), //ms
        centerDisplayTimeout: new Property(45000), //ms - auto hide measure display (0 - no auto hide)
        navUrl: new Property("/viewer/avnav_navi.php"),
        maxGpsErrors: new Property(3), //after that much invalid responses/timeouts the GPS is dead
        settingsName: new Property("avnav.settings"), //storage name
        routingDataName: new Property("avnav.routing"),
        chartDataName: new Property("avnav.lastChart"),
        routeName: new Property("avnav.route"), //prefix for route names
        layoutStoreName: new Property("avnav.layout"),
        eulaStoreName: new Property("avnav.eulas"),
        chartInfoStoreName: new Property("avnav.chartinfo"),
        routingServerError: new Property(true, "ServerError", PropertyType.CHECKBOX), //notify comm errors to server
        routingTextSize: new Property(14, "Text Size(px)", PropertyType.RANGE, [8, 36]), //in px
        routeCatchRange: new Property(50,"route point snap distance %", PropertyType.RANGE,[0,100]),
        centerName: new Property("avnav.center"),
        licenseAcceptedName: new Property("avnav.licenseAccepted"),
        statusErrorImage: new Property(redBubble),
        statusOkImage: new Property(greenBubble),
        statusYellowImage: new Property(yellowBubble),
        statusUnknownImage: new Property(greyBubble),
        statusIcons: {
            INACTIVE: new Property(greyBubble),
            STARTED: new Property(yellowBubble),
            RUNNING: new Property(yellowBubble),
            NMEA: new Property(greenBubble),
            ERROR: new Property(redBubble)
        },
        nightFade: new Property(50, "NightDim(%)", PropertyType.RANGE, [1, 99]), //in px
        nightChartFade: new Property(30, "NightChartDim(%)", PropertyType.RANGE, [1, 99]), //in %
        dimFade: new Property(0,"Dim Fade(%)",PropertyType.RANGE,[0,60]),
        showDimButton: new Property(true,"Show Dim Button",PropertyType.CHECKBOX),
        baseFontSize: new Property(12, "Base Font(px)", PropertyType.RANGE, [8, 28]),
        widgetFontSize: new Property(14, "Widget Base Font(px)", PropertyType.RANGE, [8, 28]),
        allowTwoWidgetRows: new Property(true, "2 widget rows", PropertyType.CHECKBOX),
        showClock: new Property(true, "show clock", PropertyType.CHECKBOX),
        showZoom: new Property(true, "show zoom", PropertyType.CHECKBOX),
        showWind: new Property(true, "show wind", PropertyType.CHECKBOX),
        showDepth: new Property(true, "show depth", PropertyType.CHECKBOX),
        autoZoom: new Property(true, "automatic zoom", PropertyType.CHECKBOX),
        windKnots: new Property(true, "wind knots", PropertyType.CHECKBOX),
        nightMode: new Property(false, "NightMode", PropertyType.CHECKBOX),
        nightColorDim: new Property(60, "Night Dim for Colors", PropertyType.RANGE, [5, 100]), //should match @nightModeVale in less
        smallBreak: new Property(480, "portrait layout below (px)", PropertyType.RANGE, [200, 9999]),
        mapClickWorkaroundTime: new Property(300, "time to ignore events map click", PropertyType.RANGE, [0, 1000]),
        wpButtonTimeout: new Property(30,"time(s) for auto hiding wp buttons",PropertyType.RANGE,[2,3600]),
        toastTimeout: new Property(15,"time(s) to display messages",PropertyType.RANGE,[2,3600]),
        layoutName: new Property("system.default","Layout name",PropertyType.LAYOUT),
        mobMinZoom: new Property(16,"minzoom for MOB",PropertyType.RANGE,[8,20]),
        buttonCols: new Property(false,"2 button columns",PropertyType.CHECKBOX),
        cancelTop: new Property(false,"Back button top",PropertyType.CHECKBOX),
        featureInfo: new Property(true,"Overlay Info on Click",PropertyType.CHECKBOX),
        emptyFeatureInfo: new Property(true,"Always Info on Chart Click",PropertyType.CHECKBOX),
        showFullScreen: new Property(true,"Show Fullscreen Button",PropertyType.CHECKBOX),
        mapUpZoom: new Property(4,"zoom up lower layers",PropertyType.RANGE,[0,6]),
        mapOnlineUpZoom: new Property(0,"zoom up lower layers for online sources",PropertyType.RANGE,[0,6]),
        mapScale: new Property(1,"scale the map display",PropertyType.RANGE,[0.3,5]),

        sailsteermarke: new Property(0,"Zeigt Anlieger von der Markierung bzw. dem Wegpunkt an und gibt den Zielkurs zum Erreichen der Markierung bzw. des Wegpunktes an",PropertyType.CHECKBOX),
        sailsteerrefresh: new Property(5,"Layline Abweichunszeitraum [min] ",PropertyType.RANGE,[0,60]),
        sailsteertide: new Property(0,"Berechnet den Gezeiteneffekt für das Boot basierend auf den COG-Daten und überträgt das Ergebnis auf die Anlieger",PropertyType.CHECKBOX),
		sailsteeroverlap: new Property(0,"Erweitert die Anlieger über den Wende/Halse-Schnittpunkt hinaus",PropertyType.CHECKBOX),
        sailsteerlength: new Property(100,"Legt die Länge der Anlieger fest [nm]",PropertyType.RANGE,[0,1000]),
        sailsteerlimits: new Property(2,"Legt die minimale und maximale Dauer der Wende/Halse fest [min]",PropertyType.RANGE,[0,30]),
		sailsteertransparency: new Property(20,"Transparenz des Sailsteerdisplays [%]",PropertyType.RANGE,[0,100]),
		sailsteerPT1_frequenz: new Property(20,"Grenzfrequenz des TWD PT1 Filters [Hz]",PropertyType.RANGE,[0,100]),
		
        style: {
            buttonSize: new Property(50, "Button Size(px)", PropertyType.RANGE, [35, 100]),
            aisWarningColor: new Property("#FA584A", "Warning", PropertyType.COLOR),
            aisNormalColor: new Property("#EBEB55", "Normal", PropertyType.COLOR),
            aisNearestColor: new Property('#70F3AF', "Nearest", PropertyType.COLOR),
            aisTrackingColor: new Property('#CAD5BE', "Tracking", PropertyType.COLOR),
            routeApproachingColor: new Property('#FA584A', "Approach", PropertyType.COLOR),
            widgetMargin: new Property(3, "Widget Margin(px)", PropertyType.RANGE, [1, 20]),
            useHdpi: new Property(false,"Increase Fonts on High Res",PropertyType.CHECKBOX)
        }

    }
};

//replace all leaf values with their path as string
function update_keys(base,name){
    for (let k in base){
        let cname=name?(name+"."+k):k;
        if (base[k] === K){
            base[k]=cname;
            continue;
        }
        if (base[k] === V){
            valueKeys.push(cname);
            base[k]=cname;
            continue;
        }
        let current=base[k];
        if (typeof (current) === 'object'){
            if (current instanceof D || current instanceof Property || current instanceof VD){
                keyDescriptions[cname]=current;
                if (current instanceof VD){
                    valueKeys.push(cname);
                }
                base[k]=cname;
                continue;
            }
            update_keys(base[k],cname);
            base[k]=new KeyNode(base[k],cname);
        }
    }
}

update_keys(keys);


export const KeyHelper = {
    keyNodeToString:(keyNode)=> {
        if (!keyNode) return;
        if (typeof(keyNode.__path) === undefined) return;
        return keyNode.__path;
    },
    /**
    * get the default values in a form suitable
    * for calling storeMultiple at the store API
    */
    getDefaultKeyValues:()=> {
        let values = {};
        for (let k in keyDescriptions) {
            let description = keyDescriptions[k];
            if (description.defaultv !== undefined) {
                values[k] = description.defaultv;
            }
        }
        return values;
    },
    getKeyDescriptions:(opt_propertiesOnly)=> {
        if (!opt_propertiesOnly) return keyDescriptions;
        let rt = {};
        for (let k in keyDescriptions) {
            if (keyDescriptions[k] instanceof Property) {
                rt[k] = keyDescriptions[k];
            }
        }
        return rt;
    },
    /**
     * return all the keys as an arry of strings
     * the input can be any type that can be used in store functions
     * @param keyObject: string, array of strings, key objects (keys being the values, can be nested)
     */
    flattenedKeys:(keyObject)=>{
        if (keyObject instanceof Array) return keyObject;
        if (keyObject instanceof Object){
            let rt=[];
            for (let k in keyObject){
                let kv=keyObject[k];
                if (kv instanceof Object){
                    rt=rt.concat(KeyHelper.flattenedKeys(kv))
                }
                else{
                    rt.push(kv);
                }
            }
            return rt;
        }
        return [keyObject]

    },

    /**
     * get a list of keys that can be used for the display in si9mple widgets
     * @return {Array}
     */
    getValueKeys:()=>{
        return valueKeys;
    }
};

export default  keys;

