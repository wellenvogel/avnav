/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import Formatter from '../util/formatter';
import keys from '../util/keys.jsx';
import PropertyHandler from '../util/propertyhandler.js';
import Helper from '../util/helper.js';

class WindWidget extends React.Component{
    shouldComponentUpdate(nextProps,nextState){
        return Helper.compareProperties(this.props,nextProps,WindWidget.storeKeys);
    }
    render(){
        let classes = "avn_widget avn_windWidget " + this.props.classes || ""+ " "+this.props.className||"";
        let style = this.props.style || {};
        let windSpeed="";
        let showKnots=PropertyHandler.getProperties().windKnots;
        try{
            windSpeed=parseFloat(this.props.windSpeed);
            if (showKnots){
                let nm=PropertyHandler.getProperties().NM;
                windSpeed=windSpeed*3600/nm;
            }
            if (windSpeed < 10) windSpeed=Formatter.formatDecimal(windSpeed,1,2);
            else windSpeed=Formatter.formatDecimal(windSpeed,3,0);
        }catch(e){}
        return (
            <div className={classes} onClick={this.props.onClick} style={style}>
                <div className="avn_windInner">
                    <div className='avn_widgetData'>{Formatter.formatDecimal(this.props.windAngle,3,0)}</div>
                    <div className='avn_widgetInfoLeft'>WD</div>
                    <div className='avn_widgetInfoRight'>°</div>
                </div>
                <div className="avn_windInner">
                    <div className='avn_widgetData'>{windSpeed}</div>
                    <div className='avn_widgetInfoLeft'>WS</div>
                    <div className='avn_widgetInfoRight'>{showKnots?"kn":"m/s"}</div>
                </div>
            </div>

        );

    }


}

WindWidget.propTypes={
    onClick: PropTypes.func,
    classes:    PropTypes.string,
    windAngle:  PropTypes.number,
    windSpeed:  PropTypes.number,
    windReference: PropTypes.string
};

WindWidget.storeKeys={
    windAngle: keys.nav.gps.windAngle,
    windSpeed: keys.nav.gps.windSpeed,
    windReference: keys.nav.gps.windReference,
    visible: keys.properties.showWind
};

module.exports=WindWidget;