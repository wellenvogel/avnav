/**
 * Created by andreas on 20.11.16.
 */
import EtaWidget from './EtaWidget.jsx';
import TimeStatusWidget from './TimeStatusWidget.jsx';
import AisTargetWidget from './AisTargetWidget.jsx';
import ActiveRouteWidget from './ActiveRouteWidget.jsx';
import EditRouteWidget from './EditRouteWidget.jsx';
import CenterDisplayWidget from './CenterDisplayWidget.jsx';
import WindWidget, {getWindData, WindStoreKeys} from './WindWidget';
import XteWidget from './XteWidget';
import EmptyWidget from './EmptyWidget';
import WindGraphics from './WindGraphics';
import ZoomWidget from './ZoomWidget.jsx';
import keys from '../util/keys.jsx';
import AlarmWidget from './AlarmWidget.jsx';
import RoutePointsWidget from './RoutePointsWidget.jsx';
import DateTimeWidget from './DateTimeWidget.jsx';
import {GaugeRadial} from './CanvasGauges.jsx';
import UndefinedWidget from './UndefinedWidget.jsx';
import {SKPitchWidget, SKRollWidget} from "./SKWidgets";
import {CombinedWidget} from "./CombinedWidget";
import Formatter from "../util/formatter";
import {DepthDisplayFlex} from "./DepthWidgetFlex";
let widgetList=[
    {
        name: 'SOG',
        default: "---",
        caption: 'SOG',
        storeKeys: {
            value: keys.nav.gps.speed,
            isAverage: keys.nav.gps.speedAverageOn
        },
        editableParameters: {
            unit:false
        },
        formatter:'formatSpeed'
    },
    {
        name: 'COG',
        default: "---",
        unit: "\u00b0",
        caption: 'COG',
        storeKeys:{
            value: keys.nav.gps.course,
            isAverage:keys.nav.gps.courseAverageOn
        },
        formatter: 'formatDirection360',
        editableParameters: {
            formatterParameters: true
        }

    },
    {
        name: 'HDM',
        default: "---",
        unit: "\u00b0",
        caption: 'HDM',
        storeKeys:{
            value: keys.nav.gps.headingMag
        },
        formatter: 'formatDirection360',
        editableParameters: {
            formatterParameters: true
        }
    },
    {
        name: 'HDT',
        default: "---",
        unit: "\u00b0",
        caption: 'HDT',
        storeKeys:{
            value: keys.nav.gps.headingTrue
        },
        formatter: 'formatDirection360',
        editableParameters: {
            formatterParameters: true
        }
    },
    {
        name: 'Position',
        default: "-------------",
        caption: 'BOAT',
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
        default: "---",
        caption: 'DST',
        storeKeys:{
            value: keys.nav.wp.distance,
            server: keys.nav.wp.server
        },
        updateFunction: (state)=>{
            return {
                value: state.value,
                disconnect: state.server === false
            }
        },
        formatter: 'formatDistance',
        editableParameters: {
            unit: false
        }

    },
    {
        name: 'BRG',
        default: "---",
        unit: "\u00b0",
        caption: 'BRG',
        storeKeys:{
            value: keys.nav.wp.course
        },
        formatter: 'formatDirection360',
        editableParameters: {
            formatterParameters: true
        }
    },
    {
        name: 'VMG',
        default: "---",
        caption: 'VMG',
        storeKeys: {
            value: keys.nav.wp.vmg
        },
        editableParameters: {
            unit:false
        },
        formatter:'formatSpeed'

    },
    {
        name: 'STW',
        default: '---',
        caption: 'STW',
        storeKeys:{
            value: keys.nav.gps.waterSpeed
        },
        editableParameters: {
            unit:false
        },
        formatter: 'formatSpeed'
    },
    {
        name: 'WindAngle',
        default: "---",
        unit: "\u00b0",
        caption: 'Wind Angle',
        storeKeys:WindStoreKeys,
        formatter: 'formatString',
        editableParameters: {
            formatterParameters: false,
            formatter: false,
            value: false,
            caption: false,
            kind: {type:'SELECT',list:['auto','trueAngle','trueDirection','apparent'],default:'auto'},
            show360: {type:'BOOLEAN',default: false,description:'always show 360°'},
            leadingZero:{type:'BOOLEAN',default: false,description:'show leading zeroes (012)'}
        },
        translateFunction: (props)=>{
            const captions={
                A:'AWA',
                TD: 'TWD',
                TA: 'TWA'
            };
            const formatter={
                A: (v)=>Formatter.formatDirection(v,undefined,!props.show360,props.leadingZero),
                TD: (v)=>Formatter.formatDirection(v,undefined,false,props.leadingZero),
                TA:(v)=>Formatter.formatDirection(v,undefined,!props.show360,props.laedingZero),
            }
            let wind=getWindData(props);
            const fmt=formatter[wind.suffix];
            let value;
            if (!fmt) value=Formatter.formatDirection(wind.windAngle);
            else value=fmt(wind.windAngle);
            return {...props,value:value, caption:captions[wind.suffix] }
        }
    },
    {
        name: 'WindSpeed',
        default: "---",
        caption: 'Wind Speed',
        storeKeys:WindStoreKeys,
        formatter: 'formatSpeed',
        editableParameters: {
            value: false,
            caption: false,
            unit: false,
            kind: {type:'SELECT',list:['auto','true','apparent'],default:'auto'}
        },
        translateFunction: (props)=>{
            const captions={
                A:'AWS',
                TD: 'TWS',
                TA: 'TWS'
            };
            let wind=getWindData(props);
            return {...props,
                value:wind.windSpeed,
                caption:captions[wind.suffix]
            }
        }
    },
    {
        name: 'WaterTemp',
        default: '---',
        unit: '°',
        caption: 'Water Temp',
        storeKeys: {
            value: keys.nav.gps.waterTemp
        },
        formatter: 'formatTemperature',
        formatterParameters: 'celsius'
    },
    {
        name: 'AnchorBearing',
        default: "---",
        unit: "\u00b0",
        caption: 'ACHR-BRG',
        storeKeys:{
            value:keys.nav.anchor.direction
        },
        formatter: 'formatDirection360',
        editableParameters: {
            formatterParameters: true
        }
    },
    {
        name: 'AnchorDistance',
        default: "---",
        caption: 'ACHR-DST',
        storeKeys:{
            value:keys.nav.anchor.distance
        },
        editableParameters: {
            unit:false
        },
        formatter: 'formatDistance',
        formatterParameters: ['m']
    },
    {
        name: 'AnchorWatchDistance',
        default: "---",
        caption: 'ACHR-WATCH',
        storeKeys:{
            value:keys.nav.anchor.watchDistance
        },
        editableParameters: {
            unit:false
        },
        formatter: 'formatDistance',
        formatterParameters: ['m'],
    },

    {
        name: 'RteDistance',
        default: "---",
        caption: 'RTE-Dst',
        storeKeys:{
            value:keys.nav.route.remain
        },
        editableParameters: {
            unit:false
        },
        formatter: 'formatDistance'
    },
    {
        name: 'RteEta',
        default: " --:--:-- ",
        unit: "h",
        caption: 'RTE-ETA',
        storeKeys:{
            value:keys.nav.route.eta
        },
        formatter: 'formatTime'
    },
    {
        name: 'LargeTime',
        default: "--:--",
        caption: 'Time',
        storeKeys:{
            value:keys.nav.gps.rtime
        },
        formatter: 'formatClock'
    },
    {
        name: 'WpPosition',
        default: "-------------",
        caption: 'MRK',
        storeKeys:{
            value:keys.nav.wp.position,
            server: keys.nav.wp.server
        },
        updateFunction: (state)=>{
            return {
                value: state.value,
                disconnect: state.server === false
            }

        },
        formatter: 'formatLonLats'
    },
    {
        name: 'Zoom',
        caption: 'Zoom',
        wclass: ZoomWidget,
    },
    {
        name: 'AisTarget',
        wclass: AisTargetWidget,
    },
    {
        name: 'ActiveRoute',
        wclass: ActiveRouteWidget,
    },
    {
        name: 'EditRoute',
        wclass: EditRouteWidget,
    },
    {
        name: 'CenterDisplay',
        wclass: CenterDisplayWidget
    },
    {
        name: 'WindDisplay',
        wclass: WindWidget,
    },
    {
        name: 'DepthDisplay',
        default: "---",
        caption: 'DPT',
        unit: 'm',
        storeKeys:{
            value:keys.nav.gps.depthBelowTransducer
        },
        formatter: 'formatDecimal',
        formatterParameters: [3,1,true],
        editableParameters: {
            maxValue: {type:'NUMBER',default:12000,description:'consider any value above this (in meters) as invalid'}
        }
    },
    {
      name: 'DepthDisplayFlex',
      wclass: DepthDisplayFlex
    },
    {
        name: 'XteDisplay',
        wclass: XteWidget,
    },
    {
        name: 'WindGraphics',
        wclass: WindGraphics
    },
    {
        name: "DateTime",
        wclass: DateTimeWidget
    },
    {
        name: 'Empty',
        wclass: EmptyWidget
    },
    {
        name: 'RteCombine',
        wclass: CombinedWidget,
        caption: '',
        children: [{name:'RteDistance'},{name:'RteEta'}],
        locked:true,
        editableParameters:{
            formatter: false,
            unit: false,
            formatterParameters: false,
            value: false,
            caption: false,
            children: false,
            locked: false
        }
    },
    {
        name: 'CombinedWidget',
        wclass: CombinedWidget
    },
    {
        name: 'Alarm',
        wclass:AlarmWidget,
    },
    {
        name: 'RoutePoints',
        wclass: RoutePointsWidget,
    },
    {
        name: 'Default', //a way to access the default widget providing all parameters in the layout
        default: "---",
    },
    {
        name: 'RadialGauge',
        wclass: GaugeRadial,
        editableParameters: {
            minValue: {type:'NUMBER',default:0},
            maxValue: {type:'NUMBER',default: 100}
        }
    },
    {
        name: 'Undefined',
        wclass: UndefinedWidget
    },
    {
        name: 'signalKPressureHpa',
        default: "---",
        formatter: 'skPressure',
        editableParameters: {
            unit:false
        },
    },
    {
        name:'signalKCelsius',
        default: "---",
        unit:'°',
        formatter: 'skTemperature'
    },
    {
        name: 'signalKRoll',
        wclass: SKRollWidget
    },
    {
        name: 'signalKPitch',
        wclass: SKPitchWidget
    }



];

export default widgetList;
