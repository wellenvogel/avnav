/**
 * Created by andreas on 24.11.16.
 * 
 */

import React from 'react';
import reactCreateClass from 'create-react-class';
import PropTypes from 'prop-types';
import navobjects from '../nav/navobjects';
import assign from 'object-assign';
import DB from './DialogButton.jsx';
import {Input} from './Inputs.jsx';

/**
 * a waypoint dialog
 * property: waypoint: the waypoint to be edited
 *           okCallback: function to be called ok ok with the new waypoint as parameter, return true to close
 *           hideCallback: function to be called when the dialog is hidden (but not on unmount)
 */
let WaypointDialog = reactCreateClass({
    propTypes: {
        waypoint: PropTypes.instanceOf(navobjects.WayPoint).isRequired,
        okCallback: PropTypes.func.isRequired,
        closeCallback:PropTypes.func

    },
    getInitialState: function () {
        return {
            name: this.props.waypoint.name,
            lat: Geo.toLat(this.props.waypoint.lat, 'dm', 4),
            lon: Geo.toLon(this.props.waypoint.lon, 'dm', 4),
            show: true
        };
    },
    valueChanged: function (name,value) {
        let nState = {};
        nState[name] = event.target.value;
        this.setState(nState);
    },
    closeFunction: function(){
        this.setState({show: false});
        if (this.props.closeCallback) this.props.closeCallback();
    },
    okFunction: function (event) {
        let data = {
            name: this.state.name,
            lat: Geo.parseDMS(this.state.lat),
            lon: Geo.parseDMS(this.state.lon.replace(/o/i, 'e'))
        };
        if (data.lat < -180 || data.lat > 180) delete data.lat;
        if (data.lon < -90 || data.lon > 90) delete data.lon;
        let wp = this.props.waypoint.clone();
        assign(wp,data);
        let rt = this.props.okCallback(wp,this.closeFunction);
        if (rt ) {
            this.closeFunction();
        }
    },
    cancelFunction: function (event) {
        this.closeFunction();
    },
    render: function () {
        if (!this.state.show) return null;
        let html = (
            <div className="inner">
                <h3>Edit Waypoint</h3>
                <div>
                    <div className="dialogRow">
                        <Input
                            label="Name"
                            value={this.state.name}
                            onChange={(value)=>this.valueChanged('name',value)}/>
                    </div>
                    <div className="dialogRow">
                        <Input
                            label="Lon"
                            onChange={(value)=>this.valueChanged('lon',value)}
                            value={this.state.lon}/>
                    </div>
                    <div className="dialogRow">
                        <Input
                         label="Lat"
                         onChange={(value)=>this.valueChanged('lat',value)}
                         value={this.state.lat}/>
                    </div>
                </div>
                <div className="dialogButtons">
                    <DB name="cancel" tabIndex="3" onClick={this.cancelFunction}>Cancel</DB>
                    <DB name="ok" tabIndex="4" onClick={this.okFunction}>Ok</DB>
                </div>
            </div>
        );
        return html;
    },
    statics: {
        updateWaypoint: function (oldWp, newWp,errorFunction) {
            let wp = oldWp.clone();
            let data = newWp;
            if (!data) return;
            wp.name = data.name;
            let doChange = true;
            try {
                wp.lon = data.lon;
                if (isNaN(wp.lon) || wp.lon === undefined) {
                    if (errorFunction)errorFunction("invalid lon, cannot convert ");
                    doChange = false;
                }
                wp.lat = data.lat;
                if (isNaN(wp.lat) || wp.lat === undefined) {
                    if (errorFunction)errorFunction("invalid lat, cannot convert ");
                    doChange = false;
                }
            } catch (e) {
                if (errorFunction)errorFunction("invalid coordinate, cannot convert");
                doChange = false;
            }
            let ok = false;
            if (wp.routeName && wp.routeName != oldWp.routeName) {
                if (errorFunction)errorFunction("internal error, route name changed");
                doChange = false;
            }
            if (wp.name == navobjects.WayPoint.MOB){
                doChange=false;
                if (errorFunction) errorFunction("you cannot use this name");
            }
            if (!doChange) return;
            return wp;
        }
    }
});


export default WaypointDialog;