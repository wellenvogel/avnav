/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import Helper from '../util/helper.js';
import Value from './Value.jsx';

class DirectWidget extends React.Component{
    shouldComponentUpdate(nextProps,nextState) {
        return Helper.compareProperties(this.props,nextProps,{value:1,isAverage:1});
    }
    render(){
        let classes="avn_widget "+this.props.classes||"";
        if (this.props.isAverage) classes+=" avn_average";
        if (this.props.className) classes+=" "+this.props.className;
        let val;
        if (this.props.value !== undefined) val=this.props.formatter(this.props.value);
        else val=this.props.default||'0';
        let style=this.props.style||{};

        return (
        <div className={classes} onClick={this.props.onClick} style={style}>
            <div className="resize">
            <div className='avn_widgetData'>
                <Value value={val}/>
            </div>
            </div>
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
    formatter: PropTypes.func.isRequired,
    onClick: PropTypes.func,
    classes: PropTypes.string,
    style: PropTypes.object,
    default: PropTypes.string
};

module.exports=DirectWidget;