/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import keys from '../util/keys.jsx';
import PropertyHandler from '../util/propertyhandler.js';
import AisFormatter from '../nav/aisformatter.jsx';
import {WidgetFrame, WidgetProps} from "./WidgetBase";
import {useStringsChanged} from "../hoc/Resizable";


const AisTargetWidget = (props) => {
    const click = (ev) => {
        if (ev.stopPropagation) ev.stopPropagation();
        props.onClick({...props, mmsi: props.target ? props.target.mmsi : undefined});
    }
    let target = props.target || {};
    let small = (props.mode === "horizontal");
    let color = undefined;
    if (target.mmsi && target.mmsi !== "") {
        color = PropertyHandler.getAisColor(target);
    }
    let front = AisFormatter.format('passFront', target);
    let display={};
    display.name=AisFormatter.format('nameOrmmsi', target);
    if (target.tcpa > 0) {
        display.cpa=AisFormatter.format('cpa', target);
        display.tcpa=AisFormatter.format('tcpa', target);
    }
    else{
        display.headingTo=AisFormatter.format('headingTo', target);
    }
    const dashMode=props.mode === "gps";
    const resizeSequence=useStringsChanged(display,dashMode);
    if (target.mmsi !== undefined || props.mode === "gps" || props.isEditing) {
        const style = {...props.style, backgroundColor: color};
        return (
            <WidgetFrame {...props}
                         addClass="aisTargetWidget"
                         resizeSequence={resizeSequence}
                         style={style}
                         onClick={click}
                         unit={undefined}
                         caption='AIS' >
                <div className="aisPart">
                    {!small &&
                    <div className="widgetData">
                        <span className="aisData">{display.name}</span>
                    </div>}
                    <div className="widgetData">
                        <span className='label'>{AisFormatter.getHeadline('distance')} </span>
                        <span className="aisData">{AisFormatter.format('distance', target)}</span>
                        <span className="unit">{AisFormatter.getUnit('distance')}</span>
                    </div>
                </div>
                {target.tcpa>0 &&
                <div className="aisPart">
                    <div className="widgetData">
                        <span className='label'>{AisFormatter.getHeadline('cpa')} </span>
                        <span className="aisData">{display.cpa}</span>
                        <span className="unit">{AisFormatter.getUnit('cpa')}</span>
                    </div>
                    <div className="widgetData">
                        <span className='label'>{AisFormatter.getHeadline('tcpa')} </span>
                        <span className="aisData"> {display.tcpa}</span>
                        <span className="unit">{AisFormatter.getUnit('tcpa')}</span>
                    </div>
                </div>}
                {!(target.tcpa>0) &&
                <div className="aisPart">
                    <div className="widgetData">
                        <span className='label'>{AisFormatter.getHeadline('headingTo')} </span>
                        <span className="aisData">{display.headingTo}</span>
                        <span className="unit">{AisFormatter.getUnit('headingTo')}</span>
                    </div>
                </div>}
                <div className="aisPart">
                    <div className="widgetData">
                        <span className='aisFront aisData'>{front}</span>
                    </div>
                </div>
            </WidgetFrame>
        );
    } else {
        return null;
    }

}

AisTargetWidget.storeKeys = {
    target: keys.nav.ais.nearest,
    isEditing: keys.gui.global.layoutEditing,
    trackedMmsi: keys.nav.ais.trackedMmsi
};

AisTargetWidget.propTypes = {
    ...WidgetProps,
    isEditing: PropTypes.bool,
    target: PropTypes.object,
    trackedMmsi: PropTypes.string
};

export default AisTargetWidget;
