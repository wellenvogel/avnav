/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import keys from '../util/keys.jsx';
import Formatter from '../util/formatter.js';
import Helper from '../util/helper.js';

let fmt=new Formatter();

class EtaWidget extends React.Component{

    shouldComponentUpdate(nextProps,nextState) {
       return Helper.compareProperties(this.props,nextProps,EtaWidget.storeKeys);
    }
    render(){
        let eta=this.props.eta?fmt.formatTime(this.props.eta):'--:--:--';
        let classes="avn_widget avn_etaWidget "+this.props.classes||""+ " "+this.props.className||"";
        return (
        <div className={classes} onClick={this.props.onClick} style={this.props.style||{}}>
            <div className='avn_widgetInfoLeft'>{this.props.caption}</div>
            <div className="avn_widgetData avn_markerEta">{eta}</div>
            <div className="avn_widgetData avn_markerName" >{this.props.wpname}</div>
        </div>
        );
    }

};

EtaWidget.propTypes={
    //formatter: React.PropTypes.func,
    onClick: PropTypes.func,
    classes: PropTypes.string,
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
module.exports=EtaWidget;