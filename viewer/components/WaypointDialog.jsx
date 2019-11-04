/**
 * Created by andreas on 24.11.16.
 * 
 */

var React=require('react');
var reactCreateClass=require('create-react-class');
var PropTypes=require('prop-types');
var navobjects=require('../nav/navobjects');

/**
 * a waypoint dialog
 * property: waypoint: the waypoint to be edited
 *           okCallback: function to be called ok ok with the new waypoint as parameter, return true to close
 *           hideCallback: function to be called when the dialog is hidden (but not on unmount)
 */
var WaypointDialog = reactCreateClass({
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
    valueChanged: function (event) {
        var name = event.target.name;
        var nState = {};
        nState[name] = event.target.value;
        this.setState(nState);
    },
    closeFunction: function(){
        this.setState({show: false});
        if (this.props.closeCallback) this.props.closeCallback();
    },
    okFunction: function (event) {
        var data = {
            name: this.state.name,
            lat: Geo.parseDMS(this.state.lat),
            lon: Geo.parseDMS(this.state.lon.replace(/o/i, 'e'))
        };
        if (data.lat < -180 || data.lat > 180) delete data.lat;
        if (data.lon < -90 || data.lon > 90) delete data.lon;
        var wp = this.props.waypoint.clone();
        avnav.assign(wp,data);
        var rt = this.props.okCallback(wp,this.closeFunction);
        if (rt ) {
            this.closeFunction();
        }
    },
    cancelFunction: function (event) {
        this.closeFunction();
    },
    render: function () {
        if (!this.state.show) return null;
        var html = (
            <div>
                <h3>Edit Waypoint</h3>
                <div>
                    <div className="avn_row"><label>Name</label><input type="text" name="name"
                                                                       onChange={this.valueChanged} value={this.state.name}/>
                    </div>
                    <div className="avn_row"><label>Lon</label><input type="text" name="lon"
                                                                      onChange={this.valueChanged} value={this.state.lon}/>
                    </div>
                    <div className="avn_row"><label>Lat</label><input type="text" name="lat"
                                                                      onChange={this.valueChanged} value={this.state.lat}/>
                    </div>
                </div>
                <button name="ok" onClick={this.okFunction}>Ok</button>
                <button name="cancel" onClick={this.cancelFunction}>Cancel</button>
                <div className="avn_clear"></div>
            </div>
        );
        return html;
    },
    statics: {
        updateWaypoint: function (oldWp, newWp,errorFunction, router) {
            var wp = oldWp.clone();
            var data = newWp;
            if (!data) return;
            wp.name = data.name;
            var doChange = true;
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
            if (!doChange) return;
            if (!router) return wp;
            var ok = false;
            if (wp.routeName && wp.routeName != oldWp.routeName) {
                if (errorFunction)errorFunction("internal error, route name changed");
                doChange = false;
            }
            if (wp.routeName && doChange) {
                var rt = router.getRouteByName(oldWp.routeName);
                if (rt) {
                    var idx = rt.getIndexFromPoint(oldWp);
                    if (idx < 0) {
                        if (errorFunction)errorFunction("internal error, cannot find waypoint");
                        doChange = false;
                    }
                    else {
                        ok = rt.checkChangePossible(idx, wp);
                        if (!ok) {
                            if (errorFunction)errorFunction("name already exists, cannot change");
                            doChange = false;
                        }
                    }
                }
            }
            if (doChange) {
                ok = router.changeWp(oldWp, wp);
                if (ok) {
                    return wp;
                }
                else {
                    if (errorFunction)errorFunction("cannot change waypoint");
                    return;
                }
            }
        }
    }
});


module.exports=WaypointDialog;