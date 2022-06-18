/**
 *###############################################################################
 # Copyright (c) 2012-2020 Andreas Vogel andreas@wellenvogel.net
 #
 #  Permission is hereby granted, free of charge, to any person obtaining a
 #  copy of this software and associated documentation files (the "Software"),
 #  to deal in the Software without restriction, including without limitation
 #  the rights to use, copy, modify, merge, publish, distribute, sublicense,
 #  and/or sell copies of the Software, and to permit persons to whom the
 #  Software is furnished to do so, subject to the following conditions:
 #
 #  The above copyright notice and this permission notice shall be included
 #  in all copies or substantial portions of the Software.
 #
 #  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 #  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 #  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 #  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHERtime
 #  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 #  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 #  DEALINGS IN THE SOFTWARE.
 #
 ###############################################################################
 * display the infos of a route
 */

import React from 'react';
import PropTypes from 'prop-types';
import DB from "./DialogButton";
import OverlayDialog,{InfoItem} from "./OverlayDialog";
import Toast from "./Toast";
import NavCompute from "../nav/navcompute";
import Formatter from '../util/formatter';
import assign from 'object-assign';
import navdata from "../nav/navdata";
import globalStore from "../util/globalstore";
import keys from "../util/keys";

let RouteHandler=navdata.getRoutingHandler();

export const INFO_ROWS=[
    {label:'name',value:'name'},
    {label:'points',value:'numPoints'},
    {label:'length',value:'length',formatter:(v)=>{
        return Formatter.formatDistance(v)+" nm";
        }},
    {label:'next point',value:'routeTarget',formatter:(v)=>v.name}
    ];
export const getClosestPoint=(route,waypoint)=>{
    let idx=route.findBestMatchingIdx(waypoint);
    let useRhumbLine=globalStore.getData(keys.nav.routeHandler.useRhumbLine);
    if (idx >= 0) {
        //now we check if we are somehow between the found point and the next
        let currentTarget = route.getPointAtIndex(idx);
        let nextTarget = route.getPointAtIndex(idx + 1);
        if (nextTarget && currentTarget) {
            let nextDistanceWp = NavCompute.computeDistance(waypoint, nextTarget,useRhumbLine).dts;
            let nextDistanceRt = NavCompute.computeDistance(currentTarget, nextTarget,useRhumbLine).dts;
            //if the distance to the next wp is larger then the distance between current and next
            //we stick at current
            //we allow additionally a xx% catch range
            //so we only go to the next if the distance to the nextWp is xx% smaller then the distance between the rp
            let limit = nextDistanceRt * (100 - globalStore.getData(keys.properties.routeCatchRange, 50)) / 100;
            if (nextDistanceWp <= limit) {
                return nextTarget;
            } else {
                return currentTarget;
            }
        }
    }
}
export const getRouteInfo = (routeName,opt_waypoint) => {
    return new Promise((resolve, reject) => {
        if (!routeName) reject("missing route name");
        RouteHandler.fetchRoute(routeName,false,(route)=>{
                let info=RouteHandler.getInfoFromRoute(route);
                let rt={
                    length: info.length,
                    numPoints: info.numpoints,
                }
                if (opt_waypoint){
                    rt.routeTarget=getClosestPoint(route,opt_waypoint);
                }
                resolve(rt);
            }
            ,(error) => reject(error)
        );
    })
}
class RouteInfoDialog extends React.Component{
    constructor(props) {
        super(props);
        this.state={
            loaded:false,
            name:this.props.name
        }
    }

    componentDidMount() {
        getRouteInfo(this.props.name)
            .then((values)=>{
                this.setState(assign({loaded: true},values));
            })
            .catch((error)=>Toast(error));
    }

    render(){
       return  <div className="RouteInfoDialog flexInner">
            <h3 className="dialogTitle">Route Info</h3>
            {INFO_ROWS.map((row)=>{
                let v=this.state[row.value];
                if (v === undefined) return null;
                if (row.formatter) v=row.formatter(v,this.state);
                if (v === undefined) return null;
                return <InfoItem label={row.label} value={v}/>
            })}
            <div className="dialogButtons">
                <DB name={"cancel"}
                    onClick={this.props.closeCallback}
                >Cancel</DB>
            </div>
        </div>
    }
}

RouteInfoDialog.PropTypes={
    name: PropTypes.string.isRequired
}
RouteInfoDialog.showDialog=(info,opt_showDialogFunction)=>{
    if (!opt_showDialogFunction) {
        opt_showDialogFunction = OverlayDialog.dialog;
    }
    return opt_showDialogFunction((props)=>{
        return <RouteInfoDialog
            {...info}
            {...props}/>
    });
}

export default RouteInfoDialog;