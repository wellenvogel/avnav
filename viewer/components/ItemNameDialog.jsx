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

import React, {useCallback, useState} from "react";
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

export const ItemNameDialog = ({iname, resolveFunction, fixedExt, title, mandatory, checkName}) => {
    const [name, setName] = useState(iname);
    const [error, setError] = useState();
    const [proposal,setProposal]=useState();
    const dialogContext = useDialogContext();
    const titlevalue = title ? title : (iname ? "Modify FileName" : "Create FileName");
    const completeName = (nn) => {
        if (!fixedExt) return nn;
        return nn + "." + fixedExt;
    }
    const nameChecker=useCallback((name)=>{
        if (! checkName) return Promise.resolve();
        const cr=checkName(name);
        if (cr instanceof Promise) return cr;
        if (! cr) return Promise.resolve();
        return Promise.reject(cr);
    },[checkName])
    const checkNameAndSet=useCallback((name)=>{
        nameChecker(name)
            .then(()=>{
                setError(undefined);
                setProposal(undefined);
            })
            .catch((ev)=>{
                if (ev instanceof Object) {
                    setError(ev.error);
                    setProposal(ev.proposal)
                }
                else {
                    setError(ev);
                    setProposal(undefined);
                }
            })
    },[nameChecker])
    const buttonList=[
        DBCancel(),
        DBOk(() => {
            promiseResolveHelper({ok: dialogContext.closeDialog}, resolveFunction, completeName(name));
        }, {close: false, disabled: valueMissing(mandatory, name) || !!error})
    ];
    if (proposal){
        buttonList.splice(0,0,{
            name: 'Propose',
            label: 'Propose',
            onClick: ()=>{
                let pname=proposal;
                if (fixedExt){
                    if (Helper.endsWith(proposal,fixedExt)){
                        pname=proposal.substring(0,proposal.length-fixedExt.length-1);
                    }
                }
                setName(pname);
                checkNameAndSet(proposal);
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
            mandatory={mandatory}
            checkFunction={(n) => nameChecker(completeName(n))}
        >
            {fixedExt && <span className={"ext"}>.{fixedExt}</span>}
        </Input>
        {error && <DialogRow className={"errorText"}><span className={'inputLabel'}></span>{error}</DialogRow>}
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