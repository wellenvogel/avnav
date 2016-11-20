/**
 * Created by andreas on 20.11.16.
 */
var Widget=require('./Widget.jsx');
var EtaWidget=require('./EtaWidget.jsx');
var TimeStatusWidget=require('./TimeStatusWidget.jsx');
var Formatter=require('../util/formatter');
var widgetList=[
    {
        name: 'SOG',
        max: "100.0",
        unit: "kn",
        caption: 'SOG',
        //formatter: function(val){ return Formatter.formatDecimal(val,4,1);},
        wclass: Widget,
        classes: 'avn_speedWidget',
        dataKey: 'gpsSpeed'
    },
    {
        name: 'COG',
        max: "999",
        unit: "°",
        caption: 'COG',
        //formatter: function(val){ return Formatter.formatDecimal(val,3,0);},
        wclass: Widget,
        classes: 'avn_courseWidget',
        dataKey: 'gpsCourse'

    },
    {
        name: 'Position',
        max: "-------------",
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
        max: "99999.0",
        unit: "nm",
        caption: 'DST',
        //formatter: function(val){ return Formatter.formatDecimal(val,4,1);},
        wclass: Widget,
        classes: 'avn_distanceWidget',
        dataKey: 'markerDistance'
    },
    {
        name: 'BRG',
        max: "999",
        unit: "°",
        caption: 'BRG',
        //formatter: function(val){ return Formatter.formatDecimal(val,3,0);},
        wclass: Widget,
        classes: 'avn_courseWidget',
        dataKey: 'markerCourse'
    },
    {
        name: 'WpPosition',
        max: "-------------",
        caption: 'MRK',
        //formatter: function(val){ return Formatter.formatDecimal(val,3,0);},
        wclass: Widget,
        classes: 'avn_posWidget',
        dataKey: 'markerPosition'

    },
];

module.exports=widgetList;
