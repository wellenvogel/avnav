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
import navdata from "../nav/navdata";
import navobjects from "../nav/navobjects";
import globalStore from "../util/globalstore";
import keys from "../util/keys";
import {useStateRef} from "../util/GuiHelpers";
import Toast from "./Toast";
import {DBCancel, DBOk, DialogButtons, DialogFrame, DialogRow, DialogText, useDialogContext} from "./OverlayDialog";
import {Checkbox, Radio} from "./Inputs";
import ItemList from "./ItemList";

let RouteHandler=navdata.getRoutingHandler();

export const INFO_ROWS=[
    {label:'name',value:'name'},
    {label:'points',value:'numPoints'},
    {label:'length',value:'length',formatter:(v)=>{
        return Formatter.formatDistance(v)+" nm";
        }},
    {label:'remain',value:'remain',formatter:(v)=>{
            return Formatter.formatDistance(v)+" nm";
        }},
    {label:'next point',value:'nextTarget',formatter:(v)=>v.name}
    ];
export const getRouteInfo = async (routeItem, opt_point) => {
    if (!routeItem || ! routeItem.name) throw new Error("missing route name");
    const route = await RouteHandler.fetchRoute(routeItem.name);
    let info = RouteHandler.getInfoFromRoute(route);
    let rt = {
        length: info.length,
        numPoints: info.numpoints,
    }
    if (opt_point instanceof navobjects.Point) {
        const idx = route.getIndexFromPoint(opt_point);
        if (idx >= 0) {
            rt.remain = route.computeLength(idx, globalStore.getData(keys.nav.routeHandler.useRhumbLine));
        }
    }
    return rt;

}

const STATE_TEXT={
    'noserver':'[new] ',
    'equal': '[equ] ',
    'different':'[mod] '
}
const RouteState=({name,action,setAction,allowUpload,status})=>{
    return <DialogRow>
        <Radio
            dialogRow={true}
            label={STATE_TEXT[status]+ name}
            itemList={[
                {label:'delete',value:'delete'},
                {label:'upload',value:'upload',disabled:!!allowUpload},
                {label:'keep',value:'keep'}
            ]}
            value={action}
            onChange={(nv)=>setAction(nv)}
        ></Radio>
    </DialogRow>
}

export const RouteSyncDialog=({deleteLocal,showEmpty})=>{
    const [list,setList,listRef]=useStateRef([]);
    const [loading,setLoading]=useState(true);
    const [overwrite,setOverwrite]=useState(false);
    const [itemActions,setItemActions]=useState({});
    const dialogContext = useDialogContext();
    const setDefaults=(items,allowOv)=>{
        setItemActions((old)=> {
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
            .then((rtlist)=>{
                setLoading(false);
                if (! rtlist || rtlist.length<1) {
                    if (! showEmpty) dialogContext.closeDialog();
                }
                else {
                    setList(rtlist);
                    setDefaults(rtlist,overwrite);
                }
            })
            .catch((err)=>{
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
                    for (let route of listRef.current) {
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