/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import keys from '../util/keys.jsx';
import {useKeyEventHandler} from '../util/GuiHelpers.js';
import AlarmHandler from '../nav/alarmhandler.js';
import {useAvNavSortable} from "../hoc/Sortable";


//TODO: compare alarm info correctly
const AlarmWidget=(props)=>{
    useKeyEventHandler({name:'stop'},"alarm",()=>{
        if (props.onClick) props.onClick();
    })
    const onClick=(ev)=>{
        if (props.onClick){
            props.onClick(ev);
        }
        ev.stopPropagation();
    }
    const ddProps=useAvNavSortable(props.dragId);
        if (props.disabled) return null;
        let classes="widget alarmWidget "+props.className||"";
        let alarmText=undefined;
        if (props.alarmInfo){
            let list=AlarmHandler.sortedActiveAlarms(props.alarmInfo)
            list.forEach((al)=>{
                if (alarmText){
                    alarmText+=","+al.name;
                }
                else {
                    alarmText=al.name;
                }
            })
        }
        const style={...props.style,...ddProps.style};
        if (! alarmText) {
            if (! props.isEditing || ! props.mode) return null;
            return <div className={classes} onClick={onClick} {...ddProps} style={style}>
                <div className="infoLeft">Alarm</div>
                </div>;
        }
        return (
        <div className={classes} onClick={onClick} {...ddProps} style={style}>
            <div className="infoLeft">Alarm</div>
            <div>
                <span className="alarmInfo">{alarmText}</span>
            </div>
        </div>
        );
    }


AlarmWidget.propTypes={
    className: PropTypes.string,
    onClick: PropTypes.func,
    alarmInfo: PropTypes.object,
    isEditing: PropTypes.bool,
    style: PropTypes.object,
    dragId: PropTypes.string,
    disabled: PropTypes.bool,
    mode: PropTypes.string
};

AlarmWidget.storeKeys={
    alarmInfo: keys.nav.alarms.all,
    isEditing: keys.gui.global.layoutEditing,
    disabled: keys.gui.global.preventAlarms
};

export default AlarmWidget;