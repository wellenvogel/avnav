/**
 * Created by andreas on 20.11.16.
 */
import EtaWidget from './EtaWidget.tsx';
import TimeStatusWidget from './TimeStatusWidget.tsx';
import AisTargetWidget from './AisTargetWidget.tsx';
import ActiveRouteWidget from './ActiveRouteWidget.tsx';
import EditRouteWidget from './EditRouteWidget.tsx';
import CenterDisplayWidget from './CenterDisplayWidget.jsx';
import WindWidget, {getWindData, WindStoreKeys} from './WindWidget';
import XteWidget from './XteWidget';
import EmptyWidget from './EmptyWidget';
import WindGraphics from './WindGraphics';
import ZoomWidget from './ZoomWidget.jsx';
import keys from '../util/keys.ts';
import AlarmWidget from './AlarmWidget.tsx';
import RoutePointsWidget from './RoutePointsWidget.jsx';
import DateTimeWidget from './DateTimeWidget.jsx';
import {GaugeRadial} from './CanvasGauges.jsx';
import UndefinedWidget from './UndefinedWidget.jsx';
import {SKPitchWidget, SKRollWidget} from "./SKWidgets";
import {CombinedWidget} from "./CombinedWidget";
import Formatter from "../util/formatter";
import {DepthBelowKeel, DepthBelowTransducer, DepthBelowWater} from "./DepthWidgetFlex";
import {NmeaStatusWidget} from "./NmeaStatusWidget";
const degrees='\u00b0';
let widgetList=[
    {
        name: 'SOG',
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
        unit: degrees,
        caption: 'COG',
        storeKeys:{
            value: keys.nav.gps.course,
            isAverage:keys.nav.gps.courseAverageOn
        },
        formatter: 'formatDirection360',
        editableParameters: {
            formatterParameters: true,
            unit: false
        }

    },
    {
        name: 'HDM',
        unit: degrees,
        caption: 'HDM',
        storeKeys:{
            value: keys.nav.gps.headingMag
        },
        formatter: 'formatDirection360',
        editableParameters: {
            formatterParameters: true,
            unit: false
        }
    },
    {
        name: 'HDT',
        unit: degrees,
        caption: 'HDT',
        storeKeys:{
            value: keys.nav.gps.headingTrue
        },
        formatter: 'formatDirection360',
        editableParameters: {
            formatterParameters: true,
            unit: false
        }
    },
    {
        name: 'Position',
        caption: 'BOAT',
        storeKeys:{
            value: keys.nav.gps.position,
            isAverage: keys.nav.gps.positionAverageOn,
            gpsValid: keys.nav.gps.valid,
        },
        formatter: 'formatLonLats',
        editableParameters: {
            unit: false,
        },
        translateFunction: (props)=>{
            return {...props,
              unit: props.gpsValid?'OK':'ERROR',
              addClass: props.gpsValid?'ok':'error',
            }
        },
    },
    {
        name: 'TimeStatus',
        caption: 'GPS',
        wclass: TimeStatusWidget,
        storeKeys: TimeStatusWidget.storeKeys,
    },
    {
        name: 'GNSSStatus',
        caption: 'GNSS Status',
        storeKeys:{
            fix: keys.nav.gps.fixType,
            qual: keys.nav.gps.fixQuality,
            sats: keys.nav.gps.satInview,
            used: keys.nav.gps.satUsed,
            hdop: keys.nav.gps.HDOP,
            valid: keys.nav.gps.valid,
        },
        formatter: 'formatString',
        editableParameters: {
            unit: false,
            value: false,
        },
        translateFunction: (props)=>{
            const ok = props.valid && (props.fix??3)>1 && (props.qual??1)>0;
            const warn = (props.hdop??0)>5;
            let q = props.qual??'';
            if(q==0) q='';
            if(q==1) q='';
            if(q==2) q='SBAS';
            if(q==4) q='fixed RTK';
            if(q==5) q='floating RTK';
            if(q==6) q='dead reckoning';
            if(q==8) q='simulated';
            return {...props,
              unit: warn?'HDOP':ok?'OK':'ERR',
              addClass: warn?'warning':ok?'ok':'error',
              value: `${props.fix??'-'}D ${props.used??'--'}/${props.sats??'--'} H${props.hdop??'--.-'} ${q}`
            }
        },
    },
    {
        name: 'ETA',
        wclass: EtaWidget,
        storeKeys: EtaWidget.storeKeys
    },
    {
        name:'WpTTG',
        storeKeys:{
            server:keys.nav.wp.server,
            value:keys.nav.wp.ttgvmg,
            ttgsog:keys.nav.wp.ttgsog
        } ,
        translateFunction: (props)=>{
            return {
                value:props.useSog?props.ttgsog:props.value,
                disconnect: props.server === false,
                caption: props.caption|| 'WP-TTG'+(props.useSog?'S':'V')
            }
        },
        formatter: 'formatTimeDiff',
        editableParameters:{
            unit:false,
            useSog:{type:'BOOLEAN',default:false,displayName:'use sog',
                description:'If set use SOG instead of VMG to compute the time'}
        },
        className: 'med',
    },
    {
        name: 'DST',
        caption: 'DST',
        storeKeys:{
            value: keys.nav.wp.distance,
            server: keys.nav.wp.server
        },
        updateFunction: (state)=>{
            return {
                value:state.value,
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
        unit: degrees,
        caption: 'BRG',
        storeKeys:{
            value: keys.nav.wp.course,
            server: keys.nav.wp.server
        },
        translateFunction: (state)=>{
            return {
                disconnect: state.server === false
            }
        },
        formatter: 'formatDirection360',
        editableParameters: {
            formatterParameters: true,
            unit:false
        }
    },
    {
        name: 'VMG',
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
        unit: degrees,
        caption: 'Wind Angle',
        storeKeys:WindStoreKeys,
        formatter: 'formatString',
        editableParameters: {
            formatterParameters: false,
            formatter: false,
            value: false,
            caption: false,
            unit: false,
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
        caption: 'Water Temp',
        storeKeys: {
            value: keys.nav.gps.waterTemp
        },
        formatter: 'formatTemperature',
        formatterParameters: 'celsius',
        unit:false
    },
    {
        name: 'AnchorBearing',
        unit: degrees,
        caption: 'ACHR-BRG',
        storeKeys:{
            value:keys.nav.anchor.direction
        },
        formatter: 'formatDirection360',
        editableParameters: {
            unit: false,
            formatterParameters: true
        }
    },
    {
        name: 'AnchorDistance',
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
        caption: 'RTE-DST',
        storeKeys:{
            value:keys.nav.route.remain,
            server: keys.nav.wp.server,
        },
        editableParameters: {
            unit:false
        },
        formatter: 'formatDistance',
        translateFunction: (props)=>{
            return {
              disconnect: props.server === false,
            }
        },
    },
    {
        name: 'RteEta',
        storeKeys:{
            value:keys.nav.route.eta,
            time:keys.nav.gps.rtime,
            server: keys.nav.wp.server,
        },
        formatter: 'formatTime',
        translateFunction: (props)=>{
            return {...props,
              caption: (props.caption||'RTE-ETA'),
              disconnect: props.server === false
            }
        },
        editableParameters: {
            unit: false,
        }
    },
    {
        name: 'RteTTG',
        storeKeys:{
            value:keys.nav.route.ttgvmg,
            ttgsog:keys.nav.route.ttgsog,
            server: keys.nav.wp.server,
        },
        formatter: 'formatTimeDiff',
        translateFunction: (props)=>{
            return {
              value: props.useSog?props.ttgsog:props.value,
              caption: (props.caption||'RTE-TTG'+(props.useSog?'S':'V')),
              disconnect: props.server === false,
            }
        },
        editableParameters: {
            unit: false,
            useSog:{type:'BOOLEAN',default:false,displayName:'use sog',
                description:'If set use SOG instead of VMG to compute the time'}
        },
        className:'med'
    },
    {
        name: 'LargeTime',
        caption: 'Time',
        storeKeys:{
            value:keys.nav.gps.rtime,
            gpsValid: keys.nav.gps.valid,
            visible: keys.properties.showClock
        },
        formatter: 'formatClock',
        translateFunction: (props)=>{
            return {...props,
              unit: props.gpsValid?'OK':'ERROR'
            }
        },
        editableParameters: {
            unit: false,
        }
    },
    {
        name: 'WpPosition',
        caption: 'WP',
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
        formatter: 'formatLonLats',
        editableParameters: {
            unit: false,
        },
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
        name: 'WindGraphics',
        wclass: WindGraphics
    },
    {
        name: 'DepthDisplay',
        caption: 'DBT',
        storeKeys:{
            value:keys.nav.gps.depthBelowTransducer
        },
        formatter: 'formatDecimal',
        formatterParameters: [3,1,true],
        editableParameters: {
            maxValue: {type:'NUMBER',default:12000,description:'consider any value above this (in meters) as invalid'}
        },
        description:'Show depthBelowTransducer. Legacy, use DepthBelowTransducer, DepthBelowKeel or DepthBelowWater.'
    },
    {
      name: 'DepthBelowTransducer',
      wclass: DepthBelowTransducer
    },
    {
        name: 'DepthBelowKeel',
        wclass: DepthBelowKeel
    },
    {
        name: 'DepthBelowWater',
        wclass: DepthBelowWater
    },
    {
        name: 'XteDisplay',
        wclass: XteWidget,
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
        formatter: 'skPressure',
        editableParameters: {
            unit:false
        },
    },
    {
        name:'signalKCelsius',
        formatter: 'skTemperature',
        formatterParameters: 'celsius',
    },
    {
        name: 'signalKRoll',
        wclass: SKRollWidget
    },
    {
        name: 'signalKPitch',
        wclass: SKPitchWidget
    },
    {
        name: 'NmeaStatus',
        wclass: NmeaStatusWidget,
        caption:'NmeaStatus',
        formatter: false,
        formatterParameters: false
    }



];

export default widgetList;
