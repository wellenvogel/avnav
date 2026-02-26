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
import React, {useCallback,} from "react";
// @ts-ignore
import {showDialog, DialogFrame,DialogRow,DialogButtons} from "./OverlayDialog";
// @ts-ignore
import Helper, {getav, setav} from "../util/helper";
// @ts-ignore
import EditableParameterUIFactory,{EditableParameterListUI} from './EditableParameterUI';
import {ErrorBoundary} from "./ErrorBoundary";
import {IDialogContext, useDialogContext} from "./DialogContext";
import {Button as TButton, DialogConfig, WidgetParameterValues} from '../api/api.interface';
import {UserHtml} from "./UserHtml";
import Headline from "./Headline";

type TEditableParameterUI=Record<string, any>;
export interface TParameterDialog extends Omit<DialogConfig, "parameters"> {
    parameters?: TEditableParameterUI[];
}
export const ParameterDialog = (props:TParameterDialog) => {
    const [values, setValues] = React.useState(props.values||{});
    const dialogContext=useDialogContext();
    const className=Helper.concatsp("ParameterDialog",props.className)
    const changeValues=useCallback((newValues:any)=>{
        if (! (newValues instanceof Object) || ! props.parameters) return;
        const changedValues:WidgetParameterValues={};
        for (const parameter of props.parameters) {
            const key=parameter.name;
            if (! key) continue;
            if (key in newValues){
                changedValues[key]=newValues[key];
            }
        }
        if (Object.keys(changedValues).length > 0) {
            setValues({...values,...changedValues});
        }
    },[props.values,props.parameters]);
    const buttons:Record<string,any>[]=[];
    if (props.buttons) {
        props.buttons.forEach((button:TButton) => {
            buttons.push({
                ...button,
                onClick: (ev:Event) => {
                    setav(ev, {dialogContext: dialogContext});
                    if (button.onClick) changeValues(button.onClick(ev, values, dialogContext.closeDialog));
                }
            })
        })
    }
    let dataValid=true;
    if (props.parameters) {
        props.parameters.forEach((parameter) => {
            if (parameter.hasError(values || {})) dataValid = false;
        })
    }
    if (! dataValid){
        buttons.forEach(button => {
            if (button.name === 'ok' && button.disabled === undefined){
                button.disabled = true;
            }
        })
    }
    let text;
    if (props.text){
        const tt=typeof props.text;
        if (tt !== "string") {
            text=`invalid type ${tt} for text, expected string`
        }
        else{
            text=props.text;
        }
    }
    return<ErrorBoundary>
    <DialogFrame title={props.title && ! props.fullscreen} className={className}>
        {(props.fullscreen && props.title) && <Headline title={props.title}/>}
        {text && <DialogRow>{text}</DialogRow>}
        <UserHtml userHtml={props.html} context={props.context}/>
        {props.parameters && <EditableParameterListUI
            values={values}
            parameters={props.parameters}
            initialValues={props.values||{}}
            onChange={(nv:any)=>{
                if (props.onChange) changeValues(props.onChange(setav({},{dialogContext:dialogContext}),nv));
                setValues({...values,...nv});
            }}
            />
            }
        <DialogButtons buttonList={buttons}/>

    </DialogFrame>
    </ErrorBoundary>

}
/**
 *
 * @param config {DialogConfig}
 * @param dialogContext
 * @param opt_cancelCb
 */
export const showParameterDialog = (dialogContext: IDialogContext ,
                                    config: DialogConfig,
                                    opt_cancelCb?:()=>void ) => {
    if (dialogContext) {
        if (! dialogContext.showDialog) {
            // @ts-ignore
            if (!dialogContext.current){
                const evctx=getav(dialogContext).dialogContext;
                if (evctx && evctx.showDialog) {
                    dialogContext=evctx;
                }
            }
        }
    }
    const parameters:TEditableParameterUI[]=[];
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
    let cancel=undefined;
    if (opt_cancelCb || config.onClose){
        cancel=()=>{
            if (opt_cancelCb){opt_cancelCb()}
            if (config.onClose){config.onClose()}
        }
    }
    return showDialog(dialogContext,
        (dp:any)=><ParameterDialog {...dp}{...config} parameters={parameters}/>,
        cancel,
        {
            dialogClassName:config.fullscreen?"fullscreen":undefined
        });
}