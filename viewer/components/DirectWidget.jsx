/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import Helper from '../util/helper.js';

class DirectWidget extends React.Component{
    shouldComponentUpdate(nextProps,nextState) {
        return Helper.compareProperties(this.props,nextProps,{value:1,isAverage:1});
    }
    render(){
        var self=this;
        var classes="avn_widget "+this.props.classes||"";
        if (this.props.isAverage) classes+=" avn_average";
        if (this.props.className) classes+=" "+this.props.className;
        var val;
        if (this.props.value !== undefined) val=this.props.formatter(this.props.value);
        else val=this.props.default||'0';
        var style=this.props.style||{};
        return (
        <div className={classes} onClick={this.props.onClick} style={style}>
            <div className='avn_widgetData'>{val}</div>
            <div className='avn_widgetInfoLeft'>{this.props.caption}</div>
            {this.props.unit !== undefined?
                <div className='avn_widgetInfoRight'>{this.props.unit}</div>
                :<div className='avn_widgetInfoRight'></div>
            }
        </div>
        );
    }
};

DirectWidget.propTypes={
    name: PropTypes.string,
    unit: PropTypes.string,
    caption: PropTypes.string,
    value: PropTypes.any,
    isAverage: PropTypes.bool,
    formatter: PropTypes.func.required,
    onClick: PropTypes.func,
    classes: PropTypes.string,
    style: PropTypes.object,
    default: PropTypes.string
};

module.exports=DirectWidget;