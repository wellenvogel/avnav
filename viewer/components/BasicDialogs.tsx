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
 * basic dialog implementations
 */
import DB from "./DialogButton";
import React, {SyntheticEvent, useEffect, useState} from "react";
import {DBCancel, DBOk, DialogButtons, DialogFrame, DialogText} from "./OverlayDialog";
import Helper from "../util/helper";
import {getItemIconProperties} from "../util/itemFunctions";
import {ListFrame, ListItem, ListMainSlot, ListSlot} from "./ListItems";
import {useDialogContext} from "./DialogContext";
import {SelectListEntry} from "../util/EditableParameter";
import {ButtonEvent} from "./Button";
import ButtonDefs from "./ButtonDefs";

export const defaultSelectSort=(
    a:SelectListEntry,
    b:SelectListEntry)=>{
    if (typeof(a) !== 'object' || typeof (b) !== 'object') return 0;
    const av=(a.label||"").toUpperCase();
    const bv=(b.label||"").toUpperCase();
    if (av < bv) return -1;
    if (av > bv) return 1;
    return 0;
}
export interface SelectListProps{
    list:SelectListEntry[];
    onClick:(e:SelectListEntry)=>void;
    scrollable?:boolean;
    className?:string;
    sort?:(a:SelectListEntry,b:SelectListEntry)=>number;
}
export const SelectList = ({list, onClick,scrollable,className,sort}:SelectListProps) => {
    if (sort){
        list=[...list];
        if (typeof(sort)!=='function'){
            list.sort(defaultSelectSort);
        }
        else{
            list.sort(sort);
        }
    }
    return <ListFrame scrollable={scrollable} className={className}>
        {list.map(function (elem) {
            if (! (elem instanceof Object)) return null;
            const iconProperties=getItemIconProperties(elem);
            return (
                <ListItem
                    className={elem.className}
                    selected={elem.selected}
                    onClick={()=>onClick(elem)}
                    key={elem.value + ":" + elem.label}>
                    <ListSlot icon={iconProperties}></ListSlot>
                    <ListMainSlot>{elem.label}</ListMainSlot>
                </ListItem>
            )
        })}
    </ListFrame>
}
export interface SelectDialogProps{
    resolveFunction?:(el:SelectListEntry) => void;
    title?:React.ReactNode;
    list:SelectListEntry[];
    optResetCallback?:(ev:ButtonEvent) => void;
    okCallback?:(el:SelectListEntry) => void;
    className?:string;
    sort?:(a:SelectListEntry, b:SelectListEntry)=>number;
}
export const SelectDialog = (
    {resolveFunction, title, list, optResetCallback, okCallback,className,sort}:SelectDialogProps) => {
    const dialogContext = useDialogContext();
    return (
        <DialogFrame className={Helper.concatsp("selectDialog",className)} title={title || ''}>
            <SelectList list={list} sort={sort} onClick={(elem) => {
                dialogContext.closeDialog();
                if (resolveFunction) resolveFunction(elem);
                else if (okCallback) okCallback(elem);
            }}/>
            <DialogButtons>
                {optResetCallback && <DB
                    {...ButtonDefs.DBReset}
                    onClick={(ev) => {
                        optResetCallback(ev);
                    }}/>}
                <DB {...ButtonDefs.DBCancel}/>
            </DialogButtons>
        </DialogFrame>
    );

};
export interface ConfirmDialogProps{
    title?:React.ReactNode;
    text?:React.ReactNode;
    resolveFunction:(ev:SyntheticEvent) => void;
    className?:string;
    children?:React.ReactNode;
}
export const ConfirmDialog = (
    {title, text, resolveFunction, children,className}:ConfirmDialogProps) => {
    return <DialogFrame title={title || ''} className={className} >
        <div className="dialogText">{text}</div>
        {children}
        <DialogButtons buttonList={[
            DBCancel(),
            DBOk(resolveFunction )
        ]}/>
    </DialogFrame>
}
export interface AlertDialogProps{
    text:React.ReactNode;
    resolveFunction?:(ev:ButtonEvent) => void;
    className?:string;
    children?:React.ReactNode;
}
export const AlertDialog = (
    {text, resolveFunction,children,className}:AlertDialogProps) => {
    return <DialogFrame title={"Alert"} className={className}>
        <DialogText>{text}</DialogText>
        {children}
        <DialogButtons buttonList={DBOk(resolveFunction )}/>
    </DialogFrame>
}
export interface ValueDialogProps{
    value:string;
    label?:React.ReactNode;
    title?:React.ReactNode;
    clear?:boolean|((nv:string)=>string);
    resolveFunction?:(nv:string) => void;
    checkFunction?:(nv:string) => string|undefined|Promise<string|void>;
}
export const ValueDialog = (
    {value, label, title, clear, resolveFunction,checkFunction}:ValueDialogProps) => {
    const [nvalue, setValueImpl] = useState(value);
    const [error,setError]=useState(undefined)
    const setValue=(nv:string)=> {
        setValueImpl(nv);
        check(nv);
    }
    const check=(nv:string)=>{
        if (!checkFunction) return;
        const res=checkFunction(nv);
        if (!res){
            setError(undefined);
            return;
        }
        if (res instanceof Promise){
            res.then((pres)=>{
                setError(pres);
            },(err)=>setError(err))
            setError('checking');
            return;
        }
        setError(res);
    }
    useEffect(() => {
        check(nvalue);
    }, []);
    return (
        <DialogFrame title={title || 'Input'}>
            <div className="dialogRow">
                <span className="inputLabel">{label}</span>
                <input type="text" name="value" value={nvalue} onChange={(ev) => setValue(ev.target.value)}/>
            </div>
            {error !== undefined && <div className={'warning'}>{error}</div>}
            <DialogButtons>
                {clear && <DB {...ButtonDefs.DBClear} close={false}
                              onClick={() => setValue((typeof clear === "function") ? clear(nvalue) : '')}></DB>}
                <DB {...ButtonDefs.DBCancel}/>
                <DB {...ButtonDefs.DBOk} onClick={() => resolveFunction && resolveFunction(nvalue)} disabled={error !== undefined}/>
            </DialogButtons>
        </DialogFrame>
    );
}

export interface InfoItemProps{
    className?:string,
    label?:React.ReactNode;
    value?:React.ReactNode;
}
export const InfoItem = (props:InfoItemProps) => {
    return <div className={"dialogRow " + props.className}>
        <span className={"inputLabel"}>{props.label}</span>
        <span className={"itemInfo"}>{props.value}</span>
    </div>
}

InfoItem.show = (
    data:Record<string,any>,
    description:{
        value:string,
        formatter?:(v:any,data:Record<string,any>)=>string,
        label:string,
    }) => {
    let v = data[description.value];
    if (v === undefined) return null;
    if (description.formatter) {
        v = description.formatter(v, data);
        if (v === undefined) return null;
    }
    return <InfoItem label={description.label} value={v} key={description.label}/>
}