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
        let windSpeed="";
        try{
            windSpeed=parseFloat(this.props.windSpeed);
            if (this.props.showKnots){
                let nm=navcompute.NM;
                windSpeed=windSpeed*3600/nm;
            }
            if (windSpeed < 10) windSpeed=Formatter.formatDecimal(windSpeed,2,1);
            else windSpeed=Formatter.formatDecimal(windSpeed,3,0);
        }catch(e){}
        return (
            <div className={classes} onClick={this.props.onClick} style={style}>
                {(this.props.mode == 'horizontal') ?
                    <React.Fragment>
                        <div className='infoLeft'>W</div>
                        <div className="widgetData">
                            {Formatter.formatDirection(this.props.windAngle)}
                            <span className="unit">°</span>
                            /{windSpeed}
                            <span className="unit">{showKnots ? "kn" : "m/s"}</span>
                        </div>
                    </React.Fragment>
                    :
                    <React.Fragment>
                        <div className="windInner">
                            <div className='widgetData'>{Formatter.formatDirection(this.props.windAngle)}</div>
                            <div className='infoLeft'>WD</div>
                            <div className='infoRight'>°</div>
                        </div>
                        <div className="windInner">
                            <div className='widgetData'>{windSpeed}</div>
                            <div className='infoLeft'>WS</div>
                            <div className='infoRight'>{this.props.showKnots ? "kn" : "m/s"}</div>
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
    windReference: PropTypes.string,
    enabled:    PropTypes.bool
};

WindWidget.storeKeys={
    windAngle: keys.nav.gps.windAngle,
    windSpeed: keys.nav.gps.windSpeed,
    windReference: keys.nav.gps.windReference,
    visible: keys.properties.showWind,
    showKnots: keys.properties.windKnots
};

module.exports=WindWidget;