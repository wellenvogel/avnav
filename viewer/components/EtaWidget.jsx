/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import keys from '../util/keys.jsx';
import Formatter from '../util/formatter.js';
import Helper from '../util/helper.js';
import GuiHelper, {useKeyEventHandler} from '../util/GuiHelpers.js';
import {useAvNavSortable} from "../hoc/Sortable";


const EtaWidget =(props)=>{
    useKeyEventHandler(props,"widget");
    const ddProps=useAvNavSortable(props.dragId);
    let eta=props.eta?Formatter.formatTime(props.eta):'--:--:--';
    let classes="widget etaWidget "+props.className||"";
    const style={...props.style,...ddProps.style};
        return (
        <div className={classes} onClick={props.onClick} style={style}>
            <div className='infoLeft'>{props.caption}</div>
            <div className="widgetData markerEta">{eta}</div>
            <div className="widgetData markerName" >{props.wpname}</div>
        </div>
        );
    };

EtaWidget.propTypes={
    onClick: PropTypes.func,
    className: PropTypes.string,
    style: PropTypes.object,
    caption: PropTypes.string,
    eta: PropTypes.objectOf(Date),
    wpname: PropTypes.string
};
EtaWidget.storeKeys={
    eta: keys.nav.wp.eta,
    wpname: keys.nav.wp.name
};
export default EtaWidget;