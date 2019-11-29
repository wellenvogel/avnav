/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import keys from '../util/keys.jsx';
import compare from '../util/shallowcompare.js';
import GuiHelper from '../util/GuiHelpers.js';


class  AlarmWidget extends React.Component{
    constructor(props){
        super(props);
        this.onClick=this.onClick.bind(this);
        let self=this;
        GuiHelper.keyEventHandler(this,(component,action)=>{
            if (action == 'stop'){
                if (self.props.onClick) self.props.onClick();
            }
        },"alarm",["stop"])
    }
    componentDidMount(){

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
        let classes="widget alarmWidget "+this.props.className||"";
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
        if (! alarmText) return null;
        return (
        <div className={classes} onClick={this.onClick} style={this.props.style}>
            <div className="infoLeft">Alarm</div>
            <div>
                <span className="alarmInfo">{alarmText}</span>
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
    className: PropTypes.string,
    onClick: PropTypes.func,
    alarmInfo: PropTypes.object
};

AlarmWidget.storeKeys={
    alarmInfo: keys.nav.gps.alarms
};

module.exports=AlarmWidget;