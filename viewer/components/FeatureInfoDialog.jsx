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

import React, {useCallback, useEffect, useRef, useState} from 'react';
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
import {AisFeatureInfo, AnchorFeatureInfo, BaseFeatureInfo, FeatureAction, FeatureInfo} from "../map/featureInfo";
import Helper from "../util/helper";
import {AisInfoWithFunctions} from "./AisInfoDisplay";
import {WatchDialogWithFunctions} from "./AnchorWatchDialog";
import MapEventGuard from "../hoc/MapEventGuard";
import globalStore from "../util/globalstore";
import MapHolder from "../map/mapholder";
NavHandler.getRoutingHandler();

const POS_ROW={label: 'position',value:'point',formatter:(v)=>Formatter.formatLonLats(v)}

const INFO_ROWS=[
    {label:'item',formatter:(v,featureInfo)=>{
            if (featureInfo.isOverlay || featureInfo.getType() === FeatureInfo.TYPE.chart) return;
            return featureInfo.title;
        }},
    {label:'overlay',value:'title',formatter:(v,overlay)=>{
            if (!overlay.isOverlay || overlay.getType() === FeatureInfo.TYPE.chart) return;
            let prefix="";
            if (overlay.getType()) prefix=TYPE_PREFIX[overlay.getType()]||"";
            return prefix+v;
        }},
    {label:'chart',value:'title',formatter:(v,overlay)=>{
            if (overlay.getType() !== FeatureInfo.TYPE.chart) return;
            return v;
        }
    },
    POS_ROW,
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
    {label:'name',formatter:(v,featureInfo)=>{
        if (featureInfo.validPoint() && featureInfo.point.name) return featureInfo.point.name;
        return featureInfo.userInfo.name;
        }},
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

const InfoRowDisplay=({row,data,className})=>{
    let v;
    if (row.value) {
        v = data[row.value];
        if (v === undefined) return null;
    }
    if (row.formatter) v=row.formatter(v,data);
    if (v === undefined) return null;
    return <InfoItem label={row.label} value={v} className={className}/>
}
const ImageIcon=({iconImage,className})=>{
    const ref=useRef();
    useEffect(() => {
        if (ref.current) ref.current.appendChild(iconImage.cloneNode(true));
    }, []);
    return <div className={Helper.concatsp(className,'ImageIcon')} ref={ref}/>
}

const FeatureIcon=({feature,showOverlayIcon})=>{
    return <React.Fragment>
        {feature.icon && <ImageIcon className={'icon'} iconImage={feature.icon}/>}
        {!feature.icon && <span className={Helper.concatsp('icon',feature.typeString())}/> }
        { showOverlayIcon && feature.isOverlay && (feature.getType() !== FeatureInfo.TYPE.overlay) && <span className={Helper.concatsp('icon','overlay')}/> }
    </React.Fragment>
}

export const FeatureListDialog = ({featureList, onSelectCb, additionalActions, history,listActions,className}) => {
    const dialogContext = useDialogContext();
    const shouldKeep=useRef(false);
    const select = useCallback((featureInfo) => {
        if (!onSelectCb || onSelectCb(featureInfo)) {
            shouldKeep.current=false;
            if (featureInfo instanceof AisFeatureInfo){
                dialogContext.showDialog((dprops)=><AisInfoWithFunctions
                        {...dprops}
                        mmsi={featureInfo.urlOrKey}
                        actionCb={(action,m)=>{
                            if (action === 'AisInfoList'){
                                history.push('aispage', {mmsi: m});
                            }
                            dialogContext.closeDialog();
                        }}
                    />
                )
                return;
            }
            if (featureInfo instanceof AnchorFeatureInfo){
                dialogContext.replaceDialog((dprops)=><WatchDialogWithFunctions {...dprops}/>)
                return;
            }
            let factions = [];
            if (additionalActions instanceof Array) {
                additionalActions.forEach((action)=>{
                    if (action.shouldShow(featureInfo)){
                        factions.push(action);
                    }
                })
            }
            dialogContext.showDialog((dprops) => <FeatureInfoDialog
                    {...dprops}
                    featureInfo={featureInfo}
                    additionalActions={factions}
                    history={history}
                    cancelAction={()=>{
                        shouldKeep.current=true;
                        return true;
                    }}
                />,
                ()=>{
                    if (! shouldKeep.current){
                        dialogContext.closeDialog();
                    }
                }
            )
        } else {
            dialogContext.closeDialog();
        }
    }, [onSelectCb, additionalActions, history]);
    if (!(featureList instanceof Array) || featureList.length < 1) {
        dialogContext.closeDialog();
        return null;
    }
    const buttonList=[];
    const baseInfo=featureList[0];
    if (baseInfo && listActions){
        listActions.forEach((action)=>{
            if (action.shouldShow(baseInfo)){
                buttonList.push({
                    name:action.name,
                    onClick:() => {
                        action.onClick(baseInfo,dialogContext)
                    },
                    label:action.label,
                    close: Helper.unsetorTrue(action.close),
                    toggle: action.toggle(baseInfo)
                });
            }
        })
    }
    buttonList.push(DBCancel());
    return <DialogFrame className={Helper.concatsp('featureListDialog',className)} title={'FeatureList'}>
        {baseInfo &&
            <InfoRowDisplay row={POS_ROW} data={baseInfo}/>
        }
        {featureList.map((feature) => {
            if (feature instanceof BaseFeatureInfo) return null;
            return <DialogRow key={feature.urlOrKey||feature.title} className={'listEntry'} onClick={() => {
                select(feature);
            }}>
                <div className={'icons'}>
               <FeatureIcon feature={feature} showOverlayIcon={true}/>
                </div>
                <span className={'title'}>{feature.title}</span>
            </DialogRow>
        })}
        <DialogButtons buttonList={buttonList}/>
    </DialogFrame>
}
FeatureListDialog.propTypes={
    className: PropTypes.string,
    history: PropTypes.object.isRequired,
    featureList: PropTypes.arrayOf(PropTypes.instanceOf(FeatureInfo)),
    onSelectCb: PropTypes.func, //return false to cancel
    additionalActions: PropTypes.arrayOf(PropTypes.instanceOf(FeatureAction)),
    listActions: PropTypes.arrayOf(PropTypes.instanceOf(FeatureAction)) //will be called with first list element (if this is a BaseFeatureInfo)
}

export const GuardedFeatureListDialog=MapEventGuard(FeatureListDialog);
GuardedFeatureListDialog.propTypes=FeatureListDialog.propTypes;

const FeatureInfoDialog = ({featureInfo,additionalActions,history,cancelAction}) => {
    const [extendedInfo, setExtendedInfo] = useState({});
    const dialogContext = useDialogContext();
    useEffect(() => {
        if (! featureInfo) return;
        let infoFunction = INFO_FUNCTIONS[featureInfo.getType()]
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
    if (! featureInfo){
        dialogContext.closeDialog();
        return null;
    }
    let extendedInfoRows = INFO_DISPLAY[featureInfo.getType()];
    return (
        <DialogFrame className="FeatureInfoDialog">
            <h3 className="dialogTitle">
                <FeatureIcon feature={featureInfo}/>
                Feature Info
            </h3>
            {INFO_ROWS.map((row) => {
                return <InfoRowDisplay row={row} data={featureInfo} key={row.label}/>;
            })}
            {extendedInfoRows && extendedInfoRows.map((row) => {
                return <InfoRowDisplay row={row} data={extendedInfo} key={row.label}/>;
            })}
            <DialogButtons>
                {additionalActions && additionalActions.map((action) => {
                    if (!action.shouldShow(featureInfo)) return null;
                    return <DB
                        key={action.name}
                        name={action.name}
                        onClick={() => {
                            action.onClick(featureInfo,dialogContext)
                        }}
                        close={Helper.unsetorTrue(action.close)}
                        toggle={action.toggle(featureInfo)}
                        onPreClose={(featureInfo)=>{
                            if (! action.onPreClose(featureInfo,dialogContext)){
                                if (cancelAction) cancelAction(featureInfo,dialogContext);
                            }
                            return true;
                        }}
                        >
                        {action.label}
                    </DB>
                })}
                <DB name={"cancel"}
                    onPreClose={()=>{
                        if (cancelAction) {
                            return cancelAction(featureInfo,dialogContext);
                        }
                        return true;
                    }}
                    close={false}
                >Cancel</DB>
            </DialogButtons>
        </DialogFrame>
    );
}

FeatureInfoDialog.propTypes={
    featureInfo: PropTypes.instanceOf(FeatureInfo),
    history: PropTypes.object.isRequired,
    additionalActions: PropTypes.array,
    cancelAction: PropTypes.func
}

export const hideAction=new FeatureAction({
    name:"hide",
    label: 'Hide',
    onClick:(featureInfo)=>{
        featureInfo.overlaySource.setEnabled(false, true);
        },
    condition: (featureInfo)=>featureInfo.isOverlay && featureInfo.overlaySource
    });

export const linkAction=(history)=>new FeatureAction({
    name:"info",
    label:'Info',
    condition: (featureInfo)=>featureInfo.userInfo && (featureInfo.userInfo.link || featureInfo.userInfo.htmlInfo),
    onClick: (featureInfo)=>{
        const userInfo=featureInfo.userInfo||{};
        if (!userInfo.link && !userInfo.htmlInfo) return;
        let url = userInfo.link;
        if (userInfo.htmlInfo) {
            history.push('viewpage', {html: userInfo.htmlInfo, name: userInfo.title || 'featureInfo'});
            return;
        }
        history.push('viewpage', {url: url, name: userInfo.title, useIframe: true});
    }
})

export const CenterActionButton={
    name: 'CenterAction',
    storeKeys: {
        toggle: keys.map.activeMeasure,
        locked: keys.map.lockPosition,
        always: keys.properties.mapAlwaysCenter
    },
    updateFunction: (state)=>{
        return {
            toggle:!!state.toggle,
            visible: !state.locked || state.always
        }
    },
    overflow: true,
    editDisable: true,
    onClick: ()=>{
        let center = globalStore.getData(keys.map.centerPosition);
        let pixel=MapHolder.coordToPixel(MapHolder.pointToMap([center.lon,center.lat]))
        MapHolder.featureAction(pixel,true);
    }
}