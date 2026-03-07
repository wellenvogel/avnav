/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import Formatter from '../util/formatter';
import keys from '../util/keys.jsx';
import {WidgetFrame, WidgetHead, WidgetProps} from "./WidgetBase";

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

export const WindStoreKeys={
    windAngle: keys.nav.gps.windAngle,
    windSpeed: keys.nav.gps.windSpeed,
    windAngleTrue: keys.nav.gps.trueWindAngle,
    windSpeedTrue: keys.nav.gps.trueWindSpeed,
    windDirectionTrue: keys.nav.gps.trueWindDirection
}
export const WindProps={
    windAngle:  PropTypes.number,
    windSpeed:  PropTypes.number,
    windAngleTrue:  PropTypes.number,
    windSpeedTrue:  PropTypes.number,
    kind: PropTypes.string //true,apparent,auto,
}

const WindWidget = (props) => {
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
    let wind = getWindData(props);
    let a180 = !(props.show360 || wind.suffix.endsWith('D'));
    let angle = Formatter.formatDirection(wind.windAngle,false,a180,true);
    let unit = ((props.formatterParameters instanceof Array) && props.formatterParameters.length > 0) ? props.formatterParameters[0] : 'kn';
    let speed = Formatter.formatSpeed(wind.windSpeed,unit);
    return (
        <WidgetFrame {...props} addClass="windWidget" caption={undefined} unit={undefined}>
            {(props.mode === 'horizontal') ?
                <React.Fragment>
                    <WidgetHead caption={props.caption?props.caption:'W' + wind.suffix} unit={'°/'+unit}/>
                    <div className="widgetData">
                        {angle}/{speed}
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
    ...WindProps,
    show360: PropTypes.bool,
};

WindWidget.predefined= {
    storeKeys: WindStoreKeys,
    formatter: 'formatSpeed',
    editableParameters: {
        show360: {type: 'BOOLEAN', default: false},
        kind: {
            type: 'SELECT',
            list: ['auto', 'trueAngle', 'trueDirection', 'apparent'],
            default: 'auto',
            description: 'which wind data to be shown\nauto will try apparent, trueAngle, trueDirection and display the first found data'
        },
        formatter: false,
        formatterParameters: true
    },
};

export default WindWidget;
