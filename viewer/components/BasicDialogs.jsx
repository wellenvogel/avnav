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
import {DBCancel, DBOk, DialogButtons, DialogFrame, DialogText, useDialogContext} from "./OverlayDialog";
import Helper from "../util/helper";

export const SelectList = ({list, onClick}) => {
    return <div className="selectList">
        {list.map(function (elem) {
            if (! (elem instanceof Object)) return null;
            let cl=Helper.concatsp('listEntry',elem.selected?'selectedItem':undefined,elem.className);
            return (
                <div className={cl}
                     onClick={() => onClick(elem)}
                     key={elem.value + ":" + elem.label}
                >
                    {elem.icon && <span className="icon" style={{backgroundImage: "url('" + elem.icon + "')"}}/>}
                    <span className="entryLabel">{elem.label}</span>
                </div>);
        })}
    </div>
}
export const SelectDialog = ({resolveFunction, title, list, optResetCallback, okCallback}) => {
    const dialogContext = useDialogContext();
    return (
        <DialogFrame className="selectDialog" title={title || ''}>
            <SelectList list={list} onClick={(elem) => {
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
export const ConfirmDialog = ({title, text, resolveFunction, children}) => {
    return <DialogFrame title={title || ''}>
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