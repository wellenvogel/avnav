/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import Helper from '../util/helper.js';
import Value from './Value.jsx';
import GuiHelper from '../util/GuiHelpers.js';
import {useAvNavSortable} from "../hoc/Sortable";

const RenderFunction=(props)=>{
    const sortableProps=useAvNavSortable(props.dragId)
    let classes="widget ";
    if (props.isAverage) classes+=" average";
    if (props.className) classes+=" "+props.className;
    let val;
    let vdef=props.default||'0';
    if (props.value !== undefined) {
        val=props.formatter?props.formatter(props.value):vdef+"";
    }
    else{
        if (! isNaN(vdef) && props.formatter) val=props.formatter(vdef);
        else val=vdef+"";
    }
    const style={...props.style,...sortableProps.style};
    return (
        <div className={classes} onClick={props.onClick} {...sortableProps} style={style}>
            <div className="resize">
                <div className='widgetData'>
                    <Value value={val}/>
                </div>
            </div>
            <div className='infoLeft'>{props.caption}</div>
            {props.unit !== undefined?
                <div className='infoRight'>{props.unit}</div>
                :<div className='infoRight'></div>
            }
        </div>
    );
}

class DirectWidget extends React.Component{
    constructor(props){
        super(props);
        GuiHelper.nameKeyEventHandler(this,"widget");
        this.getProps=this.getProps.bind(this);
    }
    shouldComponentUpdate(nextProps,nextState) {
        return Helper.compareProperties(this.getProps(this.props),
            this.getProps(nextProps),{value:1,isAverage:1});
    }
    getProps(props){
        if (! this.props.translateFunction){
            return props;
        }
        else{
            return this.props.translateFunction({...props});
        }
    }
    render() {
        let props = this.getProps(this.props);
        return <RenderFunction {...props}/>;
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
    default: PropTypes.string,
    translateFunction: PropTypes.func,
    dragId: PropTypes.string
};

DirectWidget.editableParameters={
    caption:true,
    unit:true,
    formatter:true,
    formatterParameters: true,
    value: true
};

export default DirectWidget;