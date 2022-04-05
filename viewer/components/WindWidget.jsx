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

class WindWidget extends React.Component{
    constructor(props){
        super(props);
        GuiHelper.nameKeyEventHandler(this,"widget");
    }
    shouldComponentUpdate(nextProps,nextState){
        return Helper.compareProperties(this.props,nextProps,WindWidget.storeKeys);
    }
    render(){
        let classes = "widget windWidget " +this.props.className||"";
        let style = this.props.style || {};
        let kind = this.props.kind;
        let windSpeed;
        let windAngle;
        let suffix='';
        if (kind !== 'true' && kind !== 'apparent') kind='auto';
        if (kind === 'auto'){
            if (this.props.windAngle !== undefined && this.props.windSpeed !== undefined){
                windAngle=this.props.windAngle;
                windSpeed=this.props.windSpeed;
                suffix='A';
            }
            else{
                windAngle=this.props.windAngleTrue;
                windSpeed=this.props.windSpeedTrue;
                suffix="T";
            }
        }
        if (kind === 'apparent'){
            windAngle=this.props.windAngle;
            windSpeed=this.props.windSpeed;
            suffix='A';
        }
        if (kind === 'true'){
            windAngle=this.props.windAngleTrue;
            windSpeed=this.props.windSpeedTrue;
            suffix="T";
        }
        let windSpeedStr='';
        try{
            windSpeedStr=parseFloat(windSpeed);
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
        if (! this.props.show360 && suffix !== 'T'){
            if (windAngle > 180) windAngle-=360;
        }
        return (
            <div className={classes} onClick={this.props.onClick} style={style}>
                {(this.props.mode === 'horizontal') ?
                    <React.Fragment>
                        <div className='infoLeft'>{'W'+suffix}</div>
                        <div className="widgetData">
                            {Formatter.formatDirection(windAngle)}
                            <span className="unit">°</span>
                            /{windSpeedStr}
                            <span className="unit">{this.props.showKnots ? "kn" : "m/s"}</span>
                        </div>
                    </React.Fragment>
                    :
                    <React.Fragment>
                        <div className="resize">
                            <div className="windInner">
                                <div className='widgetData'>{Formatter.formatDirection(windAngle)}</div>
                                <div className='infoLeft'>{'WD'+suffix}</div>
                                <div className='infoRight'>°</div>
                            </div>
                            <div className="windInner">
                                <div className='widgetData'>{windSpeedStr}</div>
                                <div className='infoLeft'>{'WS'+suffix}</div>
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
    visible: keys.properties.showWind,
    showKnots: keys.properties.windKnots
};
WindWidget.editableParameters={
    show360: {type:'BOOLEAN',default:false},
    kind: {type:'SELECT',list:['auto','true','apparent'],default:'auto'}
}

export default WindWidget;