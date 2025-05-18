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

import React, {useCallback, useEffect, useState} from 'react';
import PropTypes from 'prop-types';
import Formatter from '../util/formatter';
import DB from './DialogButton';
import OverlayDialog, {DialogButtons, DialogFrame, useDialogContext} from "./OverlayDialog";
import NavHandler from "../nav/navdata";
import navobjects from "../nav/navobjects";
import globalstore from "../util/globalstore";
import keys from "../util/keys";
import NavCompute from "../nav/navcompute";
import {getTrackInfo,INFO_ROWS as TRACK_INFO_ROWS} from "./TrackConvertDialog";
import {getRouteInfo,INFO_ROWS as ROUTE_INFO_ROWS} from "./RouteInfoHelper";
import Toast from "./Toast";
import {InfoItem} from "./BasicDialogs";
NavHandler.getRoutingHandler();


const INFO_ROWS=[
    {label: 'position',value:'nextTarget',formatter:(v)=>Formatter.formatLonLats(v)},
    {label: 'distance',value:'nextTarget',formatter:(v)=>{
            let position=globalstore.getData(keys.nav.gps.position);
            let valid=globalstore.getData(keys.nav.gps.valid,false);
            if (! valid) return;
            let distance=NavCompute.computeDistance(position,
                v,
                globalstore.getData(keys.nav.routeHandler.useRhumbLine));
            return Formatter.formatDistance(distance.dts)+" nm";
        }},
    {label: 'bearing',value:'nextTarget',formatter:(v)=>{
            let position=globalstore.getData(keys.nav.gps.position);
            let valid=globalstore.getData(keys.nav.gps.valid,false);
            if (! valid) return;
            let distance=NavCompute.computeDistance(position,
                v,
                globalstore.getData(keys.nav.routeHandler.useRhumbLine));
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

const InfoRowDisplay=({row,data})=>{
    let v=data[row.value];
    if (v === undefined) return null;
    if (row.formatter) v=row.formatter(v,data);
    if (v === undefined) return null;
    return <InfoItem label={row.label} value={v}/>
}

const FeatureInfoDialog = (props) => {
    const [extendedInfo, setExtendedInfo] = useState({});
    const dialogContext = useDialogContext();
    const linkAction = useCallback(() => {
        if (!props.link && !props.htmlInfo) return;
        dialogContext.closeDialog();
        let url = props.link;
        if (props.htmlInfo) {
            props.history.push('viewpage', {html: props.htmlInfo, name: props.name || 'featureInfo'});
            return;
        }
        props.history.push('viewpage', {url: url, name: props.name, useIframe: true});
    }, [props]);
    const hideAction = useCallback(() => {
        if (!props.overlaySource) return;
        dialogContext.closeDialog();
        props.overlaySource.setEnabled(false, true);
    }, [props]);
    useEffect(() => {
        let infoFunction = INFO_FUNCTIONS[props.overlayType]
        let infoCoordinates = props.nextTarget;
        if (infoFunction && infoCoordinates) {
            infoFunction(props.overlayName,
                infoCoordinates
            )
                .then((info) => {
                    setExtendedInfo(info)
                })
                .catch((error) => Toast(error));
        }
    }, []);
    let link = props.link || props.htmlInfo;
    let extendedInfoRows = INFO_DISPLAY[props.overlayType];
    let merged = {...props, ...extendedInfo};
    return (
        <DialogFrame className="FeatureInfoDialog">
            <h3 className="dialogTitle">
                {props.icon &&
                    <span className="icon" style={{backgroundImage: "url('" + props.icon + "')"}}/>
                }
                Feature Info
            </h3>
            {INFO_ROWS.map((row) => {
                return <InfoRowDisplay row={row} data={props}/>;
            })}
            {extendedInfoRows && extendedInfoRows.map((row) => {
                return <InfoRowDisplay row={row} data={extendedInfo}/>;
            })}
            {props.additionalInfoRows && props.additionalInfoRows.map((row) => {
                return <InfoRowDisplay row={row} data={merged}/>;
            })}
            <DialogButtons>
                {props.additionalActions && props.additionalActions.map((action) => {
                    if (typeof (action.condition) === "function") {
                        if (!action.condition(merged)) return null;
                    }
                    if (action.condition !== undefined && !action.condition) return null;
                    return <DB
                        name={action.name}
                        onClick={() => {
                            action.onClick(merged)
                        }}>
                        {action.label}
                    </DB>
                })}
                {link && <DB
                    name="info"
                    onClick={linkAction}
                    close={false}
                >Info</DB>}
                {props.overlaySource &&
                    <DB name="hide"
                        onClick={hideAction}
                        close={false}
                    >Hide</DB>}
                <DB name={"cancel"}
                >Cancel</DB>
            </DialogButtons>
        </DialogFrame>
    );
}

FeatureInfoDialog.propTypes={
    history: PropTypes.object.isRequired,
    info: PropTypes.string,
    link: PropTypes.string,
    nextTarget:  PropTypes.array,
    overlayName: PropTypes.string,
    overlayType: PropTypes.string,
    overlayUrl: PropTypes.string,
    additionalActions: PropTypes.array, //array of objects with: name,label,onClick,condition
    additionalInfoRows: PropTypes.array //array of name,value,formatter
}

export default FeatureInfoDialog;