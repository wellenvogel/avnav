/**
 * Created by andreas on 24.11.16.
 * a simple handler for overlay dialogs
 * at most one dialog at a time will be visible
 * the component must be rendered exactly once
 * if you remove it and re-render all existing dialogs will be closed
 * the static methods will return promises for simple dialog handling
 */

import React from 'react';
import PropTypes from 'prop-types';
import assign from 'object-assign';
import DialogDisplay from './OverlayDialogDisplay.jsx';
import Dynamic from '../hoc/Dynamic.jsx';
import InputMonitor from '../hoc/InputMonitor.jsx';
import globalStore from '../util/globalstore.jsx';
import ItemList from '../components/ItemList.jsx';
import keys from '../util/keys.jsx';
import DB from './DialogButton.jsx';
import shallowcompare from '../util/shallowcompare.js';

let id=1;
const notifyClosed=()=>{
    if (window.avnav.android && window.avnav.android.dialogClosed){
        window.avnav.android.dialogClosed();
    }
}
const nextId=()=> {
    id++;
    return id;
};
/**
 *
 * @param key
 * @param opt_cancelCallback this will be called if the dialog
 *        is removed from "outside"
 */
const addDialog=(key,content,opt_parent,opt_cancelCallback,opt_timeout)=> {
    if (! key) key=nextId();
    let properties={
        content:content,
        parent:opt_parent,
        cancelCallback:opt_cancelCallback,
        closeCallback: ()=>{removeDialog(key)},
        onClick: ()=>{removeDialog(key)}
    };
    let currentDialogs=assign({},globalStore.getData(keys.gui.global.currentDialog,{}));
    if (opt_timeout){
        properties.timeoutHandler=window.setTimeout(removeDialog(key),opt_timeout);
    }
    currentDialogs[key]=properties;
    globalStore.storeData(keys.gui.global.currentDialog,currentDialogs);
    return key;
};

const removeDialog=(key,opt_omitCancel)=> {
    let currentDialogs=assign({},globalStore.getData(keys.gui.global.currentDialog,{}));
    let old=currentDialogs[key];
    if (old !== undefined) {
        delete currentDialogs[key];
        if (old.timeoutHandler) {
            window.clearTimeout(old.timeout);
        }
    }
    globalStore.storeData(keys.gui.global.currentDialog,currentDialogs);
    if (old && old.cancelCallback && ! opt_omitCancel) {
        //do this after we updated the store to avoid endless loops
        //if someone calls removeDialog in the cancel callback
        old.cancelCallback();
    }
    notifyClosed();
    return old !== undefined;
};

const removeAll=()=>{
    //no callbacks...
    globalStore.storeData(keys.gui.global.currentDialog,{});
};






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
    createSelectDialog: (title,list,okCallback,cancelCallback,optResetCallback)=> {
        return (props)=> {
            return (
                <div className="selectDialog inner">
                    <h3 className="dialogTitle">{title || ''}</h3>
                    <div className="selectList">
                        {list.map(function(elem){
                            return(
                                <div className={"listEntry "+(elem.selected && 'selectedItem')}
                                     onClick={function(){
                                        if (okCallback) okCallback(elem);
                                        if (props.closeCallback) props.closeCallback();
                                    }}
                                    >{elem.label}</div>);
                        })}
                    </div>
                    <div className="dialogButtons">
                        {optResetCallback && <DB
                            name="reset"
                            onClick={(ev)=>{
                                if (props.closeCallback) props.closeCallback();
                                optResetCallback(ev);
                            }}
                        >Reset</DB>}
                        <DB name="cancel"
                                onClick={(ev)=>{
                                    if (props.closeCallback) props.closeCallback();
                                    if (cancelCallback) cancelCallback(ev);
                                }}
                            >Cancel</DB>
                    </div>
                </div>
            );

        };
    },
    /**
     * create a value dialog component
     * this method will not show the dialog directly
     * @param title
     * @param value
     * @param okCallback
     * @param cancelCallback
     * @param opt_label
     * @return {Dialog}
     */
    createValueDialog:(title,value,okCallback,cancelCallback,opt_label) =>{
        class Dialog extends React.Component{
            constructor(props){
                super(props);
                this.state={value:value};
                this.valueChanged=this.valueChanged.bind(this);
            }
            valueChanged(event) {
                this.setState({value: event.target.value});
            }
            render () {
                return (
                    <div className="inner">
                        <h3 className="dialogTitle">{title || 'Input'}</h3>
                        <div>
                            <div className="dialogRow">
                                <span className="inputLabel">{opt_label}</span>
                                <input type="text" name="value" value={this.state.value} onChange={this.valueChanged}/>
                            </div>
                        </div>
                        <div className="dialogButtons">
                            <DB name="cancel" onClick={cancelCallback}>Cancel</DB>
                            <DB name="ok" onClick={() => okCallback(this.state.value)}>Ok</DB>
                        </div>
                    </div>
                );
            }
        };
        return Dialog;
    },

    createConfirmDialog: (text,okFunction,cancelFunction,opt_title) =>{
        return (props)=> {
            return (
                <div className="inner">
                    <h3 className="dialogTitle">{opt_title || ''}</h3>

                    <div className="dialogText">{text}</div>
                    <div className="dialogButtons">
                        <DB name="cancel" onClick={() => {
                            if (cancelFunction) cancelFunction();
                            if (props.closeCallback) props.closeCallback();
                        }}>Cancel</DB>
                        <DB name="ok" onClick={() => {
                            if (okFunction) okFunction();
                            if (props.closeCallback) props.closeCallback();
                        }}>Ok</DB>
                    </div>
                </div>
            );
        };
    },

/**
     * get the react elemnt that will handle all the dialogs
     */
    getDialogContainer: (props) => {
        let Item = InputMonitor(DialogDisplay);
        let List = Dynamic(ItemList);
        return <List {...props}
            itemClass={Item}
            storeKeys={{
                items:keys.gui.global.currentDialog
            }}
            updateFunction={(state)=>{
                let items=[];
                for (let k in state.items){
                    let ip=assign({key:k},state.items[k]);
                    //delete properties we only handle internally
                    delete ip.timeoutHandler;
                    items.push(ip);
                }
                return {itemList:items};
            }}
            />;
    },


    /**
     * show an alert message with close button
     * @param text
     * @param opt_parent if set the HTML parent element
     * @returns {Promise}
     */
    alert: function (text, opt_parent) {
        return new Promise(function (resolve, reject) {
            let id = nextId();
            const okFunction = ()=> {
                removeDialog(id,true);
                resolve();
            };
            const html = function () {
                return (
                    <div className="inner">
                        <h3 className="dialogTitle">Alert</h3>

                        <div className="dialogText">{text}</div>
                        <div className="dialogButtons">
                            <DB name="ok" onClick={okFunction}>Ok</DB>
                        </div>
                    </div>
                );
            };
            addDialog(id,html,opt_parent,()=> {
                    resolve();
                });
        });
    },
    /**
     * show a confirmation dialog
     * @param {string} text
     * @param  opt_parent if set the dialog parent
     * @param {string} opt_title if set the title
     * @returns {Promise}
     */
    confirm: function (text, opt_parent, opt_title) {
        return new Promise(function (resolve, reject) {
            let id = nextId();
            const okFunction = (el)=> {
                resolve(1);
            };
            const cancelFunction = (el)=> {
                reject();
            };
            let html = Dialogs.createConfirmDialog(text,okFunction,cancelFunction,opt_title);
            addDialog(id,html,opt_parent,()=> {
                    reject();
                });
        });

    },
    /**
     * a simple input value dialog
     * @param {string} title the title text to be displayed
     * @param {string} value the initial value
     * @param {function} okCallback the callback when OK is clicked, value as parameter
     *                   return false to keep the dialog open
     *                   the callback will receive an asynchronous close function as
     *                   second parameter
     * @param opt_parent if set the parent HTML element
     * @param opt_label if set an additional label
     * @param opt_cancelCallback - if set a callback function being invoked on cancel
     * @returns {*|OverlayDialog}
     */
    valueDialog: function (title, value, okCallback, opt_parent, opt_label, opt_cancelCallback) {
        let id = nextId();
        const ok = (value)=> {
            removeDialog(id,true);
            okCallback(value);
        };
        const cancel = ()=> {
            if (removeDialog(id,true) && opt_cancelCallback) opt_cancelCallback();
        };
        let html= Dialogs.createValueDialog(title, value, ok, cancel, opt_label);
        addDialog(id,html,opt_parent,()=> {
                if (opt_cancelCallback) opt_cancelCallback();
            });
    },
    /**
     * create a value dialog as a promise
     * this will always fullfill if the user clicks ok
     * to implement checking and asynchronous close use the valueDialog method
     * @param title
     * @param value
     * @param opt_parent
     * @param opt_label
     * @returns {Promise}
     */
    valueDialogPromise: function (title, value, opt_parent, opt_label) {
        let id = nextId();
        return new Promise(function (resolve, reject) {
            let Dialog = Dialogs.createValueDialog(title, value, (value)=> {
                removeDialog(id,true);
                resolve(value);
                return true;
            }, ()=> {
                removeDialog(id,true);
                reject();
            }, opt_label);
            addDialog(id,Dialog,opt_parent,()=> {
                    reject();
                });
        })
    },
    /**
     * create a value dialog as a promise
     * this will always fullfill if the user clicks ok
     * to implement checking and asynchronous close use the valueDialog method
     * @param title
     * @param list
     * @param opt_parent
     * @returns {Promise}
     */
    selectDialogPromise: function (title, list, opt_parent) {
        return new Promise(function (resolve, reject) {
            let id = nextId();
            let Dialog = Dialogs.createSelectDialog(title, list, (value)=> {
                resolve(value);
            }, ()=> {
                reject();
            });
            addDialog(id,Dialog, opt_parent,()=> {
                        reject();
                    });
        })
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
        let id = nextId();
        return addDialog(id,html,opt_parent,opt_cancelCallback,opt_timeout);
    },

    hide: function(){
        removeAll();
    },



};
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
 * @returns {*}
 */
export const dialogHelper=(thisref,stateName)=>{
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
        },
        filterState:(state)=>{
            let rt=assign({},state);
            delete rt[stateName];
            return rt;
        },
        getRender(){
            if (!thisref.state[stateName]) return null;
            let Display=InputMonitor(DialogDisplay);
            return(
                <Display
                    className="nested"
                    content={thisref.state[stateName]}
                    closeCallback={()=>{
                        this.hideDialog()
                    }}
                    />
            );
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
 * helper for maintaining the values that are edited inside a dialog
 * it will add 2 fields to the state:
 *   values - the current values
 *   changed - a flag that is true if the values differ from the initialValues
 *             compared with shallowcompare
 * create a instance in the constructor:
 *    this.stateHelper=stateHelper(this,props.current);
 * later call it using
 *    this.stateHelper.changeValue(key,value)
 * @param thisref
 * @param initialValues
 * @param opt_namePrefix - prefix for the state variabe names
 */
export const stateHelper=(thisref,initialValues,opt_namePrefix)=>{
    let valueName="values";
    let changedName="changed";
    if (opt_namePrefix){
        valueName=opt_namePrefix+valueName;
        changedName=opt_namePrefix+changedName;
    }
    if (! thisref.state) thisref.state={};
    thisref.state[valueName]=assign({},initialValues);
    thisref.state[changedName]=false;
    let rt={
        setValue:(key,value)=>{
            let values=assign({},thisref.state[valueName]);
            if (values[key] == value) return;
            values[key]=value;
            let newState={};
            newState[valueName]=values;
            newState[changedName]=!shallowcompare(values,initialValues);
            thisref.setState(newState);
        },
        setState:(partialState,opt_overwrite)=>{
            let values;
            if (! opt_overwrite) values=assign({},thisref.state[valueName],partialState);
            else values=partialState;
            let newState={};
            newState[valueName]=values;
            newState[changedName]=!shallowcompare(values,initialValues);
            thisref.setState(newState);
        },
        isChanged(){
            return thisref.state[changedName]||false;
        },
        reset(){
            let newState={};
            newState[valueName]=assign({},initialValues);
            newState[changedName]=false;
            thisref.setState(newState);
        },
        getValues(opt_copy){
            if (opt_copy){
                return assign({},thisref.state[valueName]);
            }
            return thisref.state[valueName]||{};
        },
        getState(opt_copy){
            return rt.getValues(opt_copy)
        },
        getValue(key,opt_default){
            let v=rt.getValues()[key];
            if (v === undefined && opt_default !== undefined){
                v=opt_default;
            }
            return v;
        }
    };
    return rt;

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
