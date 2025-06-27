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

import React, {useCallback, useEffect, useRef, useState} from "react";
import {
    DBCancel,
    DBOk,
    DialogButtons,
    DialogFrame,
    DialogRow,
    promiseResolveHelper,
    useDialogContext
} from "./OverlayDialog";
import {Input, valueMissing} from "./Inputs";
import PropTypes from "prop-types";
import Helper from "../util/helper";
import formatter from "../util/formatter";

export const nameProposal=(prefix)=>{
    const dt=new Date();
    return (prefix||'')+formatter.formatDateTime(dt).replace(/[: /]/g,'');
}
export const shrinkName=(name,fixedPrefix,fixedExt)=>{
    if (!name) return name;
    let rt=name;
    if (fixedPrefix) {
        if (Helper.startsWith(rt, fixedPrefix)) rt=rt.substring(fixedPrefix.length);
    }
    if (fixedExt){
        if (Helper.endsWith(rt,"."+fixedExt)){
            rt=rt.substring(0,rt.length-fixedExt.length-1)
        }
    }
    return rt;
}

export const ItemNameDialog = ({iname, resolveFunction, fixedExt, fixedPrefix,title, mandatory, checkName}) => {
    const [name, setName] = useState(()=>shrinkName(iname||'',fixedPrefix,fixedExt));
    const [error, setError] = useState();
    const [proposal,setProposal]=useState();
    const [info,setInfo]=useState();
    const dialogContext = useDialogContext();
    const parametersFromCheck=useRef();
    const titlevalue = title ? title : (iname ? "Modify FileName" : "Create FileName");
    const completeName = (nn) => {
        if (!fixedExt) return (fixedPrefix?fixedPrefix:'')+nn;
        return (fixedPrefix?fixedPrefix:'')+nn + "." + fixedExt;
    }
    let mandatoryFunction=false;
    if (mandatory){
        if (typeof(mandatory) === 'function') mandatoryFunction=mandatory;
        else mandatoryFunction=(name)=>(name === undefined || name === null || ! name);
    }
    useEffect(() => {
        checkNameAndSet(completeName(name));
    }, []);
    const checkResult=useCallback((res)=>{
        if (! res){
            setError(undefined);
            setProposal(undefined);
            setInfo(undefined);
        }
        else{
            if (res instanceof Object) {
                setInfo(res.info);
                if (! res.error){
                    setError(undefined);
                    setProposal(undefined);
                    if ('name' in res){setName(res.name)}
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
    const checkNameAndSet=useCallback((name)=>{
        if (!checkName) {
            checkResult();
            return;
        }
        const cr=checkName(name);
        if (! (cr instanceof Promise)){
            checkResult(cr);
            return;
        }
        cr.then(()=>checkResult(),(err)=>checkResult(err));
    },[checkName,checkResult])
    const buttonList=[
        {
          name:'reset',
          label:'Clear',
          onClick: ()=>{
              setName('');
              checkNameAndSet(completeName(''));
          },
          close: false
        },
        DBCancel(),
        DBOk(() => {
            promiseResolveHelper({ok: dialogContext.closeDialog}, resolveFunction, {name:completeName(name)});
        }, {close: false, disabled: valueMissing(mandatoryFunction, name) || !!error})
    ];
    if (proposal){
        buttonList.splice(0,0,{
            name: 'Propose',
            label: 'Propose',
            onClick: ()=>{
                let pname=shrinkName(proposal,fixedPrefix,fixedExt);
                setName(pname);
                checkNameAndSet(completeName(pname));
            },
            close:false
        })
    }
    return <DialogFrame className={"itemNameDialog"} title={titlevalue}>
        <Input
            dialogRow={true}
            value={name}
            onChange={(nv) => {
                setName(nv);
                checkNameAndSet(completeName(nv));
            }}
            className={error?'error':undefined}
            mandatory={mandatoryFunction}
            label={fixedPrefix?fixedPrefix:''}
        >
            {fixedExt && <span className={"ext"}>.{fixedExt}</span>}
        </Input>
        {error && <DialogRow className={"errorText"}><span className={'inputLabel'}></span>{error}</DialogRow>}
        {info && <DialogRow className={"info"}><span className={'inputLabel'}>{info}</span> </DialogRow>}
        <DialogButtons buttonList={buttonList}/>
    </DialogFrame>
};

ItemNameDialog.propTypes={
    iname: PropTypes.string,
    resolveFunction: PropTypes.func, //must return true to close the dialog
    checkName: PropTypes.func, //if provided: return an error text if the name is invalid
                               //can also return an object with error, proposal to propose a new name
                               //can return a promise - resolve means ok, reject like return object/string
    title: PropTypes.func, //use this as dialog title
    mandatory: PropTypes.oneOfType([PropTypes.bool,PropTypes.func]), //return true if the value is mandatory but not set
    fixedExt: PropTypes.string //set a fixed extension
}
export const safeName=(name)=>{
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
 * @returns {{proposal: *, error: string}} - returns undefined if ok
 */
export const checkName=(name,itemList,opt_idx,opt_checkAllowed)=>{
    if (! name) return;
    let rt=undefined;
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
    if (! rt ) return checkNameList(name,itemList,opt_idx);
    if (! rt.proposal) return rt;
    const finalCheck=checkNameList(rt.proposal,itemList,opt_idx);
    if (! finalCheck) return rt;
    if (finalCheck.proposal) rt.proposal=finalCheck.proposal;
    return rt;
}

const checkNameList=(name,itemList,opt_idxfct)=>{
    if (! (itemList instanceof Array)) return;
    let exists=false;
    let maxNum=1;
    const [fn,ext]=Helper.getNameAndExt(name);
    if (! fn) return;
    if (! opt_idxfct) opt_idxfct=(data)=>data?data.name:data;
    else{
        if (typeof(opt_idxfct) !== "function"){
            opt_idxfct=(data)=>data?data[opt_idxfct]:data;
        }
    }
    let prfx=fn.replace(/\d*$/,'');
    if (! prfx) prfx=fn;
    for (let i=0;i<itemList.length;i++) {
        const v=opt_idxfct(itemList[i],name);
        if (! v) continue;
        if (Helper.startsWith(v,prfx) && Helper.endsWith(v,ext)){
            let n=parseInt(v.substring(prfx.length));
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