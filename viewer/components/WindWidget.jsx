/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import Formatter from '../util/formatter';
import keys from '../util/keys.jsx';
import navcompute from '../nav/navcompute.js';
import {WidgetFrame, WidgetHead, WidgetProps} from "./WidgetBase";
import Helper from '../util/helper.js';
import {useKeyEventHandler} from "../util/GuiHelpers";

export const getWindData=(props)=>{
    let kind = props.kind;
    let windSpeed;
    let windAngle;
    let suffix='';
    if (kind !== 'true' && kind !== 'apparent' && kind !== 'trueAngle' && kind !== 'trueDirection') kind='auto';
    if (kind === 'auto'){
        if (props.windAngle !== undefined && props.windSpeed !== undefined){
            kind = 'apparent';
        } else if (props.windAngleTrue !== undefined && props.windSpeedTrue !== undefined){
            kind = 'trueAngle';
        } else if (props.windDirectionTrue !== undefined && props.windSpeedTrue !== undefined){
            kind = 'trueDirection';
        } else {
            kind = 'apparent';
        }
    }
    if (kind === 'apparent'){
        windAngle=props.windAngle;
        windSpeed=props.windSpeed;
        suffix='A';
    }
    if (kind === 'true' || kind === 'trueAngle'){
        windAngle=props.windAngleTrue;
        windSpeed=props.windSpeedTrue;
        suffix="TA";
    }
    if (kind === 'trueDirection'){
        windAngle=props.windDirectionTrue;
        windSpeed=props.windSpeedTrue;
        suffix="TD";
    }
    return {
        windAngle: windAngle,
        windSpeed: windSpeed,
        suffix: suffix
    }
}

const WindWidget = (props) => {
    useKeyEventHandler(props, "widget");
    const names = {
        A: {
            speed: 'AWS',
            angle: 'AWA'
        },
        TD: {
            speed: 'TWS',
            angle: 'TWD'
        },
        TA: {
            speed: 'TWS',
            angle: 'TWA'
        }
    }
    let classes = "widget windWidget " + props.className || "";
    let wind = getWindData(props);
    var a180 = !(props.show360 || wind.suffix.endsWith('D'));
    var angle = Formatter.formatDirection(wind.windAngle,false,a180);
    var unit = props.formatterParameters ? props.formatterParameters[0] : 'kn';
    var speed = Formatter.formatSpeed(wind.windSpeed,unit);
    return (
        <WidgetFrame {...props} addClass="windWidget" caption={undefined} unit={undefined}>
            {(props.mode === 'horizontal') ?
                <React.Fragment>
                    <WidgetHead caption={'W' + wind.suffix}/>
                    <div className="widgetData">
                        {angle}<span className="unit">°</span>
                        \{speed}<span className="unit">{unit}</span>
                    </div>
                </React.Fragment>
                :
                <React.Fragment>
                        <div className="windInner">
                            <WidgetHead caption={names[wind.suffix].angle} unit='°'/>
                            <div className='widgetData'>{angle}</div>
                        </div>
                        <div className="windInner">
                            <WidgetHead caption={names[wind.suffix].speed} unit={unit}/>
                            <div className='widgetData'>{speed}</div>
                        </div>
                </React.Fragment>
            }
        </WidgetFrame>
    );
}


WindWidget.propTypes={
    ...WidgetProps,
    windAngle:  PropTypes.number,
    windSpeed:  PropTypes.number,
    windAngleTrue:  PropTypes.number,
    windSpeedTrue:  PropTypes.number,
    enabled:    PropTypes.bool,
    kind: PropTypes.string,
    showKnots: PropTypes.bool,
    show360: PropTypes.bool,
    mode: PropTypes.string
};

WindWidget.storeKeys={
    windAngle: keys.nav.gps.windAngle,
    windSpeed: keys.nav.gps.windSpeed,
    windAngleTrue: keys.nav.gps.trueWindAngle,
    windSpeedTrue: keys.nav.gps.trueWindSpeed,
    windDirectionTrue: keys.nav.gps.trueWindDirection,
    visible: keys.properties.showWind,
    showKnots: keys.properties.windKnots
};
WindWidget.formatter='formatSpeed';
WindWidget.editableParameters={
    formatterParameters: true,
    show360: {type:'BOOLEAN',default:false},
    kind: {type:'SELECT',list:['auto','trueAngle','trueDirection','apparent'],default:'auto'}
};

export default WindWidget;
