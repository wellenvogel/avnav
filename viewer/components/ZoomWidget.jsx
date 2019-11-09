/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import keys from '../util/keys.jsx';
import Formatter from '../util/formatter.js';

class ZoomWidget extends React.Component{
    shouldComponentUpdate(nextProps,nextState) {
        if (this.props.zoom != nextProps.zoom || this.props.requiredZoom != nextProps.requiredZoom) return true;
        return false;
    }
    render(){
        let classes="avn_widget avn_zoomWidget "+this.props.classes||"";
        if (this.props.className) classes+=" "+this.props.className;
        let style=this.props.style||{};
        let val=this.props.default||'--';
        if (this.props.zoom !== undefined) {
            val=Formatter.formatDecimalOpt(this.props.zoom, 2, 1);
        }
        let rzoom=undefined;
        if (this.props.requiredZoom && this.props.requiredZoom != this.props.zoom){
            rzoom=Formatter.formatDecimalOpt(this.props.requiredZoom,2,1);
        }
        return (
        <div className={classes} onClick={this.props.onClick} style={style}>
            <div className='avn_widgetData'>{val}
                {
                    (rzoom !== undefined)?<div className="avn_rzoom">({rzoom})</div>:''

                }
            </div>
            <div className='avn_widgetInfoLeft'>{this.props.caption}</div>
        </div>
        );
    }
};

ZoomWidget.propTypes={
    name: PropTypes.string,
    caption: PropTypes.string,
    onClick: PropTypes.func,
    classes: PropTypes.string,
    style: PropTypes.object,
    zoom: PropTypes.number,
    requiredZoom: PropTypes.number
};

ZoomWidget.storeKeys={
    zoom: keys.gui.navpage.zoom,
    requiredZoom: keys.gui.navpage.requiredZoom
};
module.exports=ZoomWidget;