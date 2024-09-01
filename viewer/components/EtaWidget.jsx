/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import keys from '../util/keys.jsx';
import Formatter from '../util/formatter.js';
import {useKeyEventHandler} from '../util/GuiHelpers.js';
import {SortableProps, useAvNavSortable} from "../hoc/Sortable";
import {WidgetHead, WidgetProps} from "./WidgetBase";


const EtaWidget =(props)=>{
    useKeyEventHandler(props,"widget");
    const ddProps=useAvNavSortable(props.dragId);
    let eta=props.eta?Formatter.formatTime(props.eta):'--:--:--';
    let classes="widget etaWidget "+props.className||"";
    const style={...props.style,...ddProps.style};
        return (
        <div className={classes} {...ddProps} onClick={props.onClick}  style={style}>
            <WidgetHead caption={props.caption}/>
            <div className="resize">
                <div className="widgetData markerEta">{eta}</div>
                <div className="widgetData markerName" >{props.wpname}</div>
            </div>
        </div>
        );
    };

EtaWidget.propTypes={
    ...SortableProps,
    ...WidgetProps,
    eta: PropTypes.objectOf(Date),
    wpname: PropTypes.string
};
EtaWidget.storeKeys={
    eta: keys.nav.wp.eta,
    wpname: keys.nav.wp.name
};
export default EtaWidget;