/**
 * # Copyright (c) 2012-2025 Andreas Vogel andreas@wellenvogel.net
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
 */
 import React, {SyntheticEvent, useRef} from 'react';
import {getItemIconProperties, Item, listItems} from "../util/itemFunctions";
import {Icon, ListItem, ListMainSlot, ListSlot, useDialogContext, useStoreState} from "./exports";
import Helper, {avitem, concatsp, setav} from "../util/helper";
import {useTimer} from "../util/UiHelper";
import Toast from "./Toast";
import ItemList from "./ItemList";
// @ts-ignore
import {createItemActions} from './FileDialog';
import {DBCancel, DialogButtons, DialogFrame} from "./OverlayDialog";
import {ButtonEvent} from "./Button";
import {DialogButtonProps} from "./DialogButton";
// @ts-ignore
import EditOverlaysDialog from "./EditOverlaysDialog";
import keys from "../util/keys";
import globalstore from "../util/globalstore";


const ITEM_TYPE='chart'

export interface ChartItemProps extends Item{
    actions:any,
    onClick:(ev:SyntheticEvent) => void,
    overlayClick?:(ev:SyntheticEvent) => void,
}
export const ChartItem=(props:ChartItemProps)=>{
    const iconProperties=getItemIconProperties(props);
    return <ListItem
        className={concatsp(
            props.actions.getClassName(props),
            props.className,
            props.hasOverlay?"withOverlays":"noOverlays",
            props.originalScheme?"userAction":undefined,
        )}
        selected={props.selected}
        onClick={(ev)=>props.onClick && props.onClick(setav(ev, {action: 'select'}))}
    >
        <ListSlot><Icon {...iconProperties}/></ListSlot>
        <ListMainSlot
            primary={props.actions.getInfoText(props)}
            secondary={props.actions.getTimeText(props)}
        >
        </ListMainSlot>
        {props.overlayClick &&<ListSlot
            icon={{className:'MainOverlays'}}
            onClick={(ev:SyntheticEvent)=>{
                setav(ev,{item:props})
                ev.stopPropagation();
                props.overlayClick(ev);
            }}
        >
        </ListSlot>}
    </ListItem>
}
export interface ChartItemListProps{
    overlayClick?:(ev:SyntheticEvent) => void;
    itemClick:(ev:SyntheticEvent) => void;
    autoreload?:number;
    selected?:string;
}
export const ChartItemList=(props:ChartItemListProps)=>{
    const actions=createItemActions(ITEM_TYPE);
    const [selected,setSelected]=React.useState(props.selected);
    const [loading,setLoading]=React.useState(true);
    const selectedIndex=useRef(-1);
    const [itemList,setItemList]=React.useState<Item[]>([]);
    const timer=useTimer((seq:number)=>{
        listItems(ITEM_TYPE).then((charts:Item[])=>{
            if (!Array.isArray(charts)){
                setItemList([]);

            }
            else {
                let idx=-1;
                for (const chart of charts){
                    idx++;
                    if (selected && selected === chart.name){
                        selectedIndex.current=idx;
                    }
                    chart.overlayClick=props.overlayClick;
                    chart.actions=actions;
                }
                setItemList(charts);
                if (charts.length > 0){
                    setLoading(false);
                }
            }
            if (props.autoreload){ timer.startTimer(seq)}
        },
            (e)=>{
                Toast(e);
                if (props.autoreload){ timer.startTimer(seq)}
            })
    },props.autoreload||3000,true,true);
    if (loading){
        return <div className="loading">
            <div className="spinner"></div>
            <div className="text">Fetching Chartlist ...</div>
        </div>
    }
    return <ItemList
        scrollable={true}
        scrollSelected={1}
        itemList={itemList}
        selectedIndex={selectedIndex.current}
        itemClass={ChartItem}
        onItemClick={(ev:SyntheticEvent) => {
            if (props.itemClick) props.itemClick(ev);
            const item=avitem(ev);
            if (item) setSelected(item.name);
        }}

    />
}
export interface ChartSelectDialogProps {
    resolveFunction:(item:Item)=>void;
    selected?:string;
    className?:string;
    title?:string;
    hideAction?:(ev:ButtonEvent) => void;
}
export const ChartSelectDialog=(props:ChartSelectDialogProps)=>{
    const [online]=useStoreState(keys.gui.global.connectedMode);
    const dialogContext=useDialogContext();
    const overlayClick=online?(ev:SyntheticEvent) => {
        const item=avitem(ev);
        if (item && item.name){
            EditOverlaysDialog.createDialog(item,()=>{
                //trigger chart reload
                globalstore.storeData(keys.gui.global.chartEntrySequence,
                    globalstore.getData(keys.gui.global.chartEntrySequence,0)+1);
            },undefined,dialogContext)
        }
    }:undefined;
    const buttonList:DialogButtonProps[]=[DBCancel()];
    if (props.hideAction){
        buttonList.splice(0,0,{
            name:'HideOverlays',
            displayName:'hide all overlays',
            onClick:(ev:ButtonEvent)=>{
                props.hideAction(ev);
            }
        })
    }
    return <DialogFrame
        title={props.title||'Select Chart'}
        className={Helper.concatsp("ChartSelectDialog",props.className)}
        >
        <ChartItemList itemClick={(ev:SyntheticEvent) => {
            const item=avitem(ev);
            if (item){
                delete item.overlayClick;
                delete item.actions;
            }
            props.resolveFunction(item);
            dialogContext.closeDialog();
        }}
                       overlayClick={overlayClick}
                       selected={props.selected}
        />
        <DialogButtons
            buttonList={buttonList}
        />
    </DialogFrame>;
}