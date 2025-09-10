/**
 * Created by andreas on 27.07.19.
 */

import assign from 'object-assign';
import greyBubble from '../images/GreyBubble40.png';
import redBubble from '../images/RedBubble40.png';
import greenBubble from '../images/GreenBubble40.png';
import yellowBubble from '../images/YellowBubble40.png';
import AisFormatter from "../nav/aisformatter";
import {EditableParameterTypes} from "./EditableParameter";

const K=999; //the real value does not matter
const V=888; //keys that can be used as value display

let valueKeys=[]; // a list of keys that can be used to display values in widgets

export const PropertyType={
    CHECKBOX:EditableParameterTypes.BOOLEAN,
    RANGE:EditableParameterTypes.FLOAT,
    LIST:EditableParameterTypes.SELECT,
    COLOR:EditableParameterTypes.COLOR,
    LAYOUT:EditableParameterTypes.PROP_BASE+1,
    SELECT: EditableParameterTypes.SELECT,
    INTERNAL: EditableParameterTypes.PROP_BASE,
    MULTICHECKBOX: EditableParameterTypes.PROP_BASE+2, //unused?
    STRING: EditableParameterTypes.STRING,
    DELETED: EditableParameterTypes.PROP_BASE+10
};

/**
 * data holder for property description
 * @param defaultv
 * @param opt_label
 * @param opt_type
 * @param opt_values either min,max,[step],[decimal] for range or a list of value:label for list
 * @param opt_initial value to be set on first start
 * @constructor
 */
export class Property{
    constructor(defaultv,opt_label,opt_type,opt_values,opt_initial){
        this.defaultv=defaultv;
        this.label=opt_label;
        this.type=(opt_type !== undefined)?opt_type:PropertyType.INTERNAL;
        this.values=(opt_values !== undefined)?opt_values:[0,1000];//assume range 0...1000
        if (this.values instanceof Object){
            const v=[];
            for (let k in this.values){
                v.push(this.values[k])
            }
            this.values=v;
        }
        this.canChange=opt_type !== undefined;
        this.initialValue=opt_initial;
    }
    isSplit(){
        return false;
    }
}

export class SplitProperty extends Property{
    constructor(defaultv,opt_label,opt_type,opt_values,opt_initial) {
        super(defaultv,opt_label,opt_type,opt_values,opt_initial);
    }

    isSplit() {
        return true;
    }
}

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
    getKeys(){
        let rt={};
        for (let k in this){
            if (k.substr(0,1) === '_') continue;
            let v=this[k];
            if (typeof(v) !== 'string') continue;
            rt[k]=v;
        }
        return rt;
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
            windSpeed: V,
            trueWindAngle: V,
            trueWindSpeed: V,
            trueWindDirection: V,
            positionAverageOn:K,
            speedAverageOn: K,
            courseAverageOn: K,
            depthBelowTransducer: V,
            depthBelowWaterline: V,
            depthBelowKeel: V,
            headingCompass: V,
            headingMag: V,
            headingTrue: V,
            waterTemp: V,
            waterSpeed: V,
            magDeviation: V,
            magVariation: V,
            currentSet: V,
            currentDrift: V,
            sequence: K, //will be incremented as last operation on each receive
            connectionLost: K,
            updatealarm: new D("update counter for alarms"),
            updateleg: new D("update counter for leg"),
            updateconfig: new D("update counter for the server config"),
            version: new D("the server version")
        },
        display:{
            boatDirection: new D("the direction of the boat to be used for display"),
            directionMode: new D("one of cog,hdm,hdt"),
            isSteady: new D("will be true if steady detected"),
            mapDirection: new D("the direction that will be used to rotate the map with course up")
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
            courseRhumbLine: V,
            courseGreatCircle: V,
            distance: V,
            distanceRhumbLine: V,
            distanceGreatCircle: V,
            eta: V,
            xte: V,
            vmg: V,
            position: V,
            name: V,
            server: V
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
            editingRoute:K,
            editingIndex: K,
            useRhumbLine: K,
            nextWpMode: new D("switch mode: early, 90, late"),
            nextWpTime: new D("switch time for mode early"),
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
        activeMeasure: K,
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
            uploadSettings: K,
            canConnect: K,
            config: K,
            debugLevel: K,
            log: K,
            remoteChannel: K,
            fetchHead: K
        },
        global:{
            splitMode: K,
            smallDisplay: K,
            onAndroid:K,
            propertySequence:K,
            propertiesLoaded: K,
            hasActiveInputs: K,
            preventSizeChange:K,
            windowDimensions: K,
            windowDimForce: new D("will always update - regardless of preventSizeChange"),
            layoutEditing:K,
            layoutSequence: K, //updated on layout load
            layoutReverts: K,
            reloadSequence: K, //will be changed if new data from server
            toastText:K,
            toastTimeout:K,
            toastCallback:K,
            soundEnabled: new D("only enable sound once we reach the mainpage"),
            dimActive: K,
            computedButtonHeight: K,
            computedButtonWidth: K,
            isFullScreen: K,
            remoteChannelState:K,
            preventAlarms: K,
            ignoreAndroidBack: K,
            remoteChannelActive: K
        },
        gpspage:{
            pageNumber:K,
        },
        addonpage:{
            activeAddOn:K,
        },
        addresspage:{
            addressList:K
        },
        aispage:{
            searchActive: K,
            searchValue: K,
            sortField: K
        }

    },
    //all keys below this one are the former properties
    //they will be written to local storage on change
    //and the store will be filled with initial values on start
    properties: {
        lastLoadedName: new Property('system.default'),
        layers: {
            ais: new Property(true, "AIS", PropertyType.CHECKBOX),
            track: new Property(true, "Track", PropertyType.CHECKBOX),
            nav: new Property(true, "Navigation", PropertyType.CHECKBOX),
            boat: new Property(true, "Boat", PropertyType.CHECKBOX),
            grid: new Property(true, "Grid", PropertyType.CHECKBOX),
            compass: new Property(true, "Compass", PropertyType.CHECKBOX),
            base: new Property(true, "Base", PropertyType.CHECKBOX),
            scale: new Property(true,"ScaleLine", PropertyType.CHECKBOX),
            user: new Property({},"User/Plugins",PropertyType.CHECKBOX)
        },
        startNavPage: new Property(false,"start with last map",PropertyType.CHECKBOX),
        startLastSplit: new Property(false,"start with last split mode",PropertyType.CHECKBOX),
        localAlarmSound: new Property(true, "Alarm Sound", PropertyType.CHECKBOX),
        alarmVolume: new Property(50,"Alarm Volume (0...100)",PropertyType.RANGE,[0,100]),
        connectedMode: new SplitProperty(true, "connected", PropertyType.CHECKBOX),
        readOnlyServer: new Property(false),
        silenceSound: new Property("sounds/1-minute-of-silence.mp3"),
        slideTime: new Property(300), //time in ms for upzoom
        slideLevels: new Property(3), //start with that many lower zoom levels
        maxUpscale: new Property(2), //2 levels upscale (otherwise we need too much mem)
        maxZoom: new Property(21),  //only allow upscaling up to this zom level
        courseAverageLength: new Property(10,"average interval for map course up",PropertyType.RANGE,[1,30]), //moving average for course up
        courseAverageTolerance: new Property(15, "Rotation Tolerance", PropertyType.RANGE, [1, 30]), //tolerance for slow rotation
        courseUpAlwaysCOG: new Property(false,"CourseUp always COG",PropertyType.CHECKBOX),
        maxButtons: new Property(8),
        autoUpdateUserCss: new Property(true,"AutoUpdate user.css",PropertyType.CHECKBOX),
        positionQueryTimeout: new Property(1000, "Position (ms)", PropertyType.RANGE, [500, 5000, 10]), //1000ms
        trackQueryTimeout: new Property(5000, "Track (ms)", PropertyType.RANGE, [500, 10000, 10]), //5s in ms
        routeQueryTimeout: new Property(1000, "Route (ms)", PropertyType.RANGE, [500, 10000, 10]), //5s in ms
        chartQueryTimeout: new Property(30000, "ChartOverview (ms)", PropertyType.RANGE, [500, 200000, 100]),
        connectionLostAlarm: new Property(true,"Connection Lost alarm",PropertyType.CHECKBOX),//5s in ms
        courseAverageInterval: new Property(0, "Course average", PropertyType.RANGE, [0, 20, 1]), //unit: query interval
        speedAverageInterval: new Property(0, "Speed average", PropertyType.RANGE, [0, 20, 1]), //unit: query interval
        positionAverageInterval: new Property(0, "Position average", PropertyType.RANGE, [0, 20, 1]), //unit: query interval
        bearingColor: new Property("#DDA01F", "Bearing Color", PropertyType.COLOR),
        bearingWidth: new Property(3, "Bearing Width", PropertyType.RANGE, [1, 10]),
        routeColor: new Property("#27413B", "Color", PropertyType.COLOR),
        routeWidth: new Property(2, "Width", PropertyType.RANGE, [1, 10]),
        routeWpSize: new Property(7, "WPSize", PropertyType.RANGE, [5, 30]),
        routeApproach: new Property(200, "Approach(m)", PropertyType.RANGE, [20, 2000]),
        routeShowLL: new Property(false, "showLatLon", PropertyType.CHECKBOX), //show latlon or leg course/len
        navCircleColor: new Property("#D71038", "Vector / Circle Color", PropertyType.COLOR),
        navCircleWidth: new Property(1, "Vector / Circle Width", PropertyType.RANGE, [1, 10]),
        navBoatCourseTime: new Property(600,"Boat Course Vector Length(sec)", PropertyType.RANGE,[1,3600]),
        anchorCircleColor: new Property("#D71038", "Anchor Circle Color", PropertyType.COLOR),
        anchorCircleWidth: new Property(1, "Anchor Circle Width", PropertyType.RANGE, [1, 10]),
        navCircle1Radius: new Property(300, "Circle 1 Radius(m)", PropertyType.RANGE, [0, 5000, 10]),
        navCircle2Radius: new Property(1000, "Circle 2 Radius(m)", PropertyType.RANGE, [0, 5000, 10]),
        navCircle3Radius: new Property(0, "Circle 3 Radius(m)", PropertyType.RANGE, [0, 10000, 10]),
        boatIconScale: new Property(1,"Boat Icon Scale",PropertyType.RANGE, [0.5,5,0.1]),
        boatDirectionMode: new Property('cog','boat direction',PropertyType.LIST,['cog','hdt','hdm']),
        boatDirectionVector: new Property(true,'add dashed vector for hdt/hdm',PropertyType.CHECKBOX),
        boatSteadyDetect: new Property(false,'zero SOG detect',PropertyType.CHECKBOX),
        boatSteadyMax: new Property(0.2,'zero SOG detect below (kn)',PropertyType.RANGE,[0.1,1.0,0.05]),
        measureColor: new Property('red','Measure display color',PropertyType.COLOR),
        anchorWatchDefault: new Property(300, "AnchorWatch(m)", PropertyType.RANGE, [0, 1000, 1]),
        markerDefaultName: new Property('Marker','default SP name',PropertyType.STRING),
        trackColor: new Property("#942eba", "Color", PropertyType.COLOR),
        trackWidth: new Property(3, "Width", PropertyType.RANGE, [1, 10]),
        trackInterval: new Property(30, "Point Dist.(s)", PropertyType.RANGE, [5, 300]), //seconds
        initialTrackLength: new Property(24, "Length(h)", PropertyType.RANGE, [1, 48]), //in h
        aisQueryTimeout: new Property(5000, "AIS (ms)", PropertyType.RANGE, [1000, 10000, 10]), //ms
        aisDistance: new Property(20, "Range(nm)", PropertyType.RANGE, [1, 1000]), //distance for AIS query in nm
        aisUseCourseVector: new Property(true, "use Course Vector", PropertyType.CHECKBOX),
        aisCurvedVectors: new Property(true, "curved vectors", PropertyType.CHECKBOX),
        aisRelativeMotionVectorRange: new Property(0, "relative motion vector range (nm)", PropertyType.RANGE, [0, 100]),
        aisShowEstimated: new Property(true,"show estimated position", PropertyType.CHECKBOX),
        aisCpaEstimated: new Property(true,"CPA/BRG from estimated",PropertyType.CHECKBOX),
        aisEstimatedOpacity: new Property(0.4,"estimated image opacity",PropertyType.RANGE,[0.1,1,0.05]),
        aisUseHeading: new Property(true,"use heading for direction",PropertyType.CHECKBOX),
        aisIconBorderWidth: new Property(3, "Border Width", PropertyType.RANGE, [0, 10]),
        aisIconScale: new Property(1,"Icon Scale",PropertyType.RANGE, [0.5,5,0.1]),
        aisClassbShrink: new Property(0.6,"Class B rel size",PropertyType.RANGE, [0.1,2,0.1]),
        aisMinDisplaySpeed: new Property(0.2,"boat/target below (kn) not moving",PropertyType.RANGE,[0.05,40]),
        aisOnlyShowMoving: new Property(false,"only show moving targets",PropertyType.CHECKBOX),
        aisListUpdateTime: new Property(5,"update time(s) for list",PropertyType.RANGE,[1,20]),
        aisReducedList: new Property(false,"reduce details in list",PropertyType.CHECKBOX),
        aisHideTime: new Property(15,"hide time(s)",PropertyType.RANGE,[1,3600]),
        aisLostTime: new Property(600,"lost time (s)",PropertyType.RANGE, [1,3600]),
        aisCenterMode: new Property('both',"center for AIS range",PropertyType.LIST,['both','boat','map']),
        aisListLock: new Property(false,"lock ais list",PropertyType.CHECKBOX),
        aisMarkAllWarning: new Property(true,"mark ALL warning targets", PropertyType.CHECKBOX),
        aisShowErrors: new Property(false,"show AIS computation errors",PropertyType.CHECKBOX),
        clickTolerance: new Property(60, "Click Tolerance", PropertyType.RANGE, [10, 120]),
        maxAisErrors: new Property(3), //after that many errors AIS display will be switched off
        maxAisTPA: new Property(3),    //max. computed AIS TPA time in h (otherwise we do not consider this)
        aisWarningCpa: new Property(500, "Warning-CPA(m)", PropertyType.RANGE, [100, 5000, 10]), //m for AIS warning (500m)
        aisWarningTpa: new Property(900, "Warning-TPA(s)", PropertyType.RANGE, [30, 3600, 10]), //in s - max time for tpa warning (15min)
        aisTextSize: new Property(14, "Text Size(px)", PropertyType.RANGE, [8, 24]), //in px
        aisShowA: new Property(true,"Show class A",PropertyType.CHECKBOX),
        aisShowB: new Property(true,"Show class B",PropertyType.CHECKBOX),
        aisShowOther: new Property(false,"Show other",PropertyType.CHECKBOX),
        aisFirstLabel: new Property('nameOrmmsi','First label',PropertyType.SELECT,['--none--'].concat(AisFormatter.getLabels())),
        aisSecondLabel: new Property('--none--','Second label',PropertyType.SELECT,['--none--'].concat(AisFormatter.getLabels())),
        aisThirdLabel: new Property('--none--','Third label',PropertyType.SELECT,['--none--'].concat(AisFormatter.getLabels())),
        statusQueryTimeout: new Property(8000), //ms
        networkTimeout: new Property(8000,"Network timeout(ms)",PropertyType.RANGE,[1000,20000,100]),
        wpaQueryTimeout: new Property(10000), //ms
        centerDisplayTimeout: new Property(45000), //ms - auto hide measure display (0 - no auto hide)
        navUrl: new Property("/viewer/avnav_navi.php"),
        maxGpsErrors: new Property(3), //after that much invalid responses/timeouts the GPS is dead
        routingServerError: new Property(true, "ServerError", PropertyType.CHECKBOX), //notify comm errors to server
        routingTextSize: new Property(14, "Text Size(px)", PropertyType.RANGE, [8, 36]), //in px
        fontBase: new Property("Arial","Font Base",PropertyType.SELECT,["Arial","Verdana","Tahoma","Times New Roman","Georgia","Garamond"]),
        fontShadowColor: new Property('#fff',"Font Shadow Color", PropertyType.COLOR),
        fontShadowWidth: new Property(3,"font shadow width(px)",PropertyType.RANGE,[0,10]),
        fontColor: new Property('#000',"font color",PropertyType.COLOR),
        routeCatchRange: new Property(50,"route point snap distance %", PropertyType.RANGE,[0,100]),
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
        showSplitButton: new Property(true,"Show Split Button", PropertyType.CHECKBOX),
        baseFontSize: new Property(14, "Base Font(px)", PropertyType.RANGE, [8, 28]),
        widgetFontSize: new Property(14, "Widget Base Font(px)", PropertyType.RANGE, [8, 28]),
        allowTwoWidgetRows: new Property(true, "2 widget rows", PropertyType.CHECKBOX),
        autoZoom: new Property(true, "automatic zoom", PropertyType.CHECKBOX),
        nightMode: new Property(false, "NightMode", PropertyType.CHECKBOX),
        nightColorDim: new Property(60, "Night Dim for Colors", PropertyType.RANGE, [5, 100]), //should match @nightModeVale in less
        smallBreak: new Property(480, "portrait layout below (px)", PropertyType.RANGE, [200, 9999]),
        mapClickWorkaroundTime: new Property(300, "time to ignore events map click", PropertyType.RANGE, [0, 1000]),
        wpButtonTimeout: new Property(30,"time(s) for auto hiding wp buttons",PropertyType.RANGE,[2,3600]),
        nightModeNavPage: new Property(true,"show night mode on navpage",PropertyType.CHECKBOX),
        hideButtonTime: new Property(30,"time(s) to hide buttons on enabled pages",PropertyType.RANGE,[2,90]),
        showButtonShade: new Property(true,"show shade when buttons hidden",PropertyType.CHECKBOX),
        autoHideNavPage: new Property(false,"auto hide buttons on NavPage",PropertyType.CHECKBOX),
        autoHideGpsPage: new Property(false,"auto hide buttons on Dashboard Pages",PropertyType.CHECKBOX),
        toastTimeout: new Property(15,"time(s) to display messages",PropertyType.RANGE,[2,3600]),
        layoutName: new SplitProperty("system.default","Layout name",PropertyType.LAYOUT),
        mobMinZoom: new Property(16,"minzoom for MOB",PropertyType.RANGE,[8,20]),
        buttonCols: new Property(false,"2 button columns",PropertyType.CHECKBOX),
        cancelTop: new Property(false,"Back button top",PropertyType.CHECKBOX,undefined,true),
        titleIcons: new Property(true,"red icons in title",PropertyType.CHECKBOX),
        titleIconsGps: new Property(true,"title icons on dashboard page",PropertyType.CHECKBOX),
        featureInfo: new Property(true,"Feature Info on Click",PropertyType.CHECKBOX),
        showFullScreen: new Property(true,"Show Fullscreen Button",PropertyType.CHECKBOX),
        measureRhumbLine: new Property(true,"Measure rhumb line (false: great circle)",PropertyType.CHECKBOX),
        mapUpZoom: new Property(4,"zoom up lower layers",PropertyType.RANGE,[0,6]),
        mapOnlineUpZoom: new Property(0,"zoom up lower layers for online sources",PropertyType.RANGE,[0,6]),
        mapScale: new Property(1,"scale the map display",PropertyType.RANGE,[0.3,5]),
        mapFloat: new Property(false,"float map behind buttons",PropertyType.CHECKBOX),
        mapLockMode: new Property('center','lock boat mode',PropertyType.LIST,['center','current','ask']),
        mapLockMove: new Property(true,'allow move when locked',PropertyType.CHECKBOX),
        mapSequenceTime: new Property(2000,"change check interval(ms)",PropertyType.RANGE,[500,10000,100]),
        mapScaleBarText: new Property(true,"Show text on scale bar",PropertyType.CHECKBOX),
        mapZoomLock: new Property(true,"Lock to int zoom levels with buttons", PropertyType.CHECKBOX),
        mapAlwaysCenter: new Property(true,"Show center cross when locked",PropertyType.CHECKBOX),
        mapSaveCenterTimeout: new Property(10,"Min save center interval(s)",PropertyType.RANGE,[5,100,5]),
        remoteChannelName: new SplitProperty('0','remote control channel',PropertyType.LIST,['0','1','2','3','4']),
        remoteChannelRead: new SplitProperty(false,'read from remote channel',PropertyType.CHECKBOX),
        remoteChannelWrite: new SplitProperty(false,'write to remote channel',PropertyType.CHECKBOX),
        remoteGuardTime: new Property(2,'time(s) to switch read/write',PropertyType.RANGE,[1,10]),
        remoteDimGuard: new Property(200,'time (ms) before a toggle is accepted from remote',PropertyType.RANGE,[100,1000]),

        style: {
            buttonSize: new Property(50, "Button Size(px)", PropertyType.RANGE, [35, 100]),
            aisWarningColor: new Property("#FA584A", "Warning", PropertyType.COLOR),
            aisNormalColor: new Property("#EBEB55", "Normal", PropertyType.COLOR),
            aisNearestColor: new Property('#70F3AF', "Nearest", PropertyType.COLOR),
            aisTrackingColor: new Property('#f8a601', "Tracking", PropertyType.COLOR),
            routeApproachingColor: new Property('#FA584A', "Approach", PropertyType.COLOR),
            widgetMargin: new Property(3, "Widget Margin(px)", PropertyType.RANGE, [1, 20]),
            useHdpi: new Property(true,"Increase Fonts on High Res",PropertyType.CHECKBOX,undefined,true)
        },
        /**
         * old properties are kept here to avoid warnings on import
         */
        windScaleAngle: new Property(50, "red/green Angle Wind", PropertyType.DELETED, [5, 90, 1]),
        aisUseRelMotionVector: new Property(false, "relative motion vectors", PropertyType.DELETED),
        aisUseTurnIndicator: new Property(false, "turn indicator", PropertyType.DELETED),
        showClock: new Property(true, "show clock", PropertyType.DELETED),
        showZoom: new Property(true, "show zoom", PropertyType.DELETED),
        showWind: new Property(true, "show wind", PropertyType.DELETED),
        showDepth: new Property(true, "show depth", PropertyType.DELETED),
        windKnots: new Property(true, "wind knots", PropertyType.DELETED),
        showMeasure: new Property(true,"Show Measure Button",PropertyType.DELETED),
        emptyFeatureInfo: new Property(true,"Always Info on Chart Click",PropertyType.DELETED),
        minAISspeed: new Property(0.1,"",PropertyType.DELETED), //minimal speed in m/s that we consider when computing cpa/tcpa
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
    getValue:(obj,path,opt_skip)=>{
        let parts=path.split('.');
        let current=obj;
        let rt=undefined;
        for (let i=opt_skip||0;i<parts.length;i++){
            if (typeof(current) !== 'object') return;
            rt=current[parts[i]];
            current=current[parts[i]];
        }
        return rt;
    },
    /**
     * get a list of keys that can be used for the display in si9mple widgets
     * @return {Array}
     */
    getValueKeys:()=>{
        return valueKeys;
    },
    removeNodeInfo:(keys)=>{
        if (! (keys instanceof Object)) return keys;
        if (keys.__path !== undefined) {
            let rt={...keys};
            delete rt.__path;
            return rt;
        }
        return keys;
    }
};

export default  keys;

