/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from "prop-types";
import keys from "../util/keys.jsx";
import Formatter from "../util/formatter.js";
import globalStore from '../util/globalstore.jsx';
import Helper from '../util/helper.js';
import GuiHelper from '../util/GuiHelpers.js';

class TimeStatusWidget extends React.Component{
    constructor(props){
        super(props);
        GuiHelper.nameKeyEventHandler(this,"widget");
    }
    shouldComponentUpdate(nextProps,nextState) {
        return Helper.compareProperties(this.props,nextProps,TimeStatusWidget.storeKeys);
    }
    render(){
        let self=this;
        let classes="widget timeStatusWidget "+this.props.className||"";
        let imgSrc=globalStore.getData(this.props.gpsValid?
            keys.properties.statusOkImage:
            keys.properties.statusErrorImage);
        let time="----";
        if (this.props.time !== undefined){
            time=Formatter.formatTime(this.props.time);
        }
        return (
        <div className={classes} onClick={this.props.onClick} style={this.props.style||{}}>
            <div className='infoLeft'>{this.props.caption}</div>
            <img className="status" src={imgSrc}/>
            <div className="widgetData">{time}</div>
        </div>
        );
    }

};

TimeStatusWidget.propTypes={
    onClick: PropTypes.func,
    className: PropTypes.string,
    time: PropTypes.objectOf(Date),
    gpsValid: PropTypes.bool
};
TimeStatusWidget.storeKeys={
    time: keys.nav.gps.rtime,
    gpsValid: keys.nav.gps.valid
};

export default TimeStatusWidget;