/**
 * Created by andreas on 20.11.16.
 */
let Widget=require('./Widget.jsx');
let EtaWidget=require('./EtaWidget.jsx');
let TimeStatusWidget=require('./TimeStatusWidget.jsx');
let AisTargetWidget=require('./AisTargetWidget.jsx');
let ActiveRouteWidget=require('./ActiveRouteWidget.jsx');
let EditRouteWidget=require('./EditRouteWidget.jsx');
let CenterDisplayWidget=require('./CenterDisplayWidget.jsx');
let WindWidget=require('./WindWidget');
let XteWidget=require('./XteWidget');
let EmptyWidget=require('./EmptyWidget');
let WindGraphics=require('./WindGraphics');
let DirectWidget=require('./DirectWidget.jsx');
let keys=require('../util/keys.jsx');
let Formatter=require('../util/formatter');
let fi=new Formatter();
let widgetList=[
    {
        name: 'SOG',
        default: "0.0",
        unit: "kn",
        caption: 'SOG',
        classes: 'avn_speedWidget',
        storeKeys: {
            value: keys.nav.gps.speed,
            isAverage: keys.nav.gps.speedAverageOn
        },
        formatter:'formatDecimal',
        formatterParameters: [2, 1]
    },
    {
        name: 'COG',
        default: "---",
        unit: "\u00b0",
        caption: 'COG',
        classes: 'avn_courseWidget',
        storeKeys:{
            value: keys.nav.gps.course,
            isAverage:keys.nav.gps.courseAverageOn
        },
        formatter: 'formatDecimal',
        formatterParameters: [3, 0]

    },
    {
        name: 'Position',
        default: "-------------",
        caption: 'BOAT',
        classes: 'avn_posWidget',
        storeKeys:{
            value: keys.nav.gps.position,
            isAverage: keys.nav.gps.positionAverageOn
        },
        formatter: 'formatLonLats'

    },
    {
        name: 'TimeStatus',
        caption: 'GPS',
        wclass: TimeStatusWidget,
        storeKeys: TimeStatusWidget.storeKeys
    },
    {
        name: 'ETA',
        caption: 'ETA',
        wclass: EtaWidget,
        classes: 'avn_etaWidget'
    },
    {
        name: 'DST',
        default: "----",
        unit: "nm",
        caption: 'DST',
        classes: 'avn_distanceWidget',
        dataKey: 'markerDistance'
    },
    {
        name: 'BRG',
        default: "---",
        unit: "\u00b0",
        caption: 'BRG',
        classes: 'avn_courseWidget',
        dataKey: 'markerCourse'
    },
    {
        name: 'WindAngle',
        default: "---",
        unit: "\u00b0",
        caption: 'Wind Angle',
        classes: 'avn_windAngleWidget',
        dataKey: 'windAngle'
    },
    {
        name: 'WindSpeed',
        default: "---",
        unit: "m/s",
        caption: 'Wind Speed',
        classes: 'avn_windSpeedWidget',
        dataKey: 'windSpeed'
    },
    {
        name: 'AnchorBearing',
        default: "---",
        unit: "\u00b0",
        caption: 'ACHR-BRG',
        dataKey: 'anchorDirection',
        classes: 'avn_largeWidget'
    },
    {
        name: 'AnchorDistance',
        default: "---",
        unit: "m",
        caption: 'ACHR-DST',
        dataKey: 'anchorDistance',
        classes: 'avn_largeWidget'
    },
    {
        name: 'AnchorWatchDistance',
        default: "---",
        unit: "m",
        caption: 'ACHR-WATCH',
        dataKey: 'anchorWatchDistance',
        classes: 'avn_largeWidget'
    },

    {
        name: 'RteDistance',
        default: "---",
        unit: "nm",
        caption: 'RTE-Dst',
        classes: 'avn_rteWidget',
        dataKey: 'routeRemain'
    },
    {
        name: 'RteEta',
        default: "---",
        unit: "h",
        caption: 'RTE-ETA',
        classes: 'avn_rteWidget',
        dataKey: 'routeEta'
    },
    {
        name: 'LargeTime',
        default: "--:--",
        caption: 'Time',
        wclass: Widget,
        classes: 'avn_timeWidget',
        dataKey: 'clock'
    },
    {
        name: 'WpPosition',
        default: "-------------",
        caption: 'MRK',
        //formatter: function(val){ return Formatter.formatDecimal(val,3,0);},
        wclass: Widget,
        classes: 'avn_posWidget',
        dataKey: 'markerPosition'

    },
    {
        name: 'Zoom',
        default: "--",
        caption: 'Zoom',
        classes: 'avn_zoomWidget',
        dataKey: 'zoom'
    },
    {
        name: 'AisTarget',
        caption: 'AIS',
        wclass: AisTargetWidget
    },
    {
        name: 'ActiveRoute',
        caption: 'RTE',
        wclass: ActiveRouteWidget
    },
    {
        name: 'EditRoute',
        caption: 'EDRTE',
        wclass: EditRouteWidget
    },
    {
        name: 'CenterDisplay',
        caption: 'Center',
        wclass: CenterDisplayWidget
    },
    {
        name: 'WindDisplay',
        caption: 'Wind',
        wclass: WindWidget
    },
    {
        name: 'DepthDisplay',
        caption: 'DPT',
        dataKey: 'depthBelowTransducer',
        classes: 'avn_depthWidget',
        unit: 'm'
    },
    {
        name: 'XteDisplay',
        caption: 'XTE',
        wclass: XteWidget,
        dataKey: 'markerXte'
    },
    {
        name: 'WindGraphics',
        caption: 'Wind',
        wclass: WindGraphics,
        dataKey: ['windAngle','windSpeed']
    },
    {
        name: 'Empty',
        wclass: EmptyWidget,
    },
    {
        name: 'RteCombine',
        caption: '',
        children: [{name:'RteDistance'},{name:'RteEta'}]
    },


];

module.exports=widgetList;
