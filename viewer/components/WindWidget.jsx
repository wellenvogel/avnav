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
            windAngle=props.windAngle;
            windSpeed=props.windSpeed;
            suffix='A';
        }
        else{
            if (props.windAngleTrue !== undefined){
                windAngle=props.windAngleTrue;
                windSpeed=props.windSpeedTrue;
                suffix="TA";
            }
            else{
                windAngle=props.windDirectionTrue;
                windSpeed=props.windSpeedTrue;
                suffix="TD";
            }
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
    let wind = getWindData(props);
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
    let windSpeedStr = props.formatter(wind.speed);
    if (!props.show360 && wind.suffix !== 'TD') {
        if (wind.windAngle > 180) wind.windAngle -= 360;
    }
    return (
        <WidgetFrame {...props} addClass="windWidget" caption={undefined} unit={undefined} resize={props.mode === 'horizontal'}>
            {(props.mode === 'horizontal') ?
                <React.Fragment>
                    <WidgetHead caption={props.caption?props.caption:'W' + wind.suffix}/>
                    <div className="widgetData">
                        {Formatter.formatDirection(wind.windAngle)}
                        <span className="unit">°</span>
                        /{windSpeedStr}
                        <span className="unit">{props.unit}</span>
                    </div>
                </React.Fragment>
                :
                <React.Fragment>
                        <WidgetFrame addClass="windInner" resize={true} mode={props.mode} caption={names[wind.suffix].angle} unit='°'>
                            <div className='widgetData'>{Formatter.formatDirection(wind.windAngle)}</div>
                        </WidgetFrame>
                        <WidgetFrame addClass="windInner" resize={true} mode={props.mode} caption={names[wind.suffix].speed} unit={props.unit}>
                            <div className='widgetData'>{windSpeedStr}</div>
                        </WidgetFrame>
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
    kind: PropTypes.string, //true,apparent,auto,
    show360: PropTypes.bool,
    mode: PropTypes.string
};

WindWidget.predefined= {
    storeKeys: {
        windAngle: keys.nav.gps.windAngle,
        windSpeed: keys.nav.gps.windSpeed,
        windAngleTrue: keys.nav.gps.trueWindAngle,
        windSpeedTrue: keys.nav.gps.trueWindSpeed,
        windDirectionTrue: keys.nav.gps.trueWindDirection
    },
    editableParameters: {
        show360: {type: 'BOOLEAN', default: false},
        kind: {
            type: 'SELECT',
            list: ['auto', 'trueAngle', 'trueDirection', 'apparent'],
            default: 'auto',
            description: 'which wind data to be shown\nauto will try apparent, trueAngle, trueDirection and display the first found data'
        },
        formatter: true,
        formatterParameters: true
    },
    formatter :'formatSpeed'
}

export default WindWidget;