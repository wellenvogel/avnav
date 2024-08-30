/**
 * Created by andreas on 20.11.16.
 */
import EtaWidget from './EtaWidget.jsx';
import TimeStatusWidget from './TimeStatusWidget.jsx';
import AisTargetWidget from './AisTargetWidget.jsx';
import ActiveRouteWidget from './ActiveRouteWidget.jsx';
import EditRouteWidget from './EditRouteWidget.jsx';
import CenterDisplayWidget from './CenterDisplayWidget.jsx';
import WindWidget, {getWindData} from './WindWidget';
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
import assign from 'object-assign';
import {CombinedWidget} from "./CombinedWidget";

let widgetList=[
    {
        name: 'SOG',
        default: "0.0",
        unit: "kn",
        caption: 'SOG',
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
        storeKeys:{
            value: keys.nav.gps.course,
            isAverage:keys.nav.gps.courseAverageOn
        },
        formatter: 'formatDirection',
        editableParameters: {
            formatterParameters: false
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
        formatter: 'formatDirection',
        editableParameters: {
            formatterParameters: false
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
        formatter: 'formatDirection',
        editableParameters: {
            formatterParameters: false
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
        default: "----",
        unit: "nm",
        caption: 'DST',
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
        storeKeys:{
            value: keys.nav.wp.course
        },
        formatter: 'formatDirection',
        editableParameters: {
            formatterParameters: false
        }
    },
    {
        name: 'VMG',
        default: "0.0",
        unit: "kn",
        caption: 'VMG',
        storeKeys: {
            value: keys.nav.wp.vmg
        },
        formatter:'formatSpeed'

    },
    {
        name: 'STW',
        default: '0.0',
        unit: 'kn',
        caption: 'STW',
        storeKeys:{
            value: keys.nav.gps.waterSpeed
        },
        formatter: 'formatSpeed'
    },
    {
        name: 'WindAngle',
        default: "---",
        unit: "\u00b0",
        caption: 'Wind Angle',
        storeKeys:{
            windAngle:keys.nav.gps.windAngle,
            windDirectionTrue: keys.nav.gps.trueWindDirection,
            windAngleTrue: keys.nav.gps.trueWindAngle
        },
        formatter: 'formatDirection',
        editableParameters: {
            formatterParameters: false,
            value: false,
            caption: false,
            kind: {type:'SELECT',list:['auto','trueAngle','trueDirection','apparent'],default:'auto'}
        },
        translateFunction: (props)=>{
            const captions={
                A:'AWA',
                TD: 'TWD',
                TA: 'TWA'
            };
            let wind=getWindData(props);
            return {...props,value:wind.windAngle, caption:captions[wind.suffix] }
        }
    },
    {
        name: 'WindSpeed',
        default: "---",
        unit: "m/s",
        caption: 'Wind Speed',
        storeKeys:{
            windSpeed:keys.nav.gps.windSpeed,
            windSpeedTrue: keys.nav.gps.trueWindSpeed,
            showKnots: keys.properties.windKnots
        },
        formatter: 'formatSpeed',
        editableParameters: {
            formatterParameters: false,
            value: false,
            caption: false,
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
                caption:captions[wind.suffix],
                formatterParameters: props.showKnots?'k':'m',
                unit: props.showKnots?'kn':'m/s'
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
        formatter: 'formatDirection',
        editableParameters: {
            formatterParameters: false
        }
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
        formatterParameters: ['m']
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
    },

    {
        name: 'RteDistance',
        default: " ----- ",
        unit: "nm",
        caption: 'RTE-Dst',
        storeKeys:{
            value:keys.nav.route.remain
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
            value:keys.nav.gps.rtime,
            visible: keys.properties.showClock
        },
        formatter: 'formatClock'
    },
    {
        name: 'WpPosition',
        default: "-------------",
        caption: 'MRK',
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
        unit: 'm',
        storeKeys:{
            value:keys.nav.gps.depthBelowTransducer,
            visible: keys.properties.showDepth
        },
        formatter: 'formatDecimal',
        formatterParameters: [3,1,true]
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
        editableParameters:{
            formatter: false,
            unit: false,
            formatterParameters: false,
            value: false,
            caption: false,
            children: false
        }
    },
    {
        name: 'CombinedWidget',
        wclass: CombinedWidget
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
    },
    {
        name: 'Default' //a way to access the default widget providing all parameters in the layout
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
        unit: 'hPa',
        formatter: 'skPressure'
    },
    {
        name:'signalKCelsius',
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
