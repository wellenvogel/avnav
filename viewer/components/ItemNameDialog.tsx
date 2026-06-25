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
 * generic dialog to select an item name
 */

import React, {ReactNode, useCallback, useEffect, useRef, useState} from "react";
import {
    DBCancel,
    DBOk, DialogButtonDef,
    DialogButtons,
    DialogFrame,
    DialogRow,
    promiseResolveHelper
} from "./OverlayDialog";
import {Checkbox, Input, valueMissing} from "./Inputs";
import Helper from "../util/helper";
import formatter from "../util/formatter";
import {useDialogContext} from "./DialogContext";
import ButtonDefs from "./ButtonDefs";
import {Item} from "../util/itemFunctions";

export const nameProposal=(prefix?:string)=>{
    const dt=new Date();
    return (prefix||'')+formatter.formatDateTime(dt).replace(/[: /]/g,'');
}

export type CheckNameResult= {
    error?:string;
    proposal?:string;
    info?:string;
    name?:string;
}
export type CheckNameFunction=(name:string,allowOverwrite?:boolean) => (CheckNameResult|Promise<CheckNameResult>);
export interface ItemNameDialogResult{
    name?:string
}
export interface ItemNameDialogProps {
    iname: string,
    resolveFunction: (res:ItemNameDialogResult)=>(boolean|Promise<void>),
    fixedExt?:string, 
    fixedPrefix?: string,
    title?: ReactNode, 
    mandatory?:boolean| ((name?:string)=>boolean), //true if it is mandatory but not yet 
    checkName?:CheckNameFunction,
    keepExtension?:boolean,
    additionalButtons?:DialogButtonDef[],
    showAllowOverwrite?:boolean,
}

export const ItemNameDialog = ({iname, resolveFunction, fixedExt,
                                   fixedPrefix,title, mandatory, checkName,
                                   keepExtension,additionalButtons,showAllowOverwrite}:ItemNameDialogProps) => {
    const fixedExtRef=useRef(undefined);
    if (keepExtension && fixedExtRef.current === undefined) {
        const [,ext] = Helper.getNameAndExt(iname || '');
        fixedExtRef.current = ext||'';
    }
    const removeFixedExt=useCallback((name:string)=>{
        if (! name || ! keepExtension) return name;
        if (! fixedExtRef.current) return name;
        if (Helper.getExt(name) !== fixedExtRef.current) return name;
        return name.substring(0,name.length-fixedExtRef.current.length-1);
    },[keepExtension]);
    const fullName=useCallback((name:string)=>{
        if (!fixedExtRef.current ) return name;
        return name+'.'+fixedExtRef.current;
    },[])
    const [name, setName] = useState(iname ||'');
    const [error, setError] = useState<string>();
    const [proposal,setProposal]=useState<string>();
    const [info,setInfo]=useState<string>();
    const [allowOverwrite,setAllowOverwrite]=useState<boolean>(false);
    const dialogContext = useDialogContext();
    const parametersFromCheck=useRef<CheckNameResult>();
    const titlevalue = title ? title : (iname ? "Modify FileName" : "Create FileName");
    let mandatoryFunction:(name:string)=>boolean;
    if (mandatory){
        if (typeof(mandatory) === 'function') mandatoryFunction=mandatory;
        else mandatoryFunction=(name:string)=>(name === undefined || name === null || ! name);
    }
    useEffect(() => {
        checkNameAndSet(name,allowOverwrite);
    }, []);
    const checkResult=useCallback((res?:CheckNameResult)=>{
        if (! res){
            setError(undefined);
            setProposal(undefined);
            setInfo(undefined);
        }
        else{
            if (typeof(res) ==='object') {
                setInfo(res.info);
                if (! res.error){
                    setError(undefined);
                    setProposal(undefined);
                    if ('name' in res){
                        setName(res.name)
                    }
                    parametersFromCheck.current=res;
                }
                else {
                    setError(res.error);
                    setProposal(res.proposal)
                }
            }
            else {
                setError(res);
                setProposal(undefined);
                setInfo(undefined);
            }
        }

    },[]);
    const checkNameAndSet=useCallback((name:string,allowOv:boolean)=>{
        if (!checkName) {
            checkResult();
            return;
        }
        const cr=checkName(name,allowOv);
        if (! (cr instanceof Promise)){
            checkResult(cr);
            return;
        }
        cr.then(()=>checkResult(),(err)=>checkResult(err));
    },[checkName,checkResult]);
    let buttonList:DialogButtonDef[]=[
        {
            ...ButtonDefs.DBClear,
          onClick: ()=>{
              const nn=fullName('');
              setName(nn);
              checkNameAndSet(nn,allowOverwrite);
          },
          close: false
        },
        DBCancel(),
        DBOk(() => {
            promiseResolveHelper({ok: dialogContext.closeDialog}, resolveFunction, {name:name});
        }, {close: false, disabled: valueMissing(mandatoryFunction, name) || !!error})
    ];
    if (proposal){
        buttonList.splice(0,0,{
            ...ButtonDefs.DBPropose,
            onClick: ()=>{
                const pname=proposal;
                setName(pname);
                checkNameAndSet(pname,allowOverwrite);
            },
            close:false
        })
    }
    if (additionalButtons){
        buttonList=additionalButtons.concat(buttonList);
    }
    const fixedSuffix=fixedExtRef.current?fixedExtRef.current:fixedExt;
    return <DialogFrame className={"itemNameDialog"} title={titlevalue}>
        <Input
            minSize={10}
            dialogRow={true}
            value={removeFixedExt(name)}
            onChange={(nv) => {
                nv=fullName(nv);
                setName(nv);
                checkNameAndSet(nv,allowOverwrite);
            }}
            className={error?'error':undefined}
            mandatory={mandatoryFunction}
            label={fixedPrefix?fixedPrefix:''}
        >
            {fixedSuffix && <span className={"ext"}>.{fixedSuffix}</span>}
        </Input>
        {error && <DialogRow className={"errorText"}><span className={'inputLabel'}></span>{error}</DialogRow>}
        {info && <DialogRow className={"info"}><span className={'inputLabel'}>{info}</span> </DialogRow>}
        {showAllowOverwrite && <Checkbox
            label={'allow overwrite'}
            dialogRow={true}
            onChange={(nv:boolean) => {setAllowOverwrite(nv); checkNameAndSet(name,nv)}}
            value={allowOverwrite}/>}
        <DialogButtons buttonList={buttonList}/>
    </DialogFrame>
};

export const safeName=(name:string)=>{
    if (! name) return;
    return name.replace(/[\u0000-\u001f\u007f"*/:<>?\\|]/g,'');
}
export const TMP_PRFX="__avn.";
/**
 * check a name for existance in a list of items
 * if it already exists try to build a name (by appending numbers) that does not exists
 * @param name the name to check
 * @param itemList the list of items
 * @param [opt_idx]{string|function} the value of each item to be checked, defaults to "name"
 * @param [opt_checkAllowed] set to false to disable the check for allowed file names
 * @param opt_notEmpty error if empty
 * @returns {{proposal: *, error: string}} - returns an object with name only if ok
 */
export const checkName=(name:string,
                        itemList?:Item[],
                        opt_idx?:string|((item:Item) => string),
                        opt_checkAllowed?:boolean,
                        opt_notEmpty?:boolean): CheckNameResult=>{
    if (opt_notEmpty){
        if (!name || name.match(/^ *$/)) return {
            error:"must not be empty"
        }
    }
    if (! name) return;
    let rt:CheckNameResult=undefined;
    if (opt_checkAllowed !== false){
        if (Helper.startsWith(name,TMP_PRFX)){
            rt= {
                error: `name must not start with ${TMP_PRFX}`,
                proposal: name.substring(TMP_PRFX.length)
            }
        }
        if (! rt) {
            const check = safeName(name);
            if (check !== name) {
                rt = {
                    error: 'name contains illegal characters',
                    proposal: check
                }
            }
        }
    }
    if (! rt ) {
        rt= checkNameList(name,itemList,opt_idx);
        if (! rt) return {name:name};
        rt.name=name;
        return rt;
    }
    rt.name=name;
    if (! rt.proposal) return rt;
    const finalCheck=checkNameList(rt.proposal,itemList,opt_idx);
    if (! finalCheck) return rt;
    if (finalCheck.proposal) rt.proposal=finalCheck.proposal;
    return rt;
}

const checkNameList=(name:string,itemList?:Item[],opt_idxfct?:((item:Item)=>string)|string):CheckNameResult=>{
    if (! (itemList instanceof Array)) return;
    let exists=false;
    let maxNum=1;
    const [fn,ext]=Helper.getNameAndExt(name);
    if (! fn) return;
    let idfct:(item:Item)=>string;
    if (!opt_idxfct) {
        idfct = ((data: Item) => data ? data.name : undefined)
    }
    else{
        if (typeof(opt_idxfct) === "string"){
            idfct=(data)=>data?data[opt_idxfct]:data;
        }
        else{
            idfct=opt_idxfct;
        }
    }
    let prfx=fn.replace(/\d*$/,'');
    if (! prfx) prfx=fn;
    for (let i=0;i<itemList.length;i++) {
        const v=idfct(itemList[i]);
        if (! v) continue;
        if (Helper.startsWith(v,prfx) && Helper.endsWith(v,ext)){
            const n=parseInt(v.substring(prfx.length));
            if (!isNaN(n) && n >= maxNum) maxNum=n+1;
        }
        if (v ===name) exists=true;
    }
    if (exists){
        return {
            error: "file "+name+" already exists",
            proposal:prfx+maxNum+(ext?'.'+ext:'')
        }
    }
}