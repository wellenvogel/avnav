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
import React, {useEffect, useState} from "react";
import {DBCancel, DBOk, DialogButtons, DialogFrame, DialogText} from "./OverlayDialog";
import Helper from "../util/helper";
import {getItemIconProperties} from "../util/itemFunctions";
import {ListFrame, ListItem, ListMainSlot, ListSlot} from "./ListItems";
import {useDialogContext} from "./DialogContext";

export const defaultSelectSort=(a,b)=>{
    if (typeof(a) !== 'object' || typeof (b) !== 'object') return 0;
    const av=(a.label||"").toUpperCase();
    const bv=(b.label||"").toUpperCase();
    if (av < bv) return -1;
    if (av > bv) return 1;
    return 0;
}

export const SelectList = ({list, onClick,scrollable,className,sort}) => {
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
export const SelectDialog = ({resolveFunction, title, list, optResetCallback, okCallback,className,sort}) => {
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
                    name="reset"
                    onClick={(ev) => {
                        optResetCallback(ev);
                    }}
                >Reset</DB>}
                <DB name="cancel"
                >Cancel</DB>
            </DialogButtons>
        </DialogFrame>
    );

};
export const ConfirmDialog = ({title, text, resolveFunction, children,className}) => {
    return <DialogFrame title={title || ''} className={className} >
        <div className="dialogText">{text}</div>
        {children}
        <DialogButtons buttonList={[
            DBCancel(),
            DBOk(resolveFunction )
        ]}/>
    </DialogFrame>
}
export const AlertDialog = ({text, resolveFunction,children,className}) => {
    return <DialogFrame title={"Alert"} className={className}>
        <DialogText>{text}</DialogText>
        {children}
        <DialogButtons buttonList={DBOk(resolveFunction )}/>
    </DialogFrame>
}
export const ValueDialog = ({value, label, title, clear, resolveFunction,checkFunction}) => {
    const [nvalue, setValueImpl] = useState(value);
    const [error,setError]=useState(undefined)
    const setValue=(nv)=> {
        setValueImpl(nv);
        check(nv);
    }
    const check=(nv)=>{
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
                {clear && <DB name="reset" close={false}
                              onClick={() => setValue((typeof clear === "function") ? clear(nvalue) : '')}>Clear</DB>}
                <DB name="cancel">Cancel</DB>
                <DB name="ok" onClick={() => resolveFunction && resolveFunction(nvalue)} disabled={error !== undefined}>Ok</DB>
            </DialogButtons>
        </DialogFrame>
    );
}

export const InfoItem = (props) => {
    return <div className={"dialogRow " + props.className}>
        <span className={"inputLabel"}>{props.label}</span>
        <span className={"itemInfo"}>{props.value}</span>
    </div>
}

InfoItem.show = (data, description) => {
    let v = data[description.value];
    if (v === undefined) return null;
    if (description.formatter) {
        v = description.formatter(v, data);
        if (v === undefined) return null;
    }
    return <InfoItem label={description.label} value={v} key={description.label}/>
}