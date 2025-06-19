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

import React, {useState} from "react";
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
            onClick: ()=>setName(proposal),
            close:false
        })
    }
    return <DialogFrame className={"itemNameDialog"} title={titlevalue}>
        <Input
            dialogRow={true}
            value={name}
            onChange={(nv) => {
                setName(nv);
                if (checkName) {
                    const ev=checkName(completeName(nv));
                    if (! ev) {
                        setError(undefined);
                        setProposal(undefined);
                    }
                    else {
                        if (ev instanceof Object) {
                            setError(ev.error);
                            setProposal(ev.proposal)
                        }
                        else {
                            setError(ev);
                            setProposal(undefined);
                        }
                    }
                }
            }}
            mandatory={mandatory}
            checkFunction={(n) => !checkName(completeName(n))}
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
    title: PropTypes.func, //use this as dialog title
    mandatory: PropTypes.oneOfType([PropTypes.bool,PropTypes.func]), //return true if the value is mandatory but not set
    fixedExt: PropTypes.string //set a fixed extension
}