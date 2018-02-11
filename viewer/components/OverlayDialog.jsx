/**
 * Created by andreas on 24.11.16.
 * a simple handler for overlay dialogs
 * at most one dialog at a time will be visible
 * the component must be rendered exactly once
 * if you remove it and re-render all existing dialogs will be closed
 * the static methods will return promises for simple dialog handling
 */

var React=require('react');
var Promise=require('promise');
var id=0;
var getNextId=function(){
    id++;
    return id;
};
var OverlayDialogListInstance=undefined;
var dialogInstanceId='###overlayDialog###'; //will be used to store this as
                                            //"active input" to prevent resizes
var OverlayDialog=React.createClass({
    propTypes:{
        showCallback: React.PropTypes.func,
        hideCallback: React.PropTypes.func
    },
    getInitialState: function(){
        return {

        };
    },
    render: function(){
        if (! this.state.content) {
            if (this.props.hideCallback) this.props.hideCallback(dialogInstanceId);
            return null;
        }
        if (this.props.showCallback) this.props.showCallback(dialogInstanceId);
        var id=this.state._contentId;
        var self=this;
        var hide=function(){
            self.hide(id);
        };
        var props=avnav.assign({},this.state,{closeCallback:hide});
        props.content=undefined;
        props._contentId=undefined;
        return(
            <div ref="container" className="avn_overlay_cover_active">
                <div ref="box" className="avn_dialog">{React.createElement(this.state.content,props)}</div>
            </div>
        );
    },
    /**
     * show a dialog
     * content must be a react element
     * @param content
     * @param properties
     * @returns {*} the content element id
     */
    show: function(content,properties){
        var id=getNextId();
        this.setState(avnav.assign({},this.props,properties||{},{content:content,_contentId:id}));
        if (properties.timeout){
            window.setTimeout(this.hide,properties.timeout);
        }
        return id;
    },
    /**
     *
     * @param opt_id if set - only hide if we are showing this element
     */
    hide: function(opt_id){
        var oldState=this.state;
        //only hide if this is either called globally or if
        //we still show the object that we should hide
        if (oldState._contentId && opt_id !== undefined && oldState._contentId != opt_id ) return;
        if (oldState.cancelCallback && oldState._contentId){
            oldState.cancelCallback();
        }
        var newState={};
        for (var k in oldState){
            newState[k]=undefined;
        }
        this.setState(newState);
    },
    componentDidMount: function(){
        OverlayDialogListInstance=this;
        window.addEventListener('resize',this.updateDimensions);
    },
    componentWillUnmount: function(){
        var oldState=this.state;
        if (oldState.cancelCallback){
            oldState.cancelCallback();
        }
        window.removeEventListener('resize',this.updateDimensions);
        if (this.props.hideCallback) this.props.hideCallback(dialogInstanceId);
        OverlayDialogListInstance=undefined;
    },
    componentDidUpdate: function(){
        this.updateDimensions();
    },
    updateDimensions: function(){
        if (! this.state.content) return;
        var props=avnav.assign({},this.props,this.state);

        var assingToViewport = true;
        if (props.parent) {
            try {
                //expected to be a dom element
                var containerRect = props.parent.getBoundingClientRect();
                avnav.assign(this.refs.container.style, {
                    position: "fixed",
                    top: containerRect.top + "px",
                    left: containerRect.left + "px",
                    width: containerRect.width + "px",
                    height: containerRect.height + "px"
                });
                assingToViewport = false;
            } catch (e) {
                avnav.log("invalid parent for dialog: " + e);
            }
        }
        if (assingToViewport) {
            avnav.assign(this.refs.container.style, {
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0
            });
        }
        var rect = this.refs.container.getBoundingClientRect();
        avnav.assign(this.refs.box.style, {
            maxWidth: rect.width + "px",
            maxHeight: rect.height + "px",
            display: 'block',
            position: 'fixed',
            opacity: 0
        });
        var self = this;
        window.setTimeout(function () {
            if (!self.refs.box) return; //could have become invisible...
            var boxRect = self.refs.box.getBoundingClientRect();
            avnav.assign(self.refs.box.style, {
                left: (rect.width - boxRect.width) / 2 + "px",
                top: (rect.height - boxRect.height) / 2 + "px",
                opacity: 1
            });
            var props=avnav.assign({},self.props,self.state);
            if (props.positionCallback) {
                props.positionCallback(boxRect);
            }

        }, 0);

    },
    statics:{
        /**
         * show an alert message with close button
         * @param text
         * @param opt_parent if set the HTML parent element
         * @returns {Promise}
         */
        alert:function(text,opt_parent){
            return new Promise(function (resolve, reject) {
                var html = React.createClass({
                    propTypes: {
                        closeCallback: React.PropTypes.func
                    },
                    okFunction:function(el){
                        if (this.props.closeCallback) this.props.closeCallback();
                        resolve();
                    },
                    render: function () {
                        return (
                            <div>
                                <h3 className="avn_dialogTitle">Alert</h3>
                                <div className="avn_dialogText">{text}</div>
                                <button name="ok" onClick={this.okFunction}>Ok</button>
                                <div className="avn_clear"></div>
                            </div>
                        );
                    }
                });
                if (OverlayDialogListInstance == null) {
                    reject(new Error("not initialzed"));
                    return;
                }
                OverlayDialogListInstance.show(html,
                    {
                        cancelCallback: function(){
                            resolve();
                        },
                        parent: opt_parent

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
        confirm: function(text,opt_parent,opt_title){
            return new Promise(function (resolve, reject) {
                var html=React.createClass({
                    propTypes: {
                        closeCallback: React.PropTypes.func
                    },
                    okFunction:function(el){
                        resolve(1);
                        if (this.props.closeCallback) this.props.closeCallback();
                    },
                    cancelFunction:function(el){
                        if (this.props.closeCallback) this.props.closeCallback();
                        reject();
                    },
                    render: function(){
                        return (
                            <div>
                                <h3 className="avn_dialogTitle">{opt_title||''}</h3>
                                <div className="avn_dialogText">{text}</div>
                                <button name="ok" onClick={this.okFunction}>Ok</button>
                                <button name="cancel" onClick={this.cancelFunction}>Cancel</button>
                                <div className="avn_clear"></div>
                            </div>
                        );
                    }
                });
                if (OverlayDialogListInstance == null) {
                    reject(new Error("not initialzed"));
                    return;
                }
                OverlayDialogListInstance.show(html,
                    {
                        cancelCallback: function(){
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
        valueDialog: function(title,value,okCallback,opt_parent,opt_label,opt_cancelCallback){
            if (OverlayDialogListInstance == null) {
                throw new Error("not initialzed");
            }
            var id;
            var Dialog=createValueDialog(title,value,okCallback,opt_label,opt_cancelCallback);
            id=OverlayDialog.dialog(Dialog,opt_parent);
            return id;
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
        valueDialogPromise: function(title,value,opt_parent,opt_label){
            return new Promise(function(resolve,reject){
                var Dialog=createValueDialog(title,value,function(value){
                    resolve(value);
                    return true;
                },opt_label,function(){
                    reject();
                });
                OverlayDialog.dialog(Dialog,opt_parent);
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
        selectDialogPromise: function(title,list,opt_parent){
            return new Promise(function(resolve,reject){
                var Dialog=createSelectDialog(title,list,function(value){
                    resolve(value);
                    return true;
                },function(){
                    reject();
                });
                OverlayDialog.dialog(Dialog,opt_parent);
            })
        },
        /**
         * create an arbitrary dialog
         * @param html the react class to show (or the html string)
         * @param opt_parent
         * @param opt_options
         * @returns {object} the react element that we are showing - use this for hiding
         */
        dialog: function(html,opt_parent,opt_options){
            if (OverlayDialogListInstance == null) {
                throw new Error("not initialzed");
            }
            var options=avnav.assign({},opt_options||{},{parent:opt_parent});
            return OverlayDialogListInstance.show(html,options);
        },
        /**
         * hide the current dialog
         */
        hide: function(opt_item){
            if (OverlayDialogListInstance) OverlayDialogListInstance.hide(opt_item);
        }
    }
});

var createValueDialog=function(title,value,okCallback,opt_label,opt_cancelCallback) {
    if (OverlayDialogListInstance == null) {
        throw new Error("not initialzed");
    }
    var Dialog = React.createClass({
        propTypes: {
            closeCallback: React.PropTypes.func
        },
        getInitialState: function () {
            return {value: value};
        },
        valueChanged: function (event) {
            this.setState({value: event.target.value});
        },
        closeFunction: function (opt_skip) {
            if (this.props.closeCallback) this.props.closeCallback();
            if (! opt_skip && opt_cancelCallback) opt_cancelCallback();
        },
        okFunction: function (event) {
            var rt = okCallback(this.state.value, this.closeFunction);
            if (rt && this.props.closeCallback) this.props.closeCallback();
        },
        cancelFunction: function (event) {
            this.closeFunction();
        },
        render: function () {
            var html = (
                <div>
                    <h3 className="avn_dialogTitle">{title || 'Input'}</h3>
                    <div>
                        <div className="avn_row"><label>{opt_label || ''}</label>
                            <input type="text" name="value" value={this.state.value} onChange={this.valueChanged}/>
                        </div>
                    </div>
                    <button name="ok" onClick={this.okFunction}>Ok</button>
                    <button name="cancel" onClick={this.cancelFunction}>Cancel</button>
                    <div className="avn_clear"></div>
                </div>
            );
            return html;
        }
    });
    return Dialog;
};

var createSelectDialog=function(title,list,okCallback,opt_cancelCallback) {
    if (OverlayDialogListInstance == null) {
        throw new Error("not initialzed");
    }
    var Dialog = React.createClass({
        propTypes: {
            closeCallback: React.PropTypes.func
        },
        closeFunction: function (opt_skip) {
            if (this.props.closeCallback) this.props.closeCallback();
            if (! opt_skip && opt_cancelCallback) opt_cancelCallback();
        },
        okFunction: function (item) {
            var rt = okCallback(item, this.closeFunction);
            if (rt && this.props.closeCallback) this.props.closeCallback();
        },
        cancelFunction: function () {
            this.closeFunction();
        },
        render: function () {
            var self=this;
            return (
                <div className="avn_selectDialog">
                    <h3 className="avn_dialogTitle">{title || ''}</h3>
                    <div className="avn_selectList">
                        {list.map(function(elem){
                            return(
                            <div className={"avn_list_entry "+(elem.selected && 'avn_selectedItem')} onClick={function(){
                                self.okFunction(elem);
                            }}>{elem.label}</div>);
                        })}
                    </div>
                    <div className="avn_buttons">
                        <button name="cancel" onClick={this.cancelFunction}>Cancel</button>
                        <div className="avn_clear"></div>
                     </div>
                </div>
            );
        }
    });
    return Dialog;
};
module.exports= OverlayDialog;
