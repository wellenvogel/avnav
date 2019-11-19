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
let keys=require('../util/keys.jsx').default;
let AlarmWidget=require('./AlarmWidget.jsx');
let RoutePointsWidget=require('./RoutePointsWidget.jsx');

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
        formatter:'formatSpeed'
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
        formatter: 'formatDirection'

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
        formatter: 'formatDistance'

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
        formatter: 'formatDirection'
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
        formatter:'formatSpeed'

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
        formatter: 'formatDirection'
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
        formatter: 'formatDirection',
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
        formatter: 'formatDistance',
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
        formatter: 'formatDistance'
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
            value:keys.nav.gps.rtime,
            visible: keys.properties.showClock
        },
        formatter: 'formatClock'
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
        wclass: EditRouteWidget,
        storeKeys: EditRouteWidget.storeKeys
    },
    {
        name: 'CenterDisplay',
        caption: 'Center',
        wclass: CenterDisplayWidget,
        storeKeys: CenterDisplayWidget.storeKeys
    },
    {
        name: 'WindDisplay',
        caption: 'Wind',
        wclass: WindWidget,
        storeKeys: WindWidget.storeKeys
    },
    {
        name: 'DepthDisplay',
        caption: 'DPT',
        dataKey: 'depthBelowTransducer',
        classes: 'avn_depthWidget',
        unit: 'm',
        storeKeys:{
            value:keys.nav.gps.depthBelowTransducer,
            visible: keys.properties.showDepth
        },
        formatter: 'formatDecimal',
        formatterParameters: [3,1]
    },
    {
        name: 'XteDisplay',
        wclass: XteWidget,
        storeKeys: XteWidget.storeKeys
    },
    {
        name: 'WindGraphics',
        wclass: WindGraphics,
        storeKeys: WindGraphics.storeKeys
    },
    {
        name: 'Empty',
        wclass: EmptyWidget
    },
    {
        name: 'RteCombine',
        caption: '',
        children: [{name:'RteDistance'},{name:'RteEta'}]
    },
    {
        name: 'Alarm',
        wclass:AlarmWidget,
        storeKeys: AlarmWidget.storeKeys
    },
    {
        name: 'RoutePoints',
        wclass: RoutePointsWidget,
        storeKeys: RoutePointsWidget.storeKeys
    }


];

module.exports=widgetList;
