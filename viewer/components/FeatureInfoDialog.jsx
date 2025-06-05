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
import {DBCancel, DialogButtons, DialogFrame, DialogRow, useDialogContext} from "./OverlayDialog";
import NavHandler from "../nav/navdata";
import globalstore from "../util/globalstore";
import keys from "../util/keys";
import NavCompute from "../nav/navcompute";
import {getTrackInfo,INFO_ROWS as TRACK_INFO_ROWS} from "./TrackConvertDialog";
import {getRouteInfo,INFO_ROWS as ROUTE_INFO_ROWS} from "./RouteInfoHelper";
import Toast from "./Toast";
import {InfoItem} from "./BasicDialogs";
import {AisFeatureInfo, BaseFeatureInfo, FeatureInfo} from "../map/featureInfo";
import Helper from "../util/helper";
import {AisInfoDialog, AisInfoWithFunctions} from "./AisInfoDisplay";
NavHandler.getRoutingHandler();


const INFO_ROWS=[
    {label: 'position',value:'point',formatter:(v)=>Formatter.formatLonLats(v)},
    {label: 'distance',value:'point',formatter:(v,featureInfo)=>{
            if (! featureInfo.validPoint()) return;
            let position=globalstore.getData(keys.nav.gps.position);
            let valid=globalstore.getData(keys.nav.gps.valid,false);
            if (! valid) return;
            let distance=NavCompute.computeDistance(position,
                v,
                globalstore.getData(keys.nav.routeHandler.useRhumbLine));
            return Formatter.formatDistance(distance.dts)+" nm";
        }},
    {label: 'bearing',value:'point',formatter:(v,featureInfo)=>{
            if (! featureInfo.validPoint()) return;
            let position=globalstore.getData(keys.nav.gps.position);
            let valid=globalstore.getData(keys.nav.gps.valid,false);
            if (! valid) return;
            let distance=NavCompute.computeDistance(position,
                v,
                globalstore.getData(keys.nav.routeHandler.useRhumbLine));
            return Formatter.formatDirection(distance.course)+" °";
        }},
    {label:'name',formatter:(v,featureInfo)=>featureInfo.userInfo.name},
    {label:'description',formatter:(v,feature)=>{
        const rt=feature.userInfo.desc;
        if (feature.userInfo.name === rt) return;
        return rt;
        }},
    {label:'time',formatter:(unused,featureInfo)=>{
        try{
            const v=featureInfo.userInfo.time;
            if (v === undefined) return;
            let tv=new Date(v);
            return Formatter.formatDateTime(tv);
        }catch(e){}
        }},
    {label:'overlay',value:'title',formatter:(v,overlay)=>{
        if (!overlay.isOverlay || overlay.type === FeatureInfo.TYPE.chart) return;
        let prefix="";
        if (overlay.type) prefix=TYPE_PREFIX[overlay.type]||"";
        return prefix+v;
        }},
    {label:'chart',value:'title',formatter:(v,overlay)=>{
        if (overlay.type !== FeatureInfo.TYPE.chart) return;
        return v;
        }
    },
    {label:'symbol',formatter:(v,featureInfo)=>featureInfo.userInfo.sym},
    //for s57 objects
    {label: 'buoy',formatter:(v,featureInfo)=>featureInfo.userInfo.buoy},
    {label: 'top',formatter:(v,featureInfo)=>featureInfo.userInfo.top},
    {label: 'light', formatter:(v,featureInfo)=>featureInfo.userInfo.light}

];

const TYPE_PREFIX={
    [FeatureInfo.TYPE.route]: "Route: ",
    [FeatureInfo.TYPE.track]: "Track: "
};

const INFO_FUNCTIONS={
    [FeatureInfo.TYPE.track]: getTrackInfo,
    [FeatureInfo.TYPE.route]: getRouteInfo
};
const INFO_DISPLAY={
    [FeatureInfo.TYPE.track]: TRACK_INFO_ROWS,
    [FeatureInfo.TYPE.route]: ROUTE_INFO_ROWS
}

const InfoRowDisplay=({row,data})=>{
    let v;
    if (row.value) {
        v = data[row.value];
        if (v === undefined) return null;
    }
    if (row.formatter) v=row.formatter(v,data);
    if (v === undefined) return null;
    return <InfoItem label={row.label} value={v}/>
}

export const FeatureListDialog = ({featureList, onSelectCb, additionalActions, history}) => {
    const dialogContext = useDialogContext();
    const select = useCallback((featureInfo) => {
        if (!onSelectCb || onSelectCb(featureInfo)) {
            if (featureInfo instanceof AisFeatureInfo){
                dialogContext.replaceDialog((dprops)=><AisInfoWithFunctions
                        {...dprops}
                        mmsi={featureInfo.urlOrKey}
                        actionCb={(action,m)=>{
                            if (action === 'AisInfoList'){
                                history.push('aispage', {mmsi: m});
                            }
                        }}
                    />
                )
                return;
            }
            let factions = [];
            if (additionalActions instanceof Array) {
                additionalActions.forEach((action)=>{
                    if (typeof action.condition === 'function'){
                        if (action.condition(featureInfo)) factions.push(action);
                    }
                    else{
                        factions.push(action);
                    }
                })
            }
            dialogContext.replaceDialog((dprops) => <FeatureInfoDialog
                    {...dprops}
                    featureInfo={featureInfo}
                    additionalActions={factions}
                    history={history}
                />
            )
        } else {
            dialogContext.closeDialog();
        }
    }, [onSelectCb, additionalActions, history]);
    if (!(featureList instanceof Array) || featureList.length < 1) {
        dialogContext.closeDialog();
        return null;
    }
    if (featureList.length === 1) {
        select(featureList[0]);
        return null;
    }
    return <DialogFrame className={'featureListDialog'} title={'FeatureList'}>
        {featureList.map((feature) => {
            if (feature instanceof BaseFeatureInfo) return null;
            return <DialogRow key={feature.urlOrKey} className={'listEntry'} onClick={() => {
                select(feature);
            }}>
                {feature.icon && <img className={'icon'} src={feature.icon.src}/>}
                {!feature.icon && <span className={Helper.concatsp('icon',feature.typeString())}/> }
                {feature.isOverlay && <span className={Helper.concatsp('icon','overlay')}/> }
                <span className={'title'}>{feature.title}</span>
            </DialogRow>
        })}
        <DialogButtons buttonList={[DBCancel()]}/>
    </DialogFrame>
}

const FeatureInfoDialog = ({featureInfo,additionalActions,history}) => {
    const [extendedInfo, setExtendedInfo] = useState({});
    const dialogContext = useDialogContext();
    if (! featureInfo){
        dialogContext.closeDialog();
        return null;
    }
    const userInfo=featureInfo.userInfo||{};
    const linkAction = useCallback(() => {
        if (!userInfo.link && !userInfo.htmlInfo) return;
        dialogContext.closeDialog();
        let url = userInfo.link;
        if (userInfo.htmlInfo) {
            history.push('viewpage', {html: userInfo.htmlInfo, name: userInfo.name || 'featureInfo'});
            return;
        }
        history.push('viewpage', {url: url, name: userInfo.name, useIframe: true});
    }, [userInfo,history]);
    const hideAction = useCallback(() => {
        if (!featureInfo.overlaySource || ! featureInfo.isOverlay) return;
        dialogContext.closeDialog();
        featureInfo.overlaySource.setEnabled(false, true);
    }, [featureInfo]);
    useEffect(() => {
        let infoFunction = INFO_FUNCTIONS[featureInfo.type]
        let infoCoordinates = featureInfo.point;
        if (infoFunction && infoCoordinates) {
            infoFunction(featureInfo.urlOrKey,
                infoCoordinates
            )
                .then((info) => {
                    setExtendedInfo(info)
                })
                .catch((error) => Toast(error));
        }
    }, []);
    let link = userInfo.link || userInfo.htmlInfo;
    let extendedInfoRows = INFO_DISPLAY[featureInfo.type];
    return (
        <DialogFrame className="FeatureInfoDialog">
            <h3 className="dialogTitle">
                {userInfo.icon &&
                    <span className="icon" style={{backgroundImage: "url('" + userInfo.icon + "')"}}/>
                }
                Feature Info
            </h3>
            {INFO_ROWS.map((row) => {
                return <InfoRowDisplay row={row} data={featureInfo}/>;
            })}
            {extendedInfoRows && extendedInfoRows.map((row) => {
                return <InfoRowDisplay row={row} data={extendedInfo}/>;
            })}
            <DialogButtons>
                {additionalActions && additionalActions.map((action) => {
                    if (typeof (action.condition) === "function") {
                        if (!action.condition(featureInfo)) return null;
                    }
                    if (action.condition !== undefined && !action.condition) return null;
                    return <DB
                        name={action.name}
                        onClick={() => {
                            action.onClick(featureInfo)
                        }}>
                        {action.label}
                    </DB>
                })}
                {link && <DB
                    name="info"
                    onClick={linkAction}
                    close={false}
                >Info</DB>}
                {featureInfo.overlaySource && featureInfo.isOverlay &&
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
    featureInfo: PropTypes.instanceOf(FeatureInfo),
    history: PropTypes.object.isRequired,
    additionalActions: PropTypes.array
}
