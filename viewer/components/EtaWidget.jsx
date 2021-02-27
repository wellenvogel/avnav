/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import keys from '../util/keys.jsx';
import Formatter from '../util/formatter.js';
import Helper from '../util/helper.js';
import GuiHelper from '../util/GuiHelpers.js';


class EtaWidget extends React.Component{

    constructor(props){
        super(props);
        GuiHelper.nameKeyEventHandler(this,"widget");
    }

    shouldComponentUpdate(nextProps,nextState) {
       return Helper.compareProperties(this.props,nextProps,EtaWidget.storeKeys);
    }
    render(){
        let eta=this.props.eta?Formatter.formatTime(this.props.eta):'--:--:--';
        let classes="widget etaWidget "+this.props.className||"";
        return (
        <div className={classes} onClick={this.props.onClick} style={this.props.style||{}}>
            <div className='infoLeft'>{this.props.caption}</div>
            <div className="widgetData markerEta">{eta}</div>
            <div className="widgetData markerName" >{this.props.wpname}</div>
        </div>
        );
    }

};

EtaWidget.propTypes={
    onClick: PropTypes.func,
    className: PropTypes.string,
    style: PropTypes.object,
    caption: PropTypes.string,
    eta: PropTypes.objectOf(Date),
    wpname: PropTypes.string
};
EtaWidget.storeKeys={
    eta: keys.nav.wp.eta,
    wpname: keys.nav.wp.name
};
export default EtaWidget;