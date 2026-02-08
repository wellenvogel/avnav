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
    useContext, useEffect,
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
 * new dialog concept 2026/02
 * we need 2 modes of the dialog context:
 * (1) when not inside a dialog:
 *   - showDialog - normal
 *   - replaceDialog - similar to show
 *   - closeDialog - close the current dialog
 *
 *  (2) when inside a dialog
 *   - showDialog: show new dialog, keep existing open
 *   - replaceDialog: replace the current dialog
 *   - closeDialog: close the current dialog
 *
 * So (1) and (2) should be handled by a parent relationship.
 * The child should the one being returned from useDialogContext
 * when within a dialog.
 * Beside the parent-child for nested dialogs we need a way to control the display
 * that is used for a dialog (and at the same time the state object).
 * This needs to ensure that e.g. a dialog is closed when leaving a page.
 *
 * Concept:
 * (A) There will be a dialogContext class that implements the methods
 * showDialog, replaceDialog, closeDialog. Additionally it will have
 * the methods setDisplay,resetDisplay that stores/removes a setDialog
 * function in a stack of such functions.
 * All show/replace/close functions will always work with the topmost
 * stack entry. When adding a new entry closeDialog will be called at
 * entry below.
 * The z-Index is alos maintained inside this context class.
 * (B) An instance of this class is created globally and is used for
 * all showDialog functions without an explicit context.
 * (C) The App will be the first calling setDisplay so that there
 * is always a DialogDisplay - even if no other object is there.
 * (D) PageLeft will be the next calling setDisplay. This ensures
 * dialogs to be shown at the left part only and additionally
 * automatic removal of dialogs when leaving a page.
 * (E) When creating a dialog a new instance of the DialogContextImpl
 * class is created, forwarding replaceDialog to the parent.
 */

/**
 * the basic overlay dialog elements
 */


const DIALOG_Z=120;
let dialogCtxId=0;
const getCtxId=()=>{
    dialogCtxId++;
    return dialogCtxId;
}


class DialogDisplayEntry{
    constructor(setDialog) {
        this.setDialog=setDialog;
        this.id=getCtxId();
    }

}

class DialogContextImpl{
    constructor(parent){
        this.displayStack=[];
        if (!parent) {
            this.zIndex = DIALOG_Z;
        }
        else{
            this.zIndex=parent.zIndex+10;
            this.parent=parent;
        }
        this.displayStack.push(new DialogDisplayEntry(()=>{}));
        this.closeDialog=this.closeDialog.bind(this);
        this.showDialog=this.showDialog.bind(this);
        this.replaceDialog=this.replaceDialog.bind(this);
    }
    _getTop(){
        return this.displayStack[this.displayStack.length-1];
    }
    showDialog(content,opt_closeCb){
        return this._getTop().setDialog(content,opt_closeCb);
    }
    closeDialog(){
        //only go up to first parent
        //we cannot call closeDialog at the parent as this would potentially
        //go up further
        if (this.parent) return this.parent._getTop().setDialog();
        return this._getTop().setDialog();
    }
    replaceDialog(content,opt_closeCb){
        if (this.parent) return this.parent.showDialog(content,opt_closeCb);
        return this.showDialog(content,opt_closeCb);
    }
    setDisplay(setDialogFunction){
        const current=this._getTop();
        current.setDialog(); //cleanup any dialog if we change the display
        this.displayStack.push(new DialogDisplayEntry(setDialogFunction));
        return this._getTop().id;
    }
    removeDisplay(id){
        //never remove the first entry from the stack
        for (let idx=1;idx<this.displayStack.length;idx++){
            if (this.displayStack[idx].id===id){
                this.displayStack.splice(idx,1);
                return true;
            }
        }
        return false;
    }

}

const globalContext=new DialogContextImpl();


export const OverlayContainer=MapEventGuard(React.forwardRef((props,ref)=>{
    const dialogContext=useDialogContext();
    const style={zIndex:dialogContext.zIndex,
        left:dialogContext.left,right:dialogContext.right};
    return (
        <div className="overlay_cover_active" onClick={props.onClick} style={style} ref={ref}>
            <div
                className={Helper.concatsp("dialog",props.className)}
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

const OverlayDialog = ({className, children}) => {
    const dialogContext = useDialogContext();
    const nestedDialogContext = useRef(new DialogContextImpl(dialogContext));
    useInputMonitor();
    return (
        <OverlayContainer
            onClick={() => dialogContext.closeDialog()}
            className={className}
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




const ReactDialogContextImpl=createContext(globalContext);
export const useDialogContext=()=>useContext(ReactDialogContextImpl);
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
    const setNewDialog=(content,opt_closeCb)=>{
        if (content){
            if (dialogContent && dialogContent.content && dialogId.current === dialogContent.id){
                if (dialogContent.close) dialogContent.close();
                //we will not call the global close callback
            }
            dialogId.current++;
            setDialog({content:content,close:opt_closeCb,id:dialogId.current});
            return ()=>setNewDialog();
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
            return setNewDialog(content,opt_closeCb);
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
            if (window.avnavAndroid && window.avnavAndroid.dialogClosed){
                window.avnavAndroid.dialogClosed();
            }
            if (opt_cancelCallback) opt_cancelCallback();
        }
        return globalContext.showDialog(dialog,cancel);
    }
    else return opt_dialogContext.showDialog(dialog,opt_cancelCallback);
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


