/**
 * Created by andreas on 24.11.16.
 * a simple handler for overlay dialogs
 * at most one dialog at a time will be visible
 * the component must be rendered exactly once
 * if you remove it and re-render all existing dialogs will be closed
 * the static methods will return promises for simple dialog handling
 */

import React, {
    Children,
    cloneElement,
    createContext,
    forwardRef,
    useContext,
    useRef,
    useState
} from 'react';
import {useInputMonitor} from '../hoc/InputMonitor.jsx';
import DialogButton from './DialogButton.jsx';
import MapEventGuard from "../hoc/MapEventGuard";
import PropTypes from "prop-types";
import Helper, {concatsp} from "../util/helper";
import base from "../base";


/**
 * the basic overlay dialog elements
 */

const Container=MapEventGuard(React.forwardRef((props,ref)=>{
    const dialogContext=useDialogContext();
    const style={zIndex:dialogContext.zIndex};
    return (
        <div className="overlay_cover_active" onClick={props.onClick} style={style} ref={ref}>
            {props.children}
        </div>
    )
}));

export const OverlayDialog = ({className,closeCallback,replaceDialog,children}) => {
    let [DialogDisplay,setDialog]=useDialog(); //for nested dialogs
    const dialogContext=useDialogContext(); //if we are nested - just handle the z index
    let classNameS = "dialog";
    if (className) classNameS += " " + className;
    const close=closeCallback;
    const ourZIndex=dialogContext.zIndex+10;
    useInputMonitor();
    return (
        <DialogContext
            closeDialog={close}
            showDialog={setDialog}
            zIndex={ourZIndex}
            replaceDialog={replaceDialog}
            id={getCtxId()}
        >
        <Container onClick={close}>
            <div
                className={classNameS}
                onClick={
                (ev) => {
                    //ev.preventDefault();
                    ev.stopPropagation();
                }
                }
                style={{zIndex:ourZIndex+1}}
            >
                <DialogDisplay/>
                {Children.map(children,(child)=>cloneElement(child,{closeCallback:close}))}
            </div>
        </Container>
        </DialogContext>
    );
}



export const handleCtxRef=(ctx,ref)=>{
    if (!ref) return;
    if (typeof ref == 'function') ref(ctx);
    else ref.current=ctx;
}

export const NestedDialogDisplay=({closeCallback,children,dialogCtxRef})=>{
    let [DialogDisplay,setDialog]=useDialog(); //for nested dialogs
    const dialogContext=useDialogContext();
    const ourZIndex=dialogContext.zIndex+10;
    const close=()=>{
        setDialog(undefined,closeCallback);
    }
    const newContext=buildContext(close,setDialog,setDialog,ourZIndex);
    handleCtxRef(newContext,dialogCtxRef);
    return <DialogContext
        {...newContext}>
            <DialogDisplay/>
            {children}
        </DialogContext>

}
NestedDialogDisplay.propTypes={
    closeCallback: PropTypes.func,
    dialogCtxRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({current: PropTypes.any})
    ])
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


const DIALOG_Z=120;
let dialogCtxId=0;
const getCtxId=()=>{
    dialogCtxId++;
    return dialogCtxId;
}

const buildContext=(closeDialog,showDialog,replaceDialog,zIndex,opt_id)=>{
    return {
        closeDialog: closeDialog?closeDialog:()=>{},
        showDialog: showDialog?showDialog:()=>{},
        zIndex: (zIndex!==undefined)?zIndex:DIALOG_Z,
        replaceDialog: replaceDialog?replaceDialog:()=>{},
        id: (opt_id!==undefined)?opt_id:getCtxId()
    };
}
const DialogContextImpl=createContext(buildContext());
export const useDialogContext=()=>useContext(DialogContextImpl);
export const DialogContext=({closeDialog,showDialog,replaceDialog,zIndex,children,id})=>{
    return <DialogContextImpl.Provider value={buildContext(closeDialog,showDialog,replaceDialog,zIndex,id)}>
        {children}
    </DialogContextImpl.Provider>
}

let globalContext=buildContext();

export const setGlobalContext=(closeDialog,showDialog,zIndex)=>{
    globalContext=buildContext(closeDialog,showDialog,zIndex);
}


/**
 * new style dialog usage
 * @param closeCb
 */
export const useDialog=(closeCb)=>{
    const [dialogContent,setDialog]=useState(undefined);
    const dialogId=useRef(1);
    const setNewDialog=(content,opt_closeCb)=>{
        if (content){
            if (dialogContent && dialogContent.content && dialogId.current === dialogContent.id){
                if (dialogContent.close) dialogContent.close();
                //we will not call the global close callback
            }
            dialogId.current++;
            setDialog({content:content,close:opt_closeCb,id:dialogId.current});
        }
        else {
            if (dialogContent && dialogContent.current && dialogContent.id === dialogId.current){
                if (dialogContent.close) dialogContent.close();
                if (closeCb) closeCb();
            }
            setDialog(undefined)
        }
    };
    return [
        () => {
            if (!dialogContent || !dialogContent.content) return null;
            return (
                <OverlayDialog
                    closeCallback={() => {
                    //only close the dialog if there is not already a new dialog
                    if (dialogContent){
                        if(dialogId.current === dialogContent.id) {
                            setDialog(undefined);
                            if (closeCb) closeCb();
                            if (dialogContent.close) dialogContent.close();
                        }
                        else{
                            base.log("deferred close");
                        }
                    }
                }}
                    replaceDialog={(newDialog,opt_closeCb)=>{
                        setNewDialog(newDialog,opt_closeCb);
                    }}
                >
                    <dialogContent.content/>
                </OverlayDialog>

            )
        }
        ,
        (content,opt_closeCb)=>{
            setNewDialog(content,opt_closeCb);
        }
    ]
}
export const showPromiseDialog=(dialogContext,Dialog,args)=>{
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
        })
    })
}
export const showDialog=(opt_dialogContext,dialog,opt_cancelCallback)=>{
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
            if (window.avnav.android && window.avnav.android.dialogClosed){
                window.avnav.android.dialogClosed();
            }
        }
        globalContext.showDialog(dialog,cancel);
    }
    else opt_dialogContext.showDialog(dialog,opt_cancelCallback);
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
