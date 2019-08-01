/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';

class EmptyWidget extends React.Component{
    render(){
        let classes="avn_widget "+this.props.classes||"";
        if (this.props.className) classes+=" "+this.props.className;
        let style=this.props.style||{};
        return (
        <div className={classes} onClick={this.props.onClick} style={style}>
        </div>
        );
    }

}

EmptyWidget.propTypes={
        onClick: PropTypes.func,
        classes: PropTypes.string
};

module.exports=EmptyWidget;