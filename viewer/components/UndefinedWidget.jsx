/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import Helper from '../util/helper.js';
import GuiHelper from '../util/GuiHelpers.js';

class UndefinedWidget extends React.Component{
    constructor(props){
        super(props);
        GuiHelper.nameKeyEventHandler(this,"widget")
    }
    shouldComponentUpdate(nextProps,nextState) {
        return false;
    }
    render(){
        let classes="widget undefinedWidget";
        return (
        <div className={classes} onClick={this.props.onClick} style={this.props.style}>
            <div className="resize">
            <div className='widgetData'>
                {this.props.name}
            </div>
            </div>
            <div className='infoLeft'>Undefined Widget</div>
        </div>
        );
    }
}

UndefinedWidget.propTypes={
};


export default UndefinedWidget;