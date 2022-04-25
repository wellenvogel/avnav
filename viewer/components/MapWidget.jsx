/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import GuiHelper from '../util/GuiHelpers.js';
import assign from 'object-assign';



class MapWidget extends React.Component{
    constructor(props){
        super(props);
        GuiHelper.nameKeyEventHandler(this,"widget");
        this.userData={
        };
        if (typeof(this.props.initFunction) === 'function'){
            this.props.initFunction.call(this.userData,this.userData,this.props);
        }
    }
    getProps(){
        if (! this.props.translateFunction){
            return this.props;
        }
        else{
            return this.props.translateFunction(assign({},this.props));
        }
    }
    render() {
        return null;
    }
    componentWillUnmount(){
        if (typeof(this.props.finalizeFunction) === 'function'){
            this.props.finalizeFunction.call(this.userData,this.userData,this.getProps());
        }
    }
};

MapWidget.propTypes={
    name: PropTypes.string,
    unit: PropTypes.string,
    caption: PropTypes.string,
    onClick: PropTypes.func,
    className: PropTypes.string,
    style: PropTypes.object,
    default: PropTypes.string,
    renderHtml: PropTypes.func,
    renderCanvas: PropTypes.func,
    initFunction: PropTypes.func,
    finalizeFunction: PropTypes.func,
    translateFunction: PropTypes.func
};
MapWidget.editableParameters={
    caption:false,
    unit:false
};

export default MapWidget;