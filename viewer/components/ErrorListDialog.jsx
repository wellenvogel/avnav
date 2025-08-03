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
 * show a list of errors
 */
import {DBCancel, DialogButtons, DialogFrame, DialogRow, showDialog, useDialogContext} from "./OverlayDialog";
import React, {useState} from "react";
import PropTypes from "prop-types";
import Helper from "../util/helper";
import {AlertDialog} from "./BasicDialogs";

export const ErrorListDialog=({errors,title,className,refresh})=>{
    const [errorList,setErrorList]=useState(errors);
    const btlist=[];
    if (refresh){
        btlist.push({
            name:'reload',
            label:'Reload',
            onClick:()=>{
                const nl=refresh();
                setErrorList(nl);
            },
            close: false
        })
    }
    btlist.push(DBCancel());
    const dialogCtx=useDialogContext();
    return <DialogFrame
        className={Helper.concatsp(className,'ErrorListDialog')} title={title}>
        {(errorList instanceof Array) && errorList.map((error)=>{
            const lerror=error;
            return <DialogRow
            key={error.ts}
            onClick={()=>{
                if (lerror.details) {
                    showDialog(dialogCtx,()=><AlertDialog
                        className={'ErrorDetails'}
                        text={lerror.details}
                    />)
                }
            }}
        >
            <div className={'inputLabel'}>{(new Date(error.ts)).toLocaleTimeString()}</div>
            <div className={'value'}>{error.entry+""}</div>
        </DialogRow>})
        }
        <DialogButtons buttonList={btlist}/>
    </DialogFrame>
}

ErrorListDialog.propTypes={
    errors: PropTypes.array,
    title: PropTypes.element,
    className: PropTypes.string,
    refresh: PropTypes.func
}

export const showErrorList=({dialogCtx,title,className,fillFunction})=>{
    const errors=fillFunction();
    if ((errors instanceof Array) && (errors.length > 0)){
        showDialog(dialogCtx,()=><ErrorListDialog
            errors={errors}
            title={title}
            className={className}
            refresh={fillFunction}
        />)
    }
}