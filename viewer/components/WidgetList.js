/**
 * Created by andreas on 20.11.16.
 */
var Widget=require('./Widget.jsx');
var EtaWidget=require('./EtaWidget.jsx');
var TimeStatusWidget=require('./TimeStatusWidget.jsx');
var AisTargetWidget=require('./AisTargetWidget.jsx');
var ActiveRouteWidget=require('./ActiveRouteWidget.jsx');
var EditRouteWidget=require('./EditRouteWidget.jsx');
var CenterDisplayWidget=require('./CenterDisplayWidget.jsx');
var Formatter=require('../util/formatter');
var widgetList=[
    {
        name: 'SOG',
        default: "0.0",
        unit: "kn",
        caption: 'SOG',
        //formatter: function(val){ return Formatter.formatDecimal(val,4,1);},
        wclass: Widget,
        classes: 'avn_speedWidget',
        dataKey: 'gpsSpeed'
    },
    {
        name: 'COG',
        default: "---",
        unit: "\u00b0",
        caption: 'COG',
        //formatter: function(val){ return Formatter.formatDecimal(val,3,0);},
        wclass: Widget,
        classes: 'avn_courseWidget',
        dataKey: 'gpsCourse'

    },
    {
        name: 'Position',
        default: "-------------",
        caption: 'BOAT',
        //formatter: function(val){ return Formatter.formatDecimal(val,3,0);},
        wclass: Widget,
        classes: 'avn_posWidget',
        dataKey: 'gpsPosition'

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
];

module.exports=widgetList;
