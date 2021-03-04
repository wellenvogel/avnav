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
import OverlayDialog, {stateHelper,InfoItem} from "./OverlayDialog";
import NavHandler from "../nav/navdata";
import navobjects from "../nav/navobjects";
import globalstore from "../util/globalstore";
import keys from "../util/keys";
import NavCompute from "../nav/navcompute";
import {getTrackInfo,INFO_ROWS as TRACK_INFO_ROWS} from "./TrackInfoDialog";
import {getRouteInfo,INFO_ROWS as ROUTE_INFO_ROWS} from "./RouteInfoDialog";
import Toast from "./Toast";
import assign from 'object-assign';
NavHandler.getRoutingHandler();


const INFO_ROWS=[
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
        }},
    {label:'name',value:'name'},
    {label:'description',value:'desc',formatter:(v,feature)=>{
        if (feature.name === v) return;
        return v;
        }},
    {label:'time',value:'time',formatter:(v)=>{
        try{
            let tv=new Date(v);
            return Formatter.formatDateTime(tv);
        }catch(e){}
        }},
    {label:'overlay',value:'overlayName',formatter:(v,overlay)=>{
        if (overlay.overlayType === 'chart') return;
        let prefix="";
        if (overlay.overlayType) prefix=TYPE_PREFIX[overlay.overlayType]||"";
        return prefix+v;
        }},
    {label:'chart',value:'overlayName',formatter:(v,overlay)=>{
        if (overlay.overlayType !== 'chart') return;
        return v;
        }
    },
    {label:'symbol',value:'sym'},
    //for s57 objects
    {label: 'buoy',value: 'buoy'},
    {label: 'top',value:'top'},
    {label: 'light', value:'light'}

];

const TYPE_PREFIX={
    route: "Route: ",
    track: "Track: "
};

const INFO_FUNCTIONS={
    track: getTrackInfo,
    route: getRouteInfo
};
const INFO_DISPLAY={
    track: TRACK_INFO_ROWS,
    route: ROUTE_INFO_ROWS
}

class FeatureInfoDialog extends React.Component{
    constructor(props) {
        super(props);
        this.linkAction=this.linkAction.bind(this);
        this.hideAction=this.hideAction.bind(this);
        this.extendedInfo=stateHelper(this,{},'trackInfo');
    }
    linkAction(){
        if (! this.props.link && ! this.props.htmlInfo) return;
        this.props.closeCallback();
        let url=this.props.link;
        if (this.props.htmlInfo){
            history.push('viewpage',{html:this.props.htmlInfo,name:this.props.name||'featureInfo'});
            return;
        }
        history.push('viewpage',{url:url,name:this.props.name,useIframe:true});
    }
    hideAction(){
        if (! this.props.overlaySource) return;
        this.props.closeCallback();
        this.props.overlaySource.setEnabled(false,true);
    }
    componentDidMount() {
        let infoFunction=INFO_FUNCTIONS[this.props.overlayType]
        let infoCoordinates=this.props.nextTarget?this.props.nextTarget:this.props.coordinates;
        if (infoFunction){
            infoFunction(this.props.overlayName,
                new navobjects.WayPoint(infoCoordinates[0],infoCoordinates[1])
                )
                .then((info)=>{
                    this.extendedInfo.setState(info,true)
                })
                .catch((error)=>Toast(error));
        }
    }
    infoRowDisplay(row,data){
        let v=data[row.value];
        if (v === undefined) return null;
        if (row.formatter) v=row.formatter(v,data);
        if (v === undefined) return null;
        return <InfoItem label={row.label} value={v}/>
    }
    render(){
        let link=this.props.link||this.props.htmlInfo;
        let extendedInfoRows=INFO_DISPLAY[this.props.overlayType];
        let merged=assign({},this.props,this.extendedInfo.getState());
        return (
            <div className="FeatureInfoDialog flexInner" >
                <h3 className="dialogTitle">
                    {this.props.icon &&
                        <span className="icon" style={{backgroundImage:"url('"+this.props.icon+"')"}}/>
                    }
                    Feature Info
                </h3>
                {INFO_ROWS.map((row)=>{
                    return this.infoRowDisplay(row,this.props);
                })}
                {extendedInfoRows && extendedInfoRows.map((row)=>{
                    return this.infoRowDisplay(row,this.extendedInfo.getState());
                })}
                {this.props.additionalInfoRows && this.props.additionalInfoRows.map((row)=>{
                    return this.infoRowDisplay(row,merged);
                })}
                <div className={"dialogButtons"}>
                    {this.props.additionalActions && this.props.additionalActions.map((action)=>{
                        if ( typeof(action.condition) === "function" ){
                            if (! action.condition(merged)) return null;
                        }
                        if (action.condition !== undefined && ! action.condition) return null;
                        return <DB
                            name={action.name}
                            onClick={()=>{this.props.closeCallback();action.onClick(merged)}}>
                            {action.label}
                        </DB>
                    })}
                    {link && <DB
                        name="info"
                        onClick={this.linkAction}
                        >Info</DB>}
                    {this.props.overlaySource &&
                    <DB name="hide"
                        onClick={this.hideAction}
                        >Hide</DB>}
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
    nextTarget:  PropTypes.array,
    overlayName: PropTypes.string,
    overlayType: PropTypes.string,
    overlayUrl: PropTypes.string,
    additionalActions: PropTypes.array, //array of objects with: name,label,onClick,condition
    additionalInfoRows: PropTypes.array //array of name,value,formatter
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