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
 #  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 #  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 #  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 #  DEALINGS IN THE SOFTWARE.
 #
 ###############################################################################
 * display the infos of a feature
 */

import React from 'react';
import PropTypes from 'prop-types';
import Formatter from '../util/formatter';
import DB from './DialogButton';
import history from "../util/history";
import OverlayDialog from "./OverlayDialog";
import NavHandler from "../nav/navdata";
import navobjects from "../nav/navobjects";
import globalstore from "../util/globalstore";
import keys from "../util/keys";
import NavCompute from "../nav/navcompute";
import TrackInfoDialog from "./TrackInfoDialog";
const RouteHandler=NavHandler.getRoutingHandler();
const InfoItem=(props)=>{
    return <div className={"dialogRow "+props.className}>
        <span className={"inputLabel"}>{props.label}</span>
        <span className={"itemInfo"}>{props.value}</span>
    </div>
}

const INFO_ROWS=[
    {label:'name',value:'name'},
    {label:'description',value:'desc',formatter:(v,feature)=>{
        if (feature.name === v) return;
        return v;
        }},
    {label:'overlay',value:'overlayName',formatter:(v,overlay)=>{
        let prefix="";
        if (overlay.overlayType) prefix=TYPE_PREFIX[overlay.overlayType]||"";
        return prefix+v;
        }},
    {label: 'position',value:'coordinates',formatter:(v)=>Formatter.formatLonLats({lon:v[0],lat:v[1]})},
    {label: 'distance',value:'coordinates',formatter:(v)=>{
        let position=globalstore.getData(keys.nav.gps.position);
        let valid=globalstore.getData(keys.nav.gps.valid,false);
        if (! valid) return;
        let distance=NavCompute.computeDistance(position,new navobjects.Point(v[0],v[1]));
        return Formatter.formatDistance(distance.dts)+" nm";
        }},
    {label: 'bearing',value:'coordinates',formatter:(v)=>{
            let position=globalstore.getData(keys.nav.gps.position);
            let valid=globalstore.getData(keys.nav.gps.valid,false);
            if (! valid) return;
            let distance=NavCompute.computeDistance(position,new navobjects.Point(v[0],v[1]));
            return Formatter.formatDirection(distance.course)+" °";
        }}
];

const TYPE_PREFIX={
    route: "Route: ",
    track: "Track: "
};

const showInfoFunctions={
    track: TrackInfoDialog.showDialog
}


class FeatureInfoDialog extends React.Component{
    constructor(props) {
        super(props);
        this.linkAction=this.linkAction.bind(this);
    }
    linkAction(){
        if (! this.props.link) return;
        this.props.closeCallback();
        history.push('viewpage',{url:this.props.link,name:this.props.name,useIframe:true});
    }
    render(){
        let link=this.props.link;
        return (
            <div className="FeatureInfoDialog flexInner">
                <h3 className="dialogTitle">
                    {this.props.icon &&
                        <span className="icon" style={{backgroundImage:"url('"+this.props.icon+"')"}}/>
                    }
                    Feature Info
                </h3>
                {INFO_ROWS.map((row)=>{
                    let v=this.props[row.value];
                    if (v === undefined) return null;
                    if (row.formatter) v=row.formatter(v,this.props);
                    if (v === undefined) return null;
                    return <InfoItem label={row.label} value={v}/>
                })}
                <div className={"dialogButtons"}>
                    {showInfoFunctions[this.props.overlayType] &&
                        <DB
                            name="info"
                            onClick={()=>{
                                this.props.closeCallback();
                                showInfoFunctions[this.props.overlayType]({
                                    type:this.props.overlayType,
                                    name:this.props.overlayName
                                });
                            }}
                            >Info</DB>
                    }
                    {this.props.additionalActions && this.props.additionalActions.map((action)=>{
                        return <DB
                            name={action.name}
                            onClick={()=>{this.props.closeCallback();action.onClick(this.props)}}>
                            {action.label}
                        </DB>
                    })}
                    {link && <DB
                        name="info"
                        onClick={this.linkAction}
                        >Info</DB>}
                    <DB name={"cancel"}
                        onClick={this.props.closeCallback}
                        >Cancel</DB>
                </div>
            </div>
        );
    }
}

FeatureInfoDialog.propTypes={
    info: PropTypes.string,
    link: PropTypes.string,
    coordinates: PropTypes.array,
    overlayName: PropTypes.string,
    overlayType: PropTypes.string,
    overlayUrl: PropTypes.string,
    additionalActions: PropTypes.array //array of objects with: name,label,onClick
}

FeatureInfoDialog.showDialog=(info,opt_showDialogFunction)=>{
    if (!opt_showDialogFunction) {
        opt_showDialogFunction = OverlayDialog.dialog;
    }
    return opt_showDialogFunction((props)=>{
            return <FeatureInfoDialog
                {...info}
                {...props}/>
        });
}

export default FeatureInfoDialog;