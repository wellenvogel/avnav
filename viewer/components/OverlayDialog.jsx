/**
 * Created by andreas on 24.11.16.
 * a simple handler for overlay dialogs
 * at most one dialog at a time will be visible
 * the component must be rendered exactly once
 * if you remove it and re-render all existing dialogs will be closed
 * the static methods will return promises for simple dialog handling
 */

import React, {Children, cloneElement, createContext, useContext, useRef, useState} from 'react';
import assign from 'object-assign';
import InputMonitor from '../hoc/InputMonitor.jsx';
import DB from './DialogButton.jsx';
import DialogButton from './DialogButton.jsx';
import MapEventGuard from "../hoc/MapEventGuard";
import PropTypes from "prop-types";
import {concatsp} from "../util/helper";


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

export const OverlayDialog = ({className,closeCallback,children}) => {
    let [DialogDisplay,setDialog]=useDialog(); //for nested dialogs
    const dialogContext=useDialogContext(); //if we are nested - just handle the z index
    let classNameS = "dialog";
    if (className) classNameS += " " + className;
    const close=closeCallback;
    const ourZIndex=dialogContext.zIndex+10;
    return (
        <DialogContext
            closeDialog={close}
            showDialog={setDialog}
            zIndex={ourZIndex}
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


OverlayDialog.propTypes={
    closeCallback: PropTypes.func, //handed over to the child to close the dialog
    className: PropTypes.string
};

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
export const DialogRow=({className,children})=>{
    return <div className={concatsp(className,"dialogRow")}>
        {children}
    </div>
}
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
    return <div {...fw} className={"dialogButtons "+((className!==undefined)?className:"")}>
        {buttons.map((button)=>{
            if (! button) return null;
            if (typeof(button) === 'function'){
                const El=button;
                return <El/>
            }
            const label=button.label?button.label:button.name.substring(0,1).toUpperCase()+button.name.substring(1);
            return <DialogButton {...button} key={button.name}>{label}</DialogButton>
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

const buildContext=(closeDialog,showDialog,zIndex)=>{
    return {
        closeDialog: closeDialog?closeDialog:()=>{},
        showDialog: showDialog?showDialog:()=>{},
        zIndex: (zIndex!==undefined)?zIndex:DIALOG_Z
    };
}
const DialogContextImpl=createContext(buildContext());
export const useDialogContext=()=>useContext(DialogContextImpl);
export const DialogContext=({closeDialog,showDialog,zIndex,children})=>{
    return <DialogContextImpl.Provider value={{
        closeDialog:closeDialog?closeDialog:()=>{},
        showDialog: showDialog?showDialog:()=>{},
        zIndex: zIndex!==undefined?zIndex:DIALOG_Z
    }}>
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
    const Display=InputMonitor(OverlayDialog);
    return [
        () => {
            if (!dialogContent || !dialogContent.content) return null;
            return (
                <Display closeCallback={() => {
                    //only close the dialog if there is not already a new dialog
                    if (dialogContent){
                        if(dialogId.current === dialogContent.id) {
                            setDialog(undefined);
                            if (closeCb) closeCb();
                        }
                        else{
                            console.log("deferred close");
                        }
                        if (dialogContent.close) dialogContent.close();
                    }
                }}>
                    <dialogContent.content/>
                </Display>

            )
        }
        ,
        (content,opt_closeCb)=>{
            if (content){
                dialogId.current++;
                if (dialogContent && dialogContent.content){
                    if (dialogContent.close) dialogContent.close();
                    //we will not call the global close callback
                }
                setDialog({content:content,close:opt_closeCb,id:dialogId.current});
            }
            else {
                if (dialogContent && dialogContent.current && dialogContent.id === dialogId.current){
                    if (dialogContent.close) dialogContent.close();
                    if (closeCb) closeCb();
                }
                setDialog(undefined)
            }
        }
    ]
}


/* =================================================================================================
   legacy dialog handling
   =================================================================================================*/

export const dialogDisplay=(Content,closeCallback)=>{
    let Display=InputMonitor(OverlayDialog);
    return(
        <Display
            className="nested"
            closeCallback={closeCallback}
        >
            <Content/>
        </Display>
    );
}

/**
 * a helper that will add dialog functionality to a component
 * it will maintain a variable inside the component state that holds the dialog
 * and it will wrap the render method to render the dialog if it is set
 * it exposes a couple of methods to control the dialog
 * normally you will instantiate it in the constructor like
 *    this.dialogHelper=dialogHelper(this);
 * and later you will use it like
 *    this.dialogHelper.showDialog((props)=>return <div>HelloDialog</div>);
 * @param thisref - the react component
 * @param stateName
 * @param opt_closeCallback - callback when dialog is closed
 * @returns {*}
 */
export const dialogHelper=(thisref,stateName,opt_closeCallback)=>{
    if (! stateName) stateName="dialog";
    let rt={
        showDialog:(Dialog)=>{
            let state={};
            state[stateName]=(props)=>{
                return(
                    <Dialog
                        {...props}
                        closeCallback={()=>{
                            rt.hideDialog();
                        }}
                    />
                )
            };
            thisref.setState(state);
        },
        hideDialog:()=>{
            let state={};
            state[stateName]=undefined;
            thisref.setState(state);
            notifyClosed();
            if (opt_closeCallback) opt_closeCallback();
        },
        filterState:(state)=>{
            let rt=assign({},state);
            delete rt[stateName];
            return rt;
        },
        getRender(){
            if (!thisref.state[stateName]) return null;
            return dialogDisplay(thisref.state[stateName],()=>{
                this.hideDialog()
            });
        },
        isShowing(){
            return !!thisref.state[stateName];
        }
    };
    rt.showDialog=rt.showDialog.bind(rt);
    rt.hideDialog=rt.hideDialog.bind(rt);
    rt.filterState=rt.filterState.bind(rt);
    rt.getRender=rt.getRender.bind(rt);
    let originalRender=thisref.render;
    let newRender=()=>{
        return <React.Fragment>
            {rt.getRender()}
            {originalRender.call(thisref)}
        </React.Fragment>
    };
    thisref.render=newRender.bind(thisref);
    return rt;
};

/**
 * handler for a global dialog
 */
const addGlobalDialog=(dialog,opt_cancel,opt_timeout)=>{
    const cancel=()=>{
        notifyClosed();
        if (opt_cancel) opt_cancel();
    }
    globalContext.showDialog(dialog,cancel,opt_timeout);
}
const notifyClosed=()=>{
    if (window.avnav.android && window.avnav.android.dialogClosed){
        window.avnav.android.dialogClosed();
    }
}
/**
 *
 * @param key
 * @param opt_cancelCallback this will be called if the dialog
 *        is removed from "outside"
 */
const addDialog=(content,opt_cancelCallback,opt_timeout)=> {
    return addGlobalDialog(content,opt_cancelCallback,opt_timeout);
};
export const showPromiseDialog=(dialogContext,Dialog,args)=>{
    if (!dialogContext) dialogContext=globalContext;
    return new Promise((resolve,reject)=>{
        let resolved=false;
        dialogContext.showDialog(()=>{
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

export const SelectList=({list,onClick})=> {
    return <div className="selectList">
        {list.map(function (elem) {
            return (
                <div className={"listEntry " + (elem.selected && 'selectedItem')}
                     onClick={() => onClick(elem)}
                     key={elem.value + ":" + elem.label}
                >
                    {elem.icon && <span className="icon" style={{backgroundImage: "url('" + elem.icon + "')"}}/>}
                    <span className="entryLabel">{elem.label}</span>
                </div>);
        })}
    </div>
}

//"active input" to prevent resizes
const Dialogs = {
    /**
     * create a select dialog component
     * this method will not directly show the dialog
     * @param title
     * @param list
     * @param okCallback
     * @param cancelCallback
     * @param optResetCallback
     * @return {Function}
     */
    createSelectDialog: (title, list, okCallback, cancelCallback, optResetCallback) => {
        return ({resolveFunction}) => {
            const dialogContext = useDialogContext();
            return (
                <DialogFrame className="selectDialog" title={title || ''}>
                    <SelectList list={list} onClick={(elem)=>{
                        dialogContext.closeDialog();
                        if (resolveFunction) resolveFunction(elem);
                        else if (okCallback) okCallback(elem);
                    }}/>
                    <DialogButtons>
                        {optResetCallback && <DB
                            name="reset"
                            onClick={(ev)=>{
                                optResetCallback(ev);
                            }}
                        >Reset</DB>}
                        <DB name="cancel"
                                onClick={(ev)=>{
                                    if (cancelCallback) cancelCallback(ev);
                                }}
                            >Cancel</DB>
                    </DialogButtons>
                </DialogFrame>
            );

        };
    },
    /**
     * create a value dialog component
     * this method will not show the dialog directly
     * @param title
     * @param ivalue
     * @param okCallback
     * @param cancelCallback
     * @param opt_label
     * @param opt_clear
     * @return {any}
     */
    createValueDialog:(title,ivalue,okCallback,cancelCallback,opt_label,opt_clear) =>{
         return ({resolveFunction})=>{
                const [value,setValue]=useState(ivalue);
                return (
                    <DialogFrame title={title || 'Input'}>
                            <div className="dialogRow">
                                <span className="inputLabel">{opt_label}</span>
                                <input type="text" name="value" value={value} onChange={(ev)=>setValue(ev.target.value)}/>
                            </div>
                        <DialogButtons>
                            {opt_clear && <DB name="reset" close={false} onClick={()=>setValue('')}>Clear</DB>}
                            <DB name="cancel" onClick={cancelCallback}>Cancel</DB>
                            <DB name="ok" onClick={() => resolveFunction?resolveFunction(value):okCallback(value)}>Ok</DB>
                        </DialogButtons>
                    </DialogFrame>
                );
            };
    },

    createConfirmDialog: (text,okFunction,cancelFunction,opt_title) =>{
        return ({resolveFunction})=> {
            return (
                <DialogFrame title={opt_title || ''}>
                    <div className="dialogText">{text}</div>
                    <DialogButtons buttonList={[
                        DBCancel(cancelFunction),
                        DBOk(resolveFunction||okFunction)
                    ]}/>
                </DialogFrame>
            );
        };
    },


    createAlertDialog: function(text,okFunction){
        return ({resolveFunction})=>{
            return (
                <DialogFrame title={"Alert"}>
                    <DialogText>{text}</DialogText>
                    <DialogButtons buttonList={DBOk(resolveFunction||okFunction)}/>
                </DialogFrame>
            );
        }

    },


    /**
     * show an alert message with close button
     * @param text
     * @param opt_parent if set the HTML parent element
     * @returns {Promise}
     */
    alert: function (text) {
        return showPromiseDialog(undefined,Dialogs.createAlertDialog(text));
    },
    /**
     * show a confirmation dialog
     * @param {string} text
     * @param  opt_parent if set the dialog parent
     * @param {string} opt_title if set the title
     * @returns {Promise}
     */
    confirm: function (text, opt_parent, opt_title) {
        return showPromiseDialog(undefined,Dialogs.createConfirmDialog(text,undefined,undefined,opt_title));
    },
    /**
     * create a value dialog as a promise
     * this will always fullfill if the user clicks ok
     * to implement checking and asynchronous close use the valueDialog method
     * @param title
     * @param value
     * @param opt_label
     * @param opt_clear show clear button
     * @returns {Promise}
     */
    valueDialogPromise: function (title, value, opt_label,opt_clear) {
        return showPromiseDialog(undefined,Dialogs.createValueDialog(title, value, undefined,undefined,opt_label,opt_clear));
    },
    /**
     * create a value dialog as a promise
     * this will always fullfill if the user clicks ok
     * to implement checking and asynchronous close use the valueDialog method
     * @param title
     * @param list
     * @returns {Promise}
     */
    selectDialogPromise: function (title, list) {
        return showPromiseDialog(undefined,Dialogs.createSelectDialog(title, list));
    },
    /**
     * create an arbitrary dialog
     * it will provide a closeCallback property to the html
     * by calling this function the dialog will be dismissed
     * @param html the react class to show (or the html string)
     * @param opt_parent
     * @param opt_cancelCallback a callback to be invoked if the dialog is closed from outside
     * @param opt_timeout if set - auto dismiss the dialog after opt_timeout ms
     * @returns dialogId
     */
    dialog: function (html, opt_parent,opt_cancelCallback,opt_timeout) {
        return addDialog(html,opt_cancelCallback,opt_timeout);
    },

};


export const InfoItem=(props)=>{
    return <div className={"dialogRow "+props.className}>
        <span className={"inputLabel"}>{props.label}</span>
        <span className={"itemInfo"}>{props.value}</span>
    </div>
}

InfoItem.show=(data,description)=>{
    let v=data[description.value];
    if (v === undefined) return null;
    if (description.formatter){
        v=description.formatter(v,data);
        if (v === undefined) return null;
    }
    return <InfoItem label={description.label} value={v}/>
}
export default Dialogs;

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