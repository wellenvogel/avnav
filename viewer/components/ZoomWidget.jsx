/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import keys from '../util/keys.jsx';
import Formatter from '../util/formatter.js';
import {useKeyEventHandler} from '../util/GuiHelpers.js';
import {useAvNavSortable} from "../hoc/Sortable";
import {WidgetHead} from "./WidgetBase";

const ZoomWidget =(props)=>{
    useKeyEventHandler(props,"widget");
    const ddProps=useAvNavSortable(props.dragId);
        let classes="widget zoomWidget ";
        if (props.className) classes+=" "+props.className;
        let val=props.default||'--';
        if (props.zoom !== undefined) {
            val=Formatter.formatDecimalOpt(props.zoom, 2, 1);
        }
        let rzoom=undefined;
        if (props.requiredZoom && props.requiredZoom != props.zoom){
            rzoom=Formatter.formatDecimalOpt(props.requiredZoom,2,1);
        }
        const style={...props.style,...ddProps.style};
        return (
        <div className={classes} onClick={props.onClick} {...ddProps} style={style}>
            <WidgetHead caption={props.caption}/>
            <div className='widgetData'>{val}
                {
                    (rzoom !== undefined)?<div className="rzoom">({rzoom})</div>:''

                }
            </div>
        </div>
        );
    };

ZoomWidget.propTypes={
    name: PropTypes.string,
    caption: PropTypes.string,
    onClick: PropTypes.func,
    classes: PropTypes.string,
    style: PropTypes.object,
    zoom: PropTypes.number,
    requiredZoom: PropTypes.number,
    className: PropTypes.string,
    default: PropTypes.any,
    dragId: PropTypes.string
};

ZoomWidget.storeKeys={
    zoom: keys.map.currentZoom,
    requiredZoom: keys.map.requiredZoom,
    visible: keys.properties.showZoom
};
export default ZoomWidget;