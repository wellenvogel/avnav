/**
 * Created by andreas on 24.11.16.
 * 
 */

import React from 'react';
import PropTypes from 'prop-types';
import navobjects from '../nav/navobjects';
import assign from 'object-assign';
import DB from './DialogButton.jsx';
import {Checkbox, Input} from './Inputs.jsx';
import Dms from "geodesy/dms";

const strLonToLon=(val)=>{
    if (val === undefined) return;
    if (typeof(val) === 'string') return Dms.parse(val.replace(/o/i, 'e'))
    return Dms.parse(val);
}
const strLatToLat=(val)=>{
    if (val === undefined) return;
    return Dms.parse(val);
}
const lonCheck=(val)=>{
    let dv=(typeof(val) === "string" )?strLonToLon(val):val;
    return (-180<= dv && dv <= 180) ;
}
const latCheck=(val)=>{
    let dv=(typeof(val) === "string" )?strLatToLat(val):val;
    return (-90 <= dv && dv <= 90);
}
const formatLon=(val,keep)=>{
    if (val === undefined) return "";
    if (keep) return val.toFixed(8);
    return  Dms.toLon(val, 'dm', 4);
}
const formatLat=(val,keep)=>{
    if (val === undefined) return "";
    if (keep) return val.toFixed(8);
    return Dms.toLat(val, 'dm', 4);
}
/**
 * a waypoint dialog
 * property: waypoint: the waypoint to be edited
 *           okCallback: function to be called ok ok with the new waypoint as parameter, return true to close
 *           hideCallback: function to be called when the dialog is hidden (but not on unmount)
 */
class WaypointDialog extends React.Component{
    constructor(props) {
        super(props);
        this.state={
            name: this.props.waypoint.name,
            lat: formatLat(this.props.waypoint.lat),
            lon: formatLon(this.props.waypoint.lon),
            show: true,
            decimal: false
        };
        this.okFunction=this.okFunction.bind(this);
        this.cancelFunction=this.cancelFunction.bind(this);
    }
    valueChanged(name, value) {
        let nState = {};
        nState[name] = value;
        this.setState(nState);
    }
    closeFunction() {
        this.setState({show: false});
        if (this.props.closeCallback) this.props.closeCallback();
    }
    okFunction(event) {
        let data = {
            name: this.state.name,
            lat: strLatToLat(this.state.lat),
            lon: strLonToLon(this.state.lon)
        };
        if (!lonCheck(data.lon) || !latCheck(data.lat)) {
            return;
        }
        let wp = this.props.waypoint.clone();
        assign(wp, data);
        let rt = this.props.okCallback(wp, this.closeFunction);
        if (rt) {
            this.closeFunction();
        }
    }
    cancelFunction(event) {
        this.closeFunction();
    }
    render() {
        if (!this.state.show) return null;
        let ok = lonCheck(this.state.lon) && latCheck(this.state.lat);
        return (
            <div className="inner">
                <h3>Edit Waypoint</h3>
                <div>
                    <Input
                        dialogRow={true}
                        label="Name"
                        value={this.state.name}
                        onChange={(value) => this.valueChanged('name', value)}/>
                    <Input
                        dialogRow={true}
                        label="Lat"
                        onChange={(value) => {
                            this.valueChanged('lat', value)
                        }}
                        value={this.state.lat}
                        checkFunction={latCheck}
                    />
                    <Input
                        dialogRow={true}
                        label="Lon"
                        onChange={(value) => this.valueChanged('lon', value)}
                        value={this.state.lon}
                        checkFunction={lonCheck}
                    />
                    <Checkbox
                        dialogRow={true}
                        label={"decimal"}
                        onChange={(value) => this.setState((oldState)=>{
                            if (oldState.decimal === value) return null;
                            if (value){
                                return {
                                    lat:strLatToLat(oldState.lat),
                                    lon:strLonToLon(oldState.lon),
                                    decimal:value
                                };
                            }
                            else{
                                return{
                                    lat:formatLat(oldState.lat),
                                    lon:formatLon(oldState.lon),
                                    decimal:value
                                }
                            }
                        })}
                        value={this.state.decimal || false}
                    />
                </div>
                <div className="dialogButtons">
                    <DB name="cancel" tabIndex="3" onClick={this.cancelFunction}>Cancel</DB>
                    <DB name="ok" tabIndex="4" onClick={this.okFunction} disabled={!ok}>Ok</DB>
                </div>
            </div>
        );
    }
    static updateWaypoint(oldWp, newWp, errorFunction) {
            let wp = oldWp.clone();
            let data = newWp;
            if (!data) return;
            wp.name = data.name;
            let doChange = true;
            try {
                wp.lon = data.lon;
                if (isNaN(wp.lon) || wp.lon === undefined) {
                    if (errorFunction) errorFunction("invalid lon, cannot convert ");
                    doChange = false;
                }
                wp.lat = data.lat;
                if (isNaN(wp.lat) || wp.lat === undefined) {
                    if (errorFunction) errorFunction("invalid lat, cannot convert ");
                    doChange = false;
                }
            } catch (e) {
                if (errorFunction) errorFunction("invalid coordinate, cannot convert");
                doChange = false;
            }
            let ok = false;
            if (wp.routeName && wp.routeName != oldWp.routeName) {
                if (errorFunction) errorFunction("internal error, route name changed");
                doChange = false;
            }
            if (wp.name == navobjects.WayPoint.MOB) {
                doChange = false;
                if (errorFunction) errorFunction("you cannot use this name");
            }
            if (!doChange) return;
            return wp;
        }
}

WaypointDialog.propTypes={
    waypoint: PropTypes.instanceOf(navobjects.WayPoint).isRequired,
    okCallback: PropTypes.func.isRequired,
    closeCallback:PropTypes.func

};

export default WaypointDialog;