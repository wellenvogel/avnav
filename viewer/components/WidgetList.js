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
let widgetList=[
    {
        name: 'SOG',
        default: "0.0",
        unit: "kn",
        caption: 'SOG',
        //formatter: function(val){ return Formatter.formatDecimal(val,4,1);},
        wclass: Widget,
        classes: 'avn_speedWidget',
        dataKey: 'gpsSpeed',
        averageKey: 'gpsSpeedAverage'
    },
    {
        name: 'COG',
        default: "---",
        unit: "\u00b0",
        caption: 'COG',
        //formatter: function(val){ return Formatter.formatDecimal(val,3,0);},
        wclass: Widget,
        classes: 'avn_courseWidget',
        dataKey: 'gpsCourse',
        averageKey: 'gpsCourseAverage'

    },
    {
        name: 'Position',
        default: "-------------",
        caption: 'BOAT',
        //formatter: function(val){ return Formatter.formatDecimal(val,3,0);},
        wclass: Widget,
        classes: 'avn_posWidget',
        dataKey: 'gpsPosition',
        averageKey: 'gpsPositionAverage'

    },
    {
        name: 'TimeStatus',
        caption: 'GPS',
        wclass: TimeStatusWidget
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
        //formatter: function(val){ return Formatter.formatDecimal(val,4,1);},
        wclass: Widget,
        classes: 'avn_distanceWidget',
        dataKey: 'markerDistance'
    },
    {
        name: 'BRG',
        default: "---",
        unit: "\u00b0",
        caption: 'BRG',
        //formatter: function(val){ return Formatter.formatDecimal(val,3,0);},
        wclass: Widget,
        classes: 'avn_courseWidget',
        dataKey: 'markerCourse'
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
        classes: 'avn_windWidget',
        unit: 'm'
    },
    {
        name: 'XteDisplay',
        caption: 'XTE',
        wclass: XteWidget,
        dataKey: 'markerXte'
    },

];

module.exports=widgetList;
