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
import React from "react";
import {showDialog, DialogFrame,DialogRow,useDialogContext,DialogButtons,DBCancel} from "./OverlayDialog";
import Helper, {getav, setav} from "../util/helper";
import EditableParameterUIFactory,{EditableParameterListUI} from './EditableParameterUI';

export const ParameterDialog = (props) => {
    const [values, setValues] = React.useState(props.values||{});
    const dialogContext=useDialogContext();
    const className=Helper.concatsp("ParameterDialog",props.className)
    const buttons=[];
    if (!props.buttons) {
        buttons.push(DBCancel());
    }
    else{
        props.buttons.forEach(button => {
            buttons.push({
                ...button,
                onClick:(ev)=>{
                    if (button.onClick) button.onClick(ev,values);
                }
            })
        })
    }
    return <DialogFrame title={props.title||"Edit"} className={className}>
        {props.text && <DialogRow>{props.text}</DialogRow>}
        {props.parameters && <EditableParameterListUI
            values={values}
            parameters={props.parameters}
            initialValues={props.values||{}}
            onChange={(nv)=>{
                if (props.onChange) props.onChange(setav({},{dialogContext:dialogContext}),nv);
                setValues({...values,...nv});
            }}
            />
            }
        <DialogButtons buttonList={buttons}/>

    </DialogFrame>

}
/**
 *
 * @param config {DialogConfig}
 * @param dialogContext
 */
export const showParameterDialog = (dialogContext,config,opt_cancelCb) => {
    if (dialogContext) {
        if (! dialogContext.showDialog) {
            if (!dialogContext.current){
                const evctx=getav(dialogContext).dialogContext;
                if (evctx && evctx.showDialog) {
                    dialogContext=evctx;
                }
            }
        }
    }
    const parameters=[];
    if (Array.isArray(config.parameters)){
        config.parameters.forEach(item=>{
            parameters.push(EditableParameterUIFactory.createEditableParameterUI(item));
        })
    }
    else{
        if (config.parameters){
            throw new Error("config.parameters must be an array");
        }
    }
    if (config.buttons && ! Array.isArray(config.buttons)){
        throw new Error("config.buttons must be an array");
    }
    showDialog(dialogContext, (dp)=><ParameterDialog {...dp}{...config} parameters={parameters}/>,opt_cancelCb);
}
//@type {DialogConfig}
ParameterDialog.propTypes = {

}