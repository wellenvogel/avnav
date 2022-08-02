/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import Formatter from '../util/formatter';
import keys from '../util/keys.jsx';
import Helper from '../util/helper.js';
import GuiHelper from '../util/GuiHelpers.js';
import navcompute from '../nav/navcompute.js';

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

class WindWidget extends React.Component{
    constructor(props){
        super(props);
        GuiHelper.nameKeyEventHandler(this,"widget");
    }
    shouldComponentUpdate(nextProps,nextState){
        return Helper.compareProperties(this.props,nextProps,WindWidget.storeKeys);
    }
    render(){
        let wind=getWindData(this.props);
        const names={
            A :{
                speed: 'AWS',
                angle: 'AWA'
            },
            TD: {
                speed: 'TWS',
                angle: 'TWD'
            },
            TA:{
                speed: 'TWS',
                angle: 'TWA'
            }
        }
        let classes = "widget windWidget " +this.props.className||"";
        let style = this.props.style || {};
        let windSpeedStr='';
        try{
            windSpeedStr=parseFloat(wind.windSpeed);
            if (isNaN(windSpeedStr)){
                windSpeedStr="---"
            }
            else {
                if (this.props.showKnots) {
                    let nm = navcompute.NM;
                    windSpeedStr = windSpeedStr * 3600 / nm;
                }
                if (windSpeedStr < 10) windSpeedStr = Formatter.formatDecimal(windSpeedStr, 2, 1);
                else windSpeedStr = Formatter.formatDecimal(windSpeedStr, 3, 0);
            }
        }catch(e){}
        if (! this.props.show360 && wind.suffix !== 'TD'){
            if (wind.windAngle > 180) wind.windAngle-=360;
        }
        return (
            <div className={classes} onClick={this.props.onClick} style={style}>
                {(this.props.mode === 'horizontal') ?
                    <React.Fragment>
                        <div className='infoLeft'>{'W'+wind.suffix}</div>
                        <div className="widgetData">
                            {Formatter.formatDirection(wind.windAngle)}
                            <span className="unit">°</span>
                            /{windSpeedStr}
                            <span className="unit">{this.props.showKnots ? "kn" : "m/s"}</span>
                        </div>
                    </React.Fragment>
                    :
                    <React.Fragment>
                        <div className="resize">
                            <div className="windInner">
                                <div className='widgetData'>{Formatter.formatDirection(wind.windAngle)}</div>
                                <div className='infoLeft'>{names[wind.suffix].angle}</div>
                                <div className='infoRight'>°</div>
                            </div>
                            <div className="windInner">
                                <div className='widgetData'>{windSpeedStr}</div>
                                <div className='infoLeft'>{names[wind.suffix].speed}</div>
                                <div className='infoRight'>{this.props.showKnots ? "kn" : "m/s"}</div>
                            </div>
                        </div>
                    </React.Fragment>
                }
            </div>

        );

    }


}

WindWidget.propTypes={
    onClick: PropTypes.func,
    className:    PropTypes.string,
    windAngle:  PropTypes.number,
    windSpeed:  PropTypes.number,
    windAngleTrue:  PropTypes.number,
    windSpeedTrue:  PropTypes.number,
    enabled:    PropTypes.bool,
    kind: PropTypes.string //true,apparent,auto
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
WindWidget.editableParameters={
    show360: {type:'BOOLEAN',default:false},
    kind: {type:'SELECT',list:['auto','trueAngle','trueDirection','apparent'],default:'auto'}
}

export default WindWidget;