/**
 * Created by andreas on 24.11.16.
 * a simple handler for overlay dialogs
 * at most one dialog at a time will be visible
 * the component must be rendered exactly once
 * if you remove it and re-render all existing dialogs will be closed
 * the static methods will return promises for simple dialog handling
 */

import React, {Children, cloneElement, forwardRef, useEffect, useRef, useState} from 'react';
import {useInputMonitor} from '../hoc/InputMonitor.jsx';
import DialogButton from './DialogButton.jsx';
import MapEventGuard from "../hoc/MapEventGuard";
import PropTypes from "prop-types";
import Helper, {concatsp} from "../util/helper";
import {
    DialogContextImpl,
    globalContext,
    ReactDialogContextImpl,
    useDialogContext
} from "./DialogContext";


export const OverlayContainer=MapEventGuard(React.forwardRef((props,ref)=>{
    const dialogContext=useDialogContext();
    const style={zIndex:dialogContext.zIndex,
        left:dialogContext.left,right:dialogContext.right};
    return (
        <div
            className={Helper.concatsp("overlay_cover_active",props.coverClassName)}
            onClick={props.onClick}
            style={style}
            ref={ref}>
            <div
                className={Helper.concatsp("dialog",props.dialogClassName)}
                onClick={
                    (ev) => {
                        //ev.preventDefault();
                        ev.stopPropagation();
                    }
                }
                style={{zIndex:dialogContext.zIndex+1}}
            >
            {props.children}
            </div>
        </div>
    )
}));

const OverlayDialog = ({dialogClassName,coverClassName, children}) => {
    const dialogContext = useDialogContext();
    const nestedDialogContext = useRef(new DialogContextImpl(dialogContext));
    useInputMonitor();
    return (
        <OverlayContainer
            onClick={() => dialogContext.closeDialog()}
            dialogClassName={dialogClassName}
            coverClassName={coverClassName}
        >
            <DialogContext
                context={nestedDialogContext.current}
            >
                <DialogDisplay/>
                {Children.map(children, (child) => cloneElement(child, {closeCallback: close}))}
            </DialogContext>
        </OverlayContainer>
    );
}

export const DialogDisplay=()=>{
    const dialogContext=useDialogContext();
    let [Display,setDialog]=useDialog();
    useEffect(() => {
        const id=dialogContext.setDisplay(setDialog);
        return ()=>dialogContext.removeDisplay(id);
    }, []);
    return <Display/>
}




export const DialogContext=({context,children})=>{
    return <ReactDialogContextImpl.Provider value={context||globalContext}>
        {children}
    </ReactDialogContextImpl.Provider>
}

/**
 * new style dialog usage
 * @param closeCb
 */
export const useDialog=(closeCb)=>{
    const [dialogContent,setDialog]=useState(undefined);
    const dialogId=useRef(1);
    const lastContent=useRef(undefined);
    const setNewDialog=(content,opt_closeCb,opt_options,opt_id)=>{
        return new Promise((resolve,reject)=> {
            window.requestAnimationFrame(() => {
                const currentContent=lastContent.current;
                if (content) {
                    if (currentContent) {
                        if (currentContent.close) currentContent.close();
                        //we will not call the global close callback
                    }
                    dialogId.current++;
                    const newValues={content: content, close: opt_closeCb, id: dialogId.current, options: opt_options};
                    setDialog(newValues);
                    lastContent.current=newValues;
                    const id=dialogId.current;
                    resolve(() => {
                        //as the resturned function can be called any time
                        //later we need to check if this is still the expected dialog
                        //that we are going to close
                        setNewDialog(undefined,undefined,undefined,id);
                    });
                } else {
                    if (currentContent && (opt_id === undefined || currentContent.id === opt_id)) {
                        if (currentContent.close) currentContent.close();
                        if (closeCb) closeCb();
                        setDialog(undefined)
                        lastContent.current = undefined;
                    }
                    resolve();
                }
            });
        });
    };
    return [
        () => {
            if (!dialogContent || !dialogContent.content) return null;
            const {dialogClassName,coverClassName}=dialogContent.options||{}
            return (
                <OverlayDialog
                    dialogClassName={dialogClassName}
                    coverClassName={coverClassName}
                >
                    <dialogContent.content/>
                </OverlayDialog>

            )
        }
        ,
        (content,opt_closeCb,opt_options)=>{
            return setNewDialog(content,opt_closeCb,opt_options);
        }
    ]
}
export const showPromiseDialog=(dialogContext,Dialog,args,opt_options)=>{
    if (!dialogContext) dialogContext=globalContext;
    return new Promise((resolve,reject)=>{
        let resolved=false;
        showDialog(dialogContext,()=>{
            return <Dialog {...args} resolveFunction={(val)=>{
                resolved=true;
                resolve(val);
                return true;
            }} />
        },()=>{
            //give the resolve a chance to win
            window.setTimeout(()=> {
                if (!resolved) reject();
            },0);
        },opt_options);
    })
}
export const showDialog=(opt_dialogContext,dialog,opt_cancelCallback,opt_options)=>{
    if (opt_dialogContext){
        if (! opt_dialogContext.showDialog){
            if(opt_dialogContext.current && opt_dialogContext.current.showDialog)
                opt_dialogContext=opt_dialogContext.current;
            else
                opt_dialogContext=undefined;
        }
    }
    if (! opt_dialogContext) {
        const cancel=()=>{
            if (window.avnavAndroid && window.avnavAndroid.dialogClosed){
                window.avnavAndroid.dialogClosed();
            }
            if (opt_cancelCallback) opt_cancelCallback();
        }
        return globalContext.showDialog(dialog,cancel,opt_options);
    }
    else return opt_dialogContext.showDialog(dialog,opt_cancelCallback,opt_options);
}


export const promiseResolveHelper = ({ok, err}, resolveFunction, ...args) => {
    let rt = resolveFunction(...args);
    if (rt instanceof Promise) {
        rt.then(() => ok && ok())
            .catch((e) => {
                err && err(e)
            })
        return;
    }
    if (rt) ok && ok();
    else err && err();
}


export const DialogFrame=(props)=>{
    let classNameS="";
    let {title,className,flex,children,...fwprops}=props;
    if (className) classNameS+=" "+className;
    if (flex !== false) classNameS+=" flexInner";
    return <div {...fwprops} className={classNameS}>
        {(title)?<h3 className="dialogTitle">{title}</h3>:null}
        {children}
    </div>
}
export const DialogText=({className,children})=>{
    return <div className={concatsp(className,"dialogText")}>
        {children}
    </div>
}
export const DialogRow=forwardRef(({className,onClick,children},ref)=>{
    return <div className={concatsp(className,"dialogRow")} ref={ref} onClick={onClick}>
        {children}
    </div>
})
DialogFrame.propTypes={
    className: PropTypes.string,
    title: PropTypes.string,
    flex: PropTypes.bool,
    children: PropTypes.any
}

export const DialogButtons=(props)=>{
    const {className,children,buttonList,...fw}=props;
    let buttons=buttonList;
    if (! (buttons instanceof Array)) buttons=[buttons];
    return <div {...fw} className={Helper.concatsp("dialogButtons",className)}>
        {buttons.map((button)=>{
            if (! button) return null;
            if (typeof(button) === 'function'){
                const El=button;
                return <El/>
            }
            const label=button.label?button.label:button.name.substring(0,1).toUpperCase()+button.name.substring(1);
            return <DialogButton {...button} key={button.name}>
                {label}
            </DialogButton>
        })}
        {children}
    </div>
}
DialogButtons.propTypes={
    className: PropTypes.string,
    buttonList: PropTypes.oneOfType([PropTypes.array,PropTypes.object])
}
/**
 * helper for dialogButtonList
 */
export const DBCancel=(props)=>{
    return {close: true,name:'cancel',label:'Cancel',...props};
}
export const DBOk=(onClick,props)=>{
    return {close: true,name:'ok',onClick:onClick,label:'Ok',...props};
}


