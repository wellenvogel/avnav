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
let ZoomWidget=require('./ZoomWidget.jsx');
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
        storeKeys: EtaWidget.storeKeys
    },
    {
        name: 'DST',
        default: "----",
        unit: "nm",
        caption: 'DST',
        classes: 'avn_distanceWidget',
        storeKeys:{
            value: keys.nav.wp.distance
        },
        formatter: 'formatDecimal',
        formatterParameters: [3,1]

    },
    {
        name: 'BRG',
        default: "---",
        unit: "\u00b0",
        caption: 'BRG',
        classes: 'avn_courseWidget',
        storeKeys:{
            value: keys.nav.wp.course
        },
        formatter: 'formatDecimal',
        formatterParameters: [3,0]
    },
    {
        name: 'VMG',
        default: "0.0",
        unit: "kn",
        caption: 'VMG',
        classes: 'avn_speedWidget',
        storeKeys: {
            value: keys.nav.wp.vmg
        },
        formatter:'formatDecimal',
        formatterParameters: [2, 1]
    },
    {
        name: 'WindAngle',
        default: "---",
        unit: "\u00b0",
        caption: 'Wind Angle',
        classes: 'avn_windAngleWidget',
        storeKeys:{
            value:keys.nav.gps.windAngle
        },
        formatter: 'formatDecimal',
        formatterParameters: [3,0]
    },
    {
        name: 'WindSpeed',
        default: "---",
        unit: "m/s",
        caption: 'Wind Speed',
        classes: 'avn_windSpeedWidget',
        storeKeys:{
            value:keys.nav.gps.windSpeed
        },
        formatter: 'formatDecimal',
        formatterParameters: [2,1]
    },
    {
        name: 'AnchorBearing',
        default: "---",
        unit: "\u00b0",
        caption: 'ACHR-BRG',
        storeKeys:{
            value:keys.nav.anchor.direction
        },
        formatter: 'formatDecimal',
        formatterParameters: [3,0],
        classes: 'avn_largeWidget'
    },
    {
        name: 'AnchorDistance',
        default: "---",
        unit: "m",
        caption: 'ACHR-DST',
        storeKeys:{
            value:keys.nav.anchor.distance
        },
        formatter: 'formatDecimal',
        formatterParameters: [3,1],
        classes: 'avn_largeWidget'
    },
    {
        name: 'AnchorWatchDistance',
        default: "---",
        unit: "m",
        caption: 'ACHR-WATCH',
        storeKeys:{
            value:keys.nav.anchor.watchDistance
        },
        formatter: 'formatDecimal',
        formatterParameters: [3,1],
        classes: 'avn_largeWidget'
    },

    {
        name: 'RteDistance',
        default: "---",
        unit: "nm",
        caption: 'RTE-Dst',
        classes: 'avn_rteWidget',
        storeKeys:{
            value:keys.nav.route.remain
        },
        formatter: 'formatDecimal',
        formatterParameters: [3,1]
    },
    {
        name: 'RteEta',
        default: "---",
        unit: "h",
        caption: 'RTE-ETA',
        classes: 'avn_rteWidget',
        storeKeys:{
            value:keys.nav.route.eta
        },
        formatter: 'formatTime'
    },
    {
        name: 'LargeTime',
        default: "--:--",
        caption: 'Time',
        classes: 'avn_timeWidget',
        storeKeys:{
            value:keys.nav.gps.rtime
        },
        formatter: 'formatClock',
        dataKey: 'clock'
    },
    {
        name: 'WpPosition',
        default: "-------------",
        caption: 'MRK',
        classes: 'avn_posWidget',
        storeKeys:{
            value:keys.nav.wp.position
        },
        formatter: 'formatLonLats'
    },
    {
        name: 'Zoom',
        caption: 'Zoom',
        wclass: ZoomWidget,
        storeKeys: ZoomWidget.storeKeys
    },
    {
        name: 'AisTarget',
        caption: 'AIS',
        wclass: AisTargetWidget,
        storeKeys: AisTargetWidget.storeKeys
    },
    {
        name: 'ActiveRoute',
        wclass: ActiveRouteWidget,
        storeKeys: ActiveRouteWidget.storeKeys
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
        unit: 'm',
        storeKeys:{
            value:keys.nav.gps.depthBelowTransducer
        },
        formatter: 'formatDecimal',
        formatterParameters: [3,1]
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
