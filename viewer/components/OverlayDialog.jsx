/**
 * Created by andreas on 24.11.16.
 * a simple handler for overlay dialogs
 * at most one dialog at a time will be visible
 * the component must be rendered exactly once
 * if you remove it and re-render all existing dialogs will be closed
 * the static methods will return promises for simple dialog handling
 */

import React from 'react';
import Promise from 'promise';
import PropTypes from 'prop-types';
import assign from 'object-assign';
import DialogDisplay from './OverlayDialogDisplay.jsx';
import Dynamic from '../hoc/Dynamic.jsx';
import InputMonitor from '../hoc/InputMonitor.jsx';
import globalStore from '../util/globalstore.jsx';
import ItemList from '../components/ItemList.jsx';
import keys from '../util/keys.jsx';

let id=1;

const nextId=()=> {
    id++;
    return id;
};
/**
 *
 * @param key
 * @param properties
 *        if properties contains a cancelCallback this will be called if the dialog
 *        is removed from "outside"
 */
const addDialog=(key,properties)=> {
    let currentDialogs=assign({},globalStore.getData(keys.gui.global.currentDialog,{}));
    let timeout=undefined;
    if (properties && properties.timeout){
        timeout=window.setTimeout(removeDialog(opt_key),properties.timeout);
    }
    currentDialogs[key]=assign({timeoutHandler:timeout},properties);
    globalStore.storeData(keys.gui.global.currentDialog,currentDialogs);
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
    return old !== undefined;
};


const createValueDialog=function(title,value,okCallback,cancelCallback,opt_label) {
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
                <div>
                    <h3 className="avn_dialogTitle">{title || 'Input'}</h3>
                    <div>
                        <div className="avn_row"><label>{opt_label || ''}</label>
                            <input type="text" name="value" value={this.state.value} onChange={this.valueChanged}/>
                        </div>
                    </div>
                    <button name="ok" onClick={()=>okCallback(this.state.value)}>Ok</button>
                    <button name="cancel" onClick={cancelCallback}>Cancel</button>
                    <div className="avn_clear"></div>
                </div>
            );
        }
    };
    return Dialog;
};

var createSelectDialog=function(title,list,okCallback,cancelCallback) {
    return (props)=> {
            return (
                <div className="avn_selectDialog">
                    <h3 className="avn_dialogTitle">{title || ''}</h3>
                    <div className="avn_selectList">
                        {list.map(function(elem){
                            return(
                                <div className={"avn_list_entry "+(elem.selected && 'avn_selectedItem')} onClick={function(){
                                okCallback(elem);
                            }}>{elem.label}</div>);
                        })}
                    </div>
                    <div className="avn_buttons">
                        <button name="cancel" onClick={cancelCallback}>Cancel</button>
                        <div className="avn_clear"></div>
                    </div>
                </div>
            );

    };
};

                                            //"active input" to prevent resizes
const Dialogs = {
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
     * show a dialog
     * content must be a react element
     * @param content
     * @param properties
     * @returns {*} the content element id
     */
    show: (content, properties, opt_key)=> {
        if (!opt_key) opt_key = nextId();
        addDialog(opt_key, {
            content: content,
            parent: properties ? properties.parent : undefined,
            cancelCallback: properties ? properties.cancelCallback : undefined,
            closeCallback: ()=>{removeDialog(opt_key)},
            onClick: ()=>{removeDialog(opt_key)}
        });
        return opt_key;

    },
    hide: (id)=> {
        removeDialog(id);
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
                    <div>
                        <h3 className="avn_dialogTitle">Alert</h3>

                        <div className="avn_dialogText">{text}</div>
                        <button name="ok" onClick={okFunction}>Ok</button>
                        <div className="avn_clear"></div>
                    </div>
                );
            };
            Dialogs.show(html, {
                cancelCallback: function () {
                    resolve();
                },
                parent: opt_parent
            }, id);
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
                removeDialog(id,true);
                resolve(1);
            };
            const cancelFunction = (el)=> {
                removeDialog(id,true);
                reject();
            };
            var html = function (props) {
                return (
                    <div>
                        <h3 className="avn_dialogTitle">{opt_title || ''}</h3>

                        <div className="avn_dialogText">{text}</div>
                        <button name="ok" onClick={okFunction}>Ok</button>
                        <button name="cancel" onClick={cancelFunction}>Cancel</button>
                        <div className="avn_clear"></div>
                    </div>
                );
            };
            Dialogs.show(html, {
                cancelCallback: function () {
                    reject();
                },
                parent: opt_parent
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
        var Dialog = createValueDialog(title, value, ok, cancel, opt_label);
        Dialogs.show(html, {
            parent: opt_parent,
            cancelCallback: ()=> {
                if (opt_cancelCallback) opt_cancelCallback();
            }
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
            var Dialog = createValueDialog(title, value, (value)=> {
                removeDialog(id,true);
                resolve(value);
                return true;
            }, ()=> {
                removeDialog(id,true);
                reject();
            }, opt_label);
            Dialogs.show(Dialog, {
                parent: opt_parent,
                cancelCallback: ()=> {
                    reject();
                }
            }, id);
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
            let Dialog = createSelectDialog(title, list, (value)=> {
                removeDialog(id,true);
                resolve(value);
            }, ()=> {
                removeDialog(id,true);
                reject();
            });
            Dialogs.show(Dialog, {
                    parent: opt_parent,
                    cancelCallback: ()=> {
                        reject();
                    }
                },
                id);
        })
    },
    /**
     * create an arbitrary dialog
     * @param html the react class to show (or the html string)
     * @param opt_parent
     * @param opt_options
     * @returns {object} the react element that we are showing - use this for hiding
     */
    dialog: function (html, opt_parent, opt_options) {
        let id = nextId();
        const cancel = ()=> {
            if (removeDialog(id,true) && opt_options && opt_options.cancelCallback) {
                opt_options.cancelCallback();
            }
        };
        let options = assign({}, opt_options || {}, {parent: opt_parent, cancelCallback: cancel});
        return Dialogs.show(html, options, id);
    }

};

module.exports=Dialogs;
