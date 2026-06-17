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

import React, {useEffect, useState} from "react";
import Formatter from '../util/formatter';
// @ts-ignore
import navdata from "../nav/navdata";
import navobjects, {WayPoint} from "../nav/navobjects";
import globalStore from "../util/globalstore";
import keys from "../util/keys";
import {useStateRef} from "../util/UiHelper";
import Toast from "./Toast";
import {DBCancel, DBOk, DialogButtons, DialogFrame, DialogRow, DialogText} from "./OverlayDialog";
import {Checkbox, Radio} from "./Inputs";
import ItemList from "./ItemList";
import {useDialogContext} from "./DialogContext";
// @ts-ignore
import navcompute from "../nav/navcompute";
import {IRouteInfoWithStatus, RoutePoint} from "../nav/routeobjects";
import RouteEdit, {StateHelper} from "../nav/routeeditor";

const RouteHandler=navdata.getRoutingHandler();
const activeRoute = new RouteEdit(RouteEdit.MODES.ACTIVE);

export const INFO_ROWS=[
    {label:'name',value:'name'},
    {label:'points',value:'numPoints'},
    {label:'length',value:'length',formatter:(v:number)=>{
        return Formatter.formatDistance(v)+" nm";
        }},
    {label:'remain',value:'remain',formatter:(v:number)=>{
            return Formatter.formatDistance(v)+" nm";
        }},
    {label:'next point',value:'nextTarget',formatter:(v:any)=>v.name},
    {label:'leg from',value:'legfrom',formatter:(v:any)=>v.name},
    {label:'leg to',value:'legto',formatter:(v:any)=>v.name},
    {label: 'leg brg',value:'legbrg',formatter:(v:any)=>Formatter.formatDirection(v)+"°"},
    {label: 'leg len',value:'legdst',formatter:(v:any)=>Formatter.formatDistance(v)+" nm"},
    {label: 'remain leg end',value: 'remainIdx',formatter:(v:any)=>Formatter.formatDistance(v)+" nm"},
    {label: 'vmg ttg/eta',value:'ttgovmg',formatter:(v:any)=>{
        return Formatter.formatTimeDiff(v) + " / " + Formatter.formatTime(navcompute.etaFromDiff(v));
        }},
    {label: 'sog ttg/eta',value:'ttgosog',formatter:(v:any)=>Formatter.formatTimeDiff(v)+" / "+Formatter.formatTime(navcompute.etaFromDiff(v))}
    ];
export interface RouteItem{
    name:string;

}
export interface RouteInfo{
    remain?: number;
    length?: number;
    numPoints?: number;
    legbrg?: number;
    legdst?: number;
    legto?: RoutePoint;
    legfrom?: RoutePoint;
    remainIdx?: number;
    ttgovmg?:number; //ttgo to idx in sec based on vmg
    ttgosog?:number;
}
export const getRouteInfo = async (routeItem:RouteItem, opt_point:WayPoint) => {
    if (!routeItem || ! routeItem.name) throw new Error("missing route name");
    const route = await RouteHandler.fetchRoute(routeItem.name);
    const info = RouteHandler.getInfoFromRoute(route);
    const rt:RouteInfo = {
        length: info.length,
        numPoints: info.numpoints,
    }
    if (opt_point instanceof navobjects.Point) {
        const rhumbLine=globalStore.getData(keys.nav.routeHandler.useRhumbLine);
        const idx = route.getIndexFromPoint(opt_point);
        if (idx >= 0) {
            rt.remain = route.computeLength(idx,rhumbLine );
            if (idx >= 1){
                const distance=navcompute.computeDistance(
                    route.points[idx-1],
                    route.points[idx],
                    rhumbLine
                )
                rt.legbrg=distance.course;
                rt.legdst=distance.dts;
                rt.legfrom=route.points[idx-1];
                rt.legto=route.points[idx];
            }
        }
        const activeState=activeRoute.getState();
        if (StateHelper.isActiveRoute(activeState) && StateHelper.isSameRoute(activeState,route)) {
            const target=StateHelper.activeTarget(activeState);
            const targetIdx=route.getIndexFromPoint(target);
            if (idx >= targetIdx && targetIdx >= 0){
                const targetToIdx=route.computeLength(targetIdx,rhumbLine,idx);
                const toTarget=globalStore.getData(keys.nav.wp.distance);
                rt.remainIdx=toTarget+targetToIdx;
                const vmg=globalStore.getData(keys.nav.wp.vmg);
                if (vmg && vmg >0){
                    rt.ttgovmg=rt.remainIdx/vmg;
                }
                const sog=globalStore.getData(keys.nav.gps.speed);
                if (sog && sog >0){
                    rt.ttgosog=rt.remainIdx/sog;
                }
            }
        }
    }
    return rt;

}

const STATE_TEXT:Record<string, string> = {
    'noserver':'[new] ',
    'equal': '[equ] ',
    'different':'[mod] '
}
interface RouteStateProps{
    name:string,
    allowUpload?:boolean,
    action:string,
    setAction:(nv:string)=>void,
    status?:string,
}
const RouteState=({name,action,setAction,allowUpload,status}:RouteStateProps)=>{
    return <DialogRow>
        <Radio
            dialogRow={true}
            label={STATE_TEXT[status]+ name}
            itemList={[
                {label:'delete',value:'delete'},
                {label:'upload',value:'upload',disabled:!allowUpload},
                {label:'keep local',value:'keep'}
            ]}
            value={action}
            onChange={(nv:string)=>setAction(nv)}
        ></Radio>
    </DialogRow>
}

export interface RouteSyncDialogProps{
    deleteLocal?:boolean;
    showEmpty?:boolean;
}
export const RouteSyncDialog=({deleteLocal,showEmpty}:RouteSyncDialogProps)=>{
    const [list,setList,listRef]=useStateRef([]);
    const [loading,setLoading]=useState(true);
    const [overwrite,setOverwrite]=useState(false);
    const [itemActions,setItemActions]=useState<Record<string, string>>({});
    const dialogContext = useDialogContext();
    const setDefaults=(items:IRouteInfoWithStatus[],allowOv:boolean)=>{
        setItemActions((old:Record<string,string>)=> {
            const rt={...old};
            (items || []).forEach((item) => {
                const ov=rt[item.name];
                if (! ov) {
                    if (item.status === 'noserver' || allowOv) rt[item.name]='upload';
                    else {
                        if (item.status === 'different') rt[item.name]='keep';
                        else rt[item.name]='delete';
                    }
                }
                else{
                    if (! allowOv && ov === 'upload'){
                        rt[item.name]='keep';
                    }
                    if ((item.status === 'different' && allowOv) || item.status === 'noserver'){
                        rt[item.name]='upload';
                    }
                }
            })
            return rt;
        });
    }
    useEffect(() => {
        RouteHandler.checkLocalRoutes(deleteLocal)
            .then((rtlist:IRouteInfoWithStatus[])=>{
                setLoading(false);
                if (! rtlist || rtlist.length<1) {
                    if (! showEmpty) dialogContext.closeDialog();
                }
                else {
                    setList(rtlist);
                    setDefaults(rtlist,overwrite);
                }
            })
            .catch((err:any)=>{
                Toast(err);
                setLoading(false);
            })
    }, []);
    useEffect(() => {
        setDefaults(listRef.current,overwrite);
    },[overwrite])
    const className='RouteSyncDialog';
    const title="Unsynced Local Routes";
    if (loading) return <DialogFrame title={'Checking Routes'}>
        <DialogButtons buttonList={DBCancel()}/>
    </DialogFrame>;
    if (list.length < 1){
        return <DialogFrame title={title}>
            <DialogText>You have no unsynced local routes</DialogText>
            <DialogButtons buttonList={[DBCancel()]}/>
        </DialogFrame>
    }
    return <DialogFrame
        title={"Unsynced Local Routes"}
        className={className}
    >
        <DialogText>Please select the actions for your local routes.</DialogText>
        <Checkbox
            className={'allowServer'}
            dialogRow={true}
            label={'overwrite on server'}
            value={overwrite}
            onChange={(nv)=>setOverwrite(nv)}
        />
        <ItemList
            itemList={list}
            itemClass={(item)=>{
                return <RouteState
                    name={item.displayName||item.name}
                    key={item.name}
                    allowUpload={item.status === 'noserver' || overwrite}
                    action={itemActions[item.name]||'delete'}
                    setAction={(nv)=>setItemActions((current)=>{
                        return {...current,[item.name]:nv}
                    })}
                    status={item.status}
                />
            }}
        ></ItemList>
        <DialogButtons
            buttonList={[
                DBCancel(),
                DBOk(async ()=>{
                    const errors=[];
                    for (const route of listRef.current) {
                        try {
                            const action = itemActions[route.name] || 'delete';
                            if (action === 'delete') {
                                await RouteHandler.deleteRoute(route.name);
                            }
                            else if (action === 'upload') {
                                const routeData=await RouteHandler.fetchRoute(route.name);
                                routeData.setName(route.serverName);
                                await RouteHandler.saveRoute(routeData,true);
                                await RouteHandler.deleteRoute(route.name);
                            }
                        }catch (e){
                            if (e) errors.push(route.name+": "+e);
                        }
                    }
                    if (errors.length > 0) {
                        Toast(errors.join('\n'));
                    }
                })
            ]}
        />
    </DialogFrame>
}