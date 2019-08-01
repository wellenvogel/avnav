/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import keys from '../util/keys.jsx';
import compare from '../util/shallowcompare.js';


class  AlarmWidget extends React.Component{
    constructor(props){
        super(props);
        this.onClick=this.onClick.bind(this);
    }
    shouldComponentUpdate(nextProps,nextState){
        if (nextProps.alarmInfo === this.props.alarmInfo ) return false;
        if (! nextProps.alarmInfo !== ! this.props.alarmInfo) return true;
        for (let k in this.props.alarmInfo){
            if (! compare(this.props.alarmInfo[k],nextProps.alarmInfo[k])) return true;
        }
        for (let k in nextProps.alarmInfo){
            if (! compare(this.props.alarmInfo[k],nextProps.alarmInfo[k])) return true;
        }
        return false;
    }
    render(){
        let classes="avn_widget avn_alarmWidget "+this.props.classes||""+ " "+this.props.className||"";
        let alarmText=undefined;
        if (this.props.alarmInfo){
            for (let k in this.props.alarmInfo){
                if (alarmText){
                    alarmText+=","+k;
                }
                else {
                    alarmText=k;
                }
            }
        }
        if (! alarmText) return <div/>;
        return (
        <div className={classes} onClick={this.onClick} style={this.props.style}>
            <div className="avn_widgetInfoLeft">Alarm</div>
            <div>
                <span className="avn_alarmInfo">{alarmText}</span>
            </div>
        </div>
        );
    }
    onClick(ev){
        if (this.props.onClick){
            this.props.onClick();
        }
        ev.stopPropagation();
    }

}

AlarmWidget.propTypes={
    classes: PropTypes.string,
    onClick: PropTypes.func,
    alarmInfo: PropTypes.object
};

AlarmWidget.storeKeys={
    alarmInfo: keys.nav.gps.alarms
};

module.exports=AlarmWidget;