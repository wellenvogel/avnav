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
import {CombinedWidget} from "./CombinedWidget";
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
        default: "---",
        unit: "nm",
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
        formatter: 'formatDirection',
        editableParameters: {
            formatterParameters: false
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
        caption: 'Wind Speed',
        storeKeys:{
            windSpeed:keys.nav.gps.windSpeed,
            windSpeedTrue: keys.nav.gps.trueWindSpeed,
        },
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
        formatter: 'formatDirection',
        editableParameters: {
            formatterParameters: false
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
        storeKeys: CenterDisplayWidget.storeKeys,
        editableParameters: {
            formatter: false,
            formatterParameters: false
        }
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
        storeKeys: AlarmWidget.storeKeys
    },
    {
        name: 'RoutePoints',
        wclass: RoutePointsWidget,
        storeKeys: RoutePointsWidget.storeKeys
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
