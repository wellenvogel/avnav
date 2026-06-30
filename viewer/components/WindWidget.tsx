/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import Formatter from '../util/formatter';
import keys from '../util/keys';
import {WidgetFrame, WidgetHead} from "./WidgetBase";
import {IWidgetProps} from "../util/types";

export const getWindData=(props:WindProps)=>{
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
const EDITABLES={
    show360: {type: 'BOOLEAN', default: false},
    kind: {
        type: 'SELECT',
        list: ['auto', 'trueAngle', 'trueDirection', 'apparent'],
        default: 'auto',
        description: 'which wind data to be shown\nauto will try apparent, trueAngle, trueDirection and display the first found data'
    },
    formatter: true,
    formatterParameters: true
}
export const WindStoreKeys={
    windAngle: keys.nav.gps.windAngle,
    windSpeed: keys.nav.gps.windSpeed,
    windAngleTrue: keys.nav.gps.trueWindAngle,
    windSpeedTrue: keys.nav.gps.trueWindSpeed,
    windDirectionTrue: keys.nav.gps.trueWindDirection
}
export interface WindProps{
    windAngle?:  number,
    windSpeed?:  number,
    windAngleTrue?:  number,
    windSpeedTrue?:  number,
    windDirectionTrue?:  number,
    kind: string //'true'|'apparent'|'auto'
}
export interface WindWidgetProps extends IWidgetProps,
    Record<keyof typeof EDITABLES, any>
{
}

const WindWidget = (props:WindWidgetProps) => {
    const wind = getWindData(props);
    const names:Record<string,any> = {
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
    const windSpeedStr = props.formatter(wind.windSpeed);
    let show180=false;
    if (!props.show360 && wind.suffix !== 'TD') {
        show180=true;
        if (wind.windAngle > 180) wind.windAngle -= 360;
    }
    return (
        <WidgetFrame {...props} addClass="windWidget" caption={undefined} unit={undefined} resize={props.mode === 'horizontal'}>
            {(props.mode === 'horizontal') ?
                <React.Fragment>
                    <WidgetHead caption={props.caption?props.caption:'W' + wind.suffix}/>
                    <div className="widgetData">
                        {Formatter.formatDirection(wind.windAngle,undefined,show180)}
                        <span className="unit">°</span>
                        /{windSpeedStr}
                        <span className="unit">{props.unit}</span>
                    </div>
                </React.Fragment>
                :
                <React.Fragment>
                        <WidgetFrame addClass="windInner" resize={true} mode={props.mode}
                                     caption={names[wind.suffix].angle} unit='°' name={""} dragId={0}>
                            <div className='widgetData'>{Formatter.formatDirection(wind.windAngle,undefined,show180)}</div>
                        </WidgetFrame>
                        <WidgetFrame addClass="windInner" resize={true} mode={props.mode}
                                     caption={names[wind.suffix].speed} unit={props.unit} name={""} dragId={0}>
                            <div className='widgetData'>{windSpeedStr}</div>
                        </WidgetFrame>
                </React.Fragment>
            }
        </WidgetFrame>

    );
}

WindWidget.predefined= {
    storeKeys: WindStoreKeys,
    editableParameters: EDITABLES,
    formatter :'formatSpeed',
    description: 'Show wind speed and wind direction/angle numerically'
}

export default WindWidget;