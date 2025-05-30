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
    useCallback,
    useContext,
    useRef,
    useState
} from 'react';
import assign from 'object-assign';
import InputMonitor from '../hoc/InputMonitor.jsx';
import DialogButton from './DialogButton.jsx';
import MapEventGuard from "../hoc/MapEventGuard";
import PropTypes from "prop-types";
import Helper, {concatsp} from "../util/helper";


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

const OverlayDialog = ({className,closeCallback,replaceDialog,children}) => {
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
            replaceDialog={replaceDialog}
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

const buildContext=(closeDialog,showDialog,replaceDialog,zIndex)=>{
    return {
        closeDialog: closeDialog?closeDialog:()=>{},
        showDialog: showDialog?showDialog:()=>{},
        zIndex: (zIndex!==undefined)?zIndex:DIALOG_Z,
        replaceDialog: replaceDialog?replaceDialog:()=>{}
    };
}
const DialogContextImpl=createContext(buildContext());
export const useDialogContext=()=>useContext(DialogContextImpl);
export const DialogContext=({closeDialog,showDialog,replaceDialog,zIndex,children})=>{
    return <DialogContextImpl.Provider value={buildContext(closeDialog,showDialog,replaceDialog,zIndex)}>
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
    const setNewDialog=useCallback((content,opt_closeCb)=>{
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
    },[dialogContent]);
    return [
        () => {
            if (!dialogContent || !dialogContent.content) return null;
            return (
                <Display
                    closeCallback={() => {
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
                }}
                    replaceDialog={(newDialog,opt_closeCb)=>{
                        setNewDialog(newDialog,opt_closeCb);
                    }}
                >
                    <dialogContent.content/>
                </Display>

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
    if (! opt_dialogContext) addGlobalDialog(dialog,opt_cancelCallback);
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

/* =================================================================================================
   legacy dialog handling
   =================================================================================================*/

export const DialogDisplay=({closeCallback,children})=>{
    let Display=InputMonitor(OverlayDialog);
    return(
        <Display
            className="nested"
            closeCallback={closeCallback}
        >
            {children}
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
            const D=thisref.state[stateName];
            return (
                <DialogDisplay closeCallback={()=>{
                    this.hideDialog()
                }}>
                    <D/>
                </DialogDisplay> );
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
