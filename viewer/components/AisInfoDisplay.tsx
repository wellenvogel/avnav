/**
 *###############################################################################
 # Copyright (c) 2012-2025 Andreas Vogel andreas@wellenvogel.net
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
 * show an AIS item
 */
// @ts-ignore
import NavData from "../nav/navdata";
import keys from "../util/keys";
import {useStore} from "../hoc/Dynamic";
import AisFormatter, {AisItem} from "../nav/aisformatter";
import globalStore from "../util/globalstore";
import React, {SyntheticEvent} from "react";
// @ts-ignore
import {Drawing} from "../map/drawing";
// @ts-ignore
import mapholder, {LOCK_MODES} from "../map/mapholder";
import ItemList, {Item} from "./ItemList";
import {DBCancel, DialogButtonDef, DialogButtons, DialogFlexInner, DialogFrame, DialogRow} from "./OverlayDialog";
import Helper from "../util/helper";
import {useDialogContext} from "./DialogContext";
import ButtonDefs from "./ButtonDefs";
interface DisplayItem{
    name?:string,
    addClass?:string,
}

const displayItems:DisplayItem[] = [
    {name: 'distance'},
    {name: 'cpa'},
    {name: 'tcpa'},
    {name: 'bcpa'},
    {name: 'headingTo'},
    {name: 'passFront', addClass: 'aisFront'},
    {name: 'mmsi'},
    {name: 'shipname'},
    {name: 'callsign'},
    {name: 'shiptype'},
    {name: 'aid_type'},
    {name: 'course'},
    {name: 'speed'},
    {name: 'heading'},
    {name: 'clazz'},
    {name: 'status'},
    {name: 'destination'},
    {name: 'position'},
    {name: 'turn'},
    {name: 'length'},
    {name: 'beam'},
    {name: 'draught'},
    {name: 'age'},
];

interface FetchedItem extends DisplayItem {
    current?:AisItem;
}

const createUpdateFunction=(config:DisplayItem,mmsi:string):()=>FetchedItem=>{
    return ()=>{
        if (!mmsi) return {current:undefined,...config};
        return {current:NavData.getAisHandler().getAisByMmsi(mmsi),...config};
    }
};
export const storeKeys={
    aisSequence:keys.nav.ais.updateCount
};
const createItem=(config:DisplayItem,mmsi:string)=>{
    let cl="aisData";
    if (config.addClass)cl+=" "+config.addClass;
    // eslint-disable-next-line react/display-name
    return (iprops:Item)=> {
        const sprops:FetchedItem=useStore({...iprops,storeKeys:storeKeys,updateFunction:createUpdateFunction(config,mmsi)});
        const key = sprops.name;
        if (! AisFormatter.shouldShow(key,sprops.current)){
            return null;
        }
        const target = sprops.current;
        if (typeof(target) == 'undefined') { return null; }
        const unit = AisFormatter.getUnit(sprops.name);
        let clazz = 'aisInfoRow';
        const warning = target.warning && (key.includes('cpa') || key.includes('pass'));
        const warningDist = globalStore.getData(keys.properties.aisWarningCpa);
        const warningTime = globalStore.getData(keys.properties.aisWarningTpa);
        const hideAge = globalStore.getData(keys.properties.aisLostTime)
        if((key.includes('pass') && warning)
            || (0 < target.tcpa && target.cpa < warningDist && (key=='cpa' || (key=='tcpa' && target.tcpa < warningTime)))
            || (key === 'age' && target.age > hideAge )
        ){
            clazz += ' aisWarning';
        }
        return (
            <DialogRow className={clazz}>
                <div className='label'>{AisFormatter.getHeadline(key)}</div>
                <div className={cl}>{AisFormatter.format(key, sprops.current)}{unit && <span className='unit'>&thinsp;{unit}</span>}</div>
            </DialogRow>
        );
    }
};

const drawIcon=(canvas:HTMLCanvasElement,current:AisItem)=>{
    if (! canvas) return;
    if (! current) return;
    const drawing=new Drawing({
        coordToPixel:(p:[number,number])=>{return p;},
        pixelToCoord:(p:[number,number])=>{return p;}
    },globalStore.getData(keys.properties.style.useHdpi,false));
    const ctx=canvas.getContext('2d');
    drawing.setContext(ctx);
    const rect=canvas.getBoundingClientRect();
    canvas.width=rect.width;
    canvas.height=rect.height;
    const [style,symbol]=mapholder.aislayer.getStyleEntry(current);
    if (! style || ! symbol) return;
    drawing.drawImageToContext([rect.width/2,rect.height/2],symbol.image,style);
    if (globalStore.getData(keys.properties.aisUseCourseVector) && current.speed > globalStore.getData(keys.properties.aisMinDisplaySpeed) && current.course !== undefined){
        const rd=Math.PI*current.course/180.0;
        const ty = rect.height/2-Math.cos(rd)*rect.height;
        const tx= rect.width/2+Math.sin(rd)*rect.width;
        drawing.drawLineToContext([[rect.width/2,rect.height/2],[tx,ty]],{...style,color:style.courseVectorColor, width: globalStore.getData(keys.properties.navCircleWidth)})
    }
}

interface AisStatusProps{
    mmsi:string,
    onClick?:(ev:SyntheticEvent)=>void;
}

const AisStatus = (iprops:AisStatusProps)=> {
    const sprops:FetchedItem & AisStatusProps =useStore(iprops,{storeKeys:storeKeys,updateFunction:createUpdateFunction({},iprops.mmsi)});
    return <canvas
        className="status"
        ref={(ctx)=>{drawIcon(ctx,sprops.current)}}
        onClick={sprops.onClick}
    />
};
export interface ShowAisItemInfoProps{
    mmsi: string,
    onClick?: (ev:SyntheticEvent) => void,
    className?: string
    scrollable?: boolean
}

export const ShowAisItemInfo=(props:ShowAisItemInfoProps)=>{
    return (
    <React.Fragment>
        <DialogRow>
        <AisStatus {...props}/>
        </DialogRow>
        <ItemList
            itemCreator={(config:AisItem)=>{return createItem(config,props.mmsi)}}
            itemList={displayItems}
            scrollable={props.scrollable}
            className={Helper.concatsp("infoList",props.className)}
            onClick={props.onClick}
        />

    </React.Fragment>
    )
}

export interface AisInfoDialogProps{
    mmsi:string;
    onClick?:(ev:SyntheticEvent) => void;
    buttons?:DialogButtonDef[];
    className?:string
}

export const AisInfoDialog=({mmsi,onClick,buttons,className}:AisInfoDialogProps)=>{
    const dialogContext=useDialogContext();
    if (! onClick) onClick=()=>{
        dialogContext.closeDialog();
    }
    const buttonList=buttons?buttons.concat([DBCancel()]):[DBCancel()];
    return <DialogFrame className={Helper.concatsp("aisInfoDialog",className)}>
        <DialogFlexInner className={"aisInfoFrame"} >
            <ShowAisItemInfo mmsi={mmsi} onClick={onClick}/>
        </DialogFlexInner>
        <DialogButtons buttonList={buttonList}></DialogButtons>
    </DialogFrame>
};


const getTarget=(mmsi?:string)=>{
    if (! mmsi) return;
    return NavData.getAisHandler().getAisByMmsi(mmsi);
}

export interface AisInfoWithFunctionProps{
    mmsi:string;
    actionCb:(kind:string,item:string) => void;
    buttons?:DialogButtonDef[];
    className?:string;
    hidden?:{
        AisNearest?:boolean;
        AisInfoLocate?:boolean;
        AisInfoHide?:boolean;
        AisInfoList?:boolean;
    }
}

export const aisNearestAction=()=>{
    NavData.getAisHandler().setTrackedTarget(0);
    const pos=NavData.getAisHandler().getAisPositionByMmsi(NavData.getAisHandler().getTrackedTarget());
    if (pos) mapholder.setCenter(pos);
}
export const AisInfoWithFunctions=(
    {mmsi,actionCb,buttons,hidden,className}:AisInfoWithFunctionProps)=>{
    const runCb=(action:string,item:string)=>{
        if (actionCb) actionCb(action,item);
    }
    const hiddenButtons=hidden||{};
    const pButtons:DialogButtonDef[] = [
        {
            ...ButtonDefs.AisNearest,
            onClick:()=>{
                aisNearestAction();
                runCb('AisNearest',mmsi);
            },
            disabled: mmsi === undefined,
            visible: ! hiddenButtons.AisNearest && (mapholder.getCurrentChartEntry() !== undefined),
        },
        {
            ...ButtonDefs.AisInfoLocate,
            onClick: ()=>{
                NavData.getAisHandler().setTrackedTarget(mmsi);
                const pos=NavData.getAisHandler().getAisPositionByMmsi(mmsi);
                if (pos) {
                    mapholder.setCenter(pos);
                    mapholder.setGpsLock(LOCK_MODES.off);
                }
                runCb('AisInfoLocate',mmsi);
            },
            disabled: mmsi === undefined,
            visible: ! hiddenButtons.AisInfoLocate && (mapholder.getCurrentChartEntry() !== undefined)
        },
        {
            ...ButtonDefs.AisInfoHide,
            onClick: () => {
                const target = getTarget(mmsi);
                if (!target) return;
                if (target.hidden) {
                    NavData.getAisHandler().unsetHidden(target.mmsi);
                } else {
                    NavData.getAisHandler().setHidden(target.mmsi);
                }
                runCb('AisInfoHide',mmsi);
            },
            storeKeys: storeKeys,
            updateFunction: ()=>{
                const target=getTarget(mmsi)||{};
                return {toggle:target.hidden};
            },
            visible: !hiddenButtons.AisInfoHide
        },
        {
            ...ButtonDefs.AisItems,
            onClick:()=>{
                runCb('AisInfoList',mmsi)
            },
            visible: mmsi !== undefined && actionCb !== undefined && ! hiddenButtons.AisInfoList,
            disabled: mmsi === undefined || actionCb === undefined
        },

    ]
    return <AisInfoDialog
        mmsi={mmsi}
        buttons={buttons?pButtons.concat(buttons):pButtons}
        className={className}
        />
}