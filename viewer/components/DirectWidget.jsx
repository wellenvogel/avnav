/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import Helper from '../util/helper.js';
import Value from './Value.jsx';
import GuiHelper from '../util/GuiHelpers.js';

class DirectWidget extends React.Component{
    constructor(props){
        super(props);
        GuiHelper.nameKeyEventHandler(this,"widget")
    }
    shouldComponentUpdate(nextProps,nextState) {
        return Helper.compareProperties(this.props,nextProps,{value:1,isAverage:1});
    }
    render(){
        let classes="widget ";
        if (this.props.isAverage) classes+=" average";
        if (this.props.className) classes+=" "+this.props.className;
        let val;
        let vdef=this.props.default||'0';
        if (this.props.value !== undefined) {
            val=this.props.formatter?this.props.formatter(this.props.value):vdef+"";
        }
        else{
            if (! isNaN(vdef) && this.props.formatter) val=this.props.formatter(vdef);
            else val=vdef+"";
        }
        let style=this.props.style||{};

        return (
        <div className={classes} onClick={this.props.onClick} style={style}>
            <div className="resize">
            <div className='widgetData'>
                <Value value={val}/>
            </div>
            </div>
            <div className='infoLeft'>{this.props.caption}</div>
            {this.props.unit !== undefined?
                <div className='infoRight'>{this.props.unit}</div>
                :<div className='infoRight'></div>
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
    className: PropTypes.string,
    style: PropTypes.object,
    default: PropTypes.string
};

DirectWidget.editableParameters={
    caption:true,
    unit:true,
    formatter:true,
    formatterParameters: true,
    value: true
};

export default DirectWidget;