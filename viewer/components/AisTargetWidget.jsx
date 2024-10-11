/**
 * Created by andreas on 23.02.16.
 */

import  React from "react";
import PropTypes from 'prop-types';
import keys from '../util/keys.jsx';
import PropertyHandler from '../util/propertyhandler.js';
import AisFormatter from '../nav/aisformatter.jsx';
import {WidgetFrame, WidgetProps} from "./WidgetBase";


const AisTargetWidget = (props) => {
    const click = (ev) => {
        if (ev.stopPropagation) ev.stopPropagation();
        props.onClick({...props, mmsi: props.current ? props.current.mmsi : undefined});
    }
    let current = props.current || {};
    let small = (props.mode === "horizontal");
    let aisProperties = {};
    let color = undefined;
    if (current.mmsi && current.mmsi !== "") {
        aisProperties.warning = current.warning || false;
        aisProperties.nearest = current.nearest || false;
        aisProperties.tracking = (current.mmsi === props.trackedMmsi);
        color = PropertyHandler.getAisColor(aisProperties);
    }
    let front = AisFormatter.format('passFront', current);
    if (current.mmsi !== undefined || props.mode === "gps" || props.isEditing) {
        const style = {...props.style, backgroundColor: color};
        return (
            <WidgetFrame {...props} addClass="aisTargetWidget" style={style}
                 onClick={click} unit={undefined} caption='AIS'
            >
                <div className="aisPart">
                    {!small && <div className="widgetData">
                        <span className='label '>D</span>
                        <span className="aisData">{AisFormatter.format('distance', current)}</span>
                        <span className="unit">nm</span>
                    </div>}
                    {!small && <div className="widgetData">
                        <span className='label '>C</span>
                        <span className="aisData">{AisFormatter.format('cpa', current)}</span>
                        <span className="unit">nm</span>
                    </div>}
                </div>
                <div className="aisPart">
                    {current.mmsi !== undefined &&
                        <div className="widgetData">
                            <span className='label '>T</span>
                            <span className="aisData">{AisFormatter.format('tcpa', current)}</span>
                            <span className="unit">h</span>
                        </div>
                    }
                    {current.mmsi !== undefined &&
                        <div className="widgetData">
                            <span className='aisFront aisData'>{front}</span>
                        </div>
                    }
                </div>
            </WidgetFrame>
        );
    } else {
        return null;
    }

}

AisTargetWidget.storeKeys = {
    current: keys.nav.ais.nearest,
    isEditing: keys.gui.global.layoutEditing,
    trackedMmsi: keys.nav.ais.trackedMmsi
};

AisTargetWidget.propTypes = {
    ...WidgetProps,
    isEditing: PropTypes.bool,
    current: PropTypes.object,
    trackedMmsi: PropTypes.string
};

export default AisTargetWidget;