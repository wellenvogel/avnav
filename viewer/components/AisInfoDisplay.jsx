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
import NavData from "../nav/navdata";
import keys from "../util/keys";
import {useStore} from "../hoc/Dynamic";
import AisFormatter from "../nav/aisformatter";
import globalStore from "../util/globalstore";
import React from "react";
import {Drawing} from "../map/drawing";
import MapHolder, {LOCK_MODES} from "../map/mapholder";
import ItemList from "./ItemList";
import {DBCancel, DialogButtons, DialogFrame, DialogRow, useDialogContext} from "./OverlayDialog";
import PropTypes from "prop-types";
import Helper from "../util/helper";

const displayItems = [
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

const createUpdateFunction=(config,mmsi)=>{
    return (state)=>{
        if (!mmsi) return {current:undefined,...config};
        return {current:NavData.getAisHandler().getAisByMmsi(mmsi),...config};
    }
};
export const storeKeys={
    aisSequence:keys.nav.ais.updateCount
};
const createItem=(config,mmsi)=>{
    let cl="aisData";
    if (config.addClass)cl+=" "+config.addClass;
    return (iprops)=> {
        const props=useStore({...iprops,storeKeys:storeKeys,updateFunction:createUpdateFunction(config,mmsi)});
        let key = props.name;
        if (! AisFormatter.shouldShow(key,props.current)){
            return null;
        }
        let target = props.current;
        if (typeof(target) == 'undefined') { return null; }
        let unit = AisFormatter.getUnit(props.name);
        let clazz = 'aisInfoRow';
        let warning = target.warning && (key.includes('cpa') || key.includes('pass'));
        let warningDist = globalStore.getData(keys.properties.aisWarningCpa);
        let warningTime = globalStore.getData(keys.properties.aisWarningTpa);
        let hideAge = globalStore.getData(keys.properties.aisLostTime)
        if((key.includes('pass') && warning)
            || (0 < target.tcpa && target.cpa < warningDist && (key=='cpa' || (key=='tcpa' && target.tcpa < warningTime)))
            || (key === 'age' && target.age > hideAge )
        ){
            clazz += ' aisWarning';
        }
        return (
            <div className={clazz}>
                <div className='label'>{AisFormatter.getHeadline(key)}</div>
                <div className={cl}>{AisFormatter.format(key, props.current)}{unit && <span className='unit'>&thinsp;{unit}</span>}</div>
            </div>
        );
    }
};

const drawIcon=(canvas,current)=>{
    if (! canvas) return;
    if (! current) return;
    let drawing=new Drawing({
        coordToPixel:(p)=>{return p;},
        pixelToCoord:(p)=>{return p;}
    },globalStore.getData(keys.properties.style.useHdpi,false));
    let ctx=canvas.getContext('2d');
    drawing.setContext(ctx);
    let rect=canvas.getBoundingClientRect();
    canvas.width=rect.width;
    canvas.height=rect.height;
    let [style,symbol,scale]=MapHolder.aislayer.getStyleEntry(current);
    if (! style || ! symbol) return;
    drawing.drawImageToContext([rect.width/2,rect.height/2],symbol.image,style);
    if (globalStore.getData(keys.properties.aisUseCourseVector) && current.speed > globalStore.getData(keys.properties.aisMinDisplaySpeed) && current.course !== undefined){
        let rd=Math.PI*current.course/180.0;
        let ty = rect.height/2-Math.cos(rd)*rect.height;
        let tx= rect.width/2+Math.sin(rd)*rect.width;
        drawing.drawLineToContext([[rect.width/2,rect.height/2],[tx,ty]],{...style,color:style.courseVectorColor, width: globalStore.getData(keys.properties.navCircleWidth)})
    }
}

const AisStatus = (iprops)=> {
    const props=useStore(iprops,{storeKeys:storeKeys,updateFunction:createUpdateFunction({},iprops.mmsi)});
    return <canvas
        className="status"
        ref={(ctx)=>{drawIcon(ctx,props.current)}}
        onClick={props.onClick}
    />
};

export const ShowAisItemInfo=(props)=>{
    return (
    <React.Fragment>
        <AisStatus {...props}/>
        <ItemList
            itemCreator={(config)=>{return createItem(config,props.mmsi)}}
            itemList={displayItems}
            scrollable={props.scrollable}
            className={Helper.concatsp("infoList",props.className)}
            onClick={props.onClick}
        />

    </React.Fragment>
    )
}
ShowAisItemInfo.propTypes={
    mmsi: PropTypes.string.isRequired,
    onClick: PropTypes.func,
    className: PropTypes.string
}

export const AisInfoDialog=({mmsi,onClick,buttons,className})=>{
    const dialogContext=useDialogContext();
    if (! onClick) onClick=()=>{
        dialogContext.closeDialog();
    }
    const buttonList=buttons?buttons.concat([DBCancel()]):[DBCancel()];
    return <DialogFrame className={Helper.concatsp("aisInfoDialog",className)}>
        <DialogRow ref={(el)=>{
            if (el) el.scrollTop=-el.scrollHeight;
        }}>
            <ShowAisItemInfo mmsi={mmsi} onClick={onClick}/>
        </DialogRow>
        <DialogButtons buttonList={buttonList}></DialogButtons>
    </DialogFrame>
};

AisInfoDialog.propTypes={
    mmsi: PropTypes.string.isRequired,
    onClick: PropTypes.func,
    buttons: PropTypes.array,
    className: PropTypes.string
}

const getTarget=(mmsi)=>{
    if (! mmsi) return;
    return NavData.getAisHandler().getAisByMmsi(mmsi);
}

export const AisInfoWithFunctions=({mmsi,actionCb,buttons,hidden,className})=>{
    const runCb=(action,item)=>{
        if (actionCb) actionCb(action,item);
    }
    const hiddenButtons=hidden||{};
    const pButtons=[
        {
            name: 'AisNearest',
            onClick:()=>{
                NavData.getAisHandler().setTrackedTarget(0);
                let pos=NavData.getAisHandler().getAisPositionByMmsi(NavData.getAisHandler().getTrackedTarget());
                if (pos) MapHolder.setCenter(pos);
                runCb('AisNearest',mmsi);
            },
            label: 'Nearest',
            disabled: mmsi === undefined,
            visible: ! hiddenButtons.AisNearest,
        },
        {
            name: 'AisInfoLocate',
            onClick: ()=>{
                NavData.getAisHandler().setTrackedTarget(mmsi);
                let pos=NavData.getAisHandler().getAisPositionByMmsi(mmsi);
                if (pos) {
                    MapHolder.setCenter(pos);
                    MapHolder.setGpsLock(LOCK_MODES.off);
                }
                runCb('AisInfoLocate',mmsi);
            },
            label: 'Locate',
            disabled: mmsi === undefined,
            visible: ! hiddenButtons.AisInfoLocate
        },
        {
            name: 'AisInfoHide',
            onClick: () => {
                let target = getTarget(mmsi);
                if (!target) return;
                if (target.hidden) {
                    NavData.getAisHandler().unsetHidden(target.mmsi);
                } else {
                    NavData.getAisHandler().setHidden(target.mmsi);
                }
                runCb('AisInfoHide',mmsi);
            },
            label: 'Hide',
            storeKeys: storeKeys,
            updateFunction: ()=>{
                let target=getTarget(mmsi)||{};
                return {toggle:target.hidden};
            },
            visible: !hiddenButtons.AisInfoHide
        },
        {
            name: 'AisInfoList',
            onClick:()=>{
                runCb('AisInfoList',mmsi)
            },
            label: 'List',
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