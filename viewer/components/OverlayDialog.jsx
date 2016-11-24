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
var OverlayDialog=React.createClass({
    getInitialState: function(){
        return {

        };
    },
    render: function(){
        if (! this.state.content) return null;
        return(
            <div ref="container" className="avn_overlay_cover_active">
                <div ref="box" className="avn_dialog">{this.state.content}</div>
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
            window.setTimeout(hide,properties.timeout);
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
        if (oldState.cancelCallback){
            oldState.cancelCallback();
        }
        var newState={};
        for (var k in oldState){
            newState[k]=null;
        }
        this.setState(newState);
    },
    componentDidMount: function(){
        OverlayDialogListInstance=this;
    },
    componentWillUnmount: function(){
        var oldState=this.state;
        if (oldState.cancelCallback){
            oldState.cancelCallback();
        }
        OverlayDialogListInstance=undefined;
    },
    componentDidUpdate: function(){
        if (! this.state.content) return;
        var props=avnav.assign({},this.props,this.state);
        if (props.positionCallback){
            props.positionCallback(this.refs.container,this.refs.box);
        }
        else{
            var assingToViewport=true;
            if (props.parent){
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
                }catch(e){
                    avnav.log("invalid parent for dialog: "+e);
                }
            }
            if (assingToViewport){
                avnav.assign(this.refs.container.style, {
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0
                });
            }
            var rect=this.refs.container.getBoundingClientRect();
            avnav.assign(this.refs.box.style,{
                maxWidth: rect.width+"px",
                maxHeight: rect.height+"px",
                display: 'block',
                position: 'fixed',
                opacity: 0
            });
            var self=this;
            window.setTimeout(function(){
                var boxRect=self.refs.box.getBoundingClientRect();
                avnav.assign(self.refs.box.style,{
                    left: (rect.width-boxRect.width)/2+"px",
                    top: (rect.height-boxRect.height)/2+"px",
                    opacity: 1
                });
            },0);
        }
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
                var okFunction=function(el){
                    OverlayDialogListInstance.hide(html);
                    resolve();
                };
                var html=(
                    <div>
                        <h3 className="avn_dialogTitle">Alert</h3>
                        <div className="avn_dialogText">{text}</div>
                        <button name="ok" onClick={okFunction}>Ok</button>
                        <div className="avn_clear"></div>
                    </div>
                );
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
                var id;
                var okFunction=function(el){
                    OverlayDialogListInstance.hide(id);
                    resolve();
                };
                var cancelFunction=function(el){
                    OverlayDialogListInstance.hide(id);
                    reject();
                };
                var html=(
                    <div>
                        <h3 className="avn_dialogTitle">{opt_title||'Confirm'}</h3>
                        <div className="avn_dialogText">{text}</div>
                        <button name="ok" onClick={okFunction}>Ok</button>
                        <button name="cancel" onClick={cancelFunction}>Cancel</button>
                        <div className="avn_clear"></div>
                    </div>
                );
                if (OverlayDialogListInstance == null) {
                    reject(new Error("not initialzed"));
                    return;
                }
                id=OverlayDialogListInstance.show(html,
                    {
                        cancelCallback: function(){
                            reject();
                        },
                        parent: opt_parent

                    });
            });
        },
        /**
         * a simpel input value dialog
         * @param {string} title the title text to be displayed
         * @param {string} value the initial value
         * @param {function} okCallback the callback when OK is clicked, value as parameter
         *                   return false to keep the dialog open
         * @param opt_parent if set the parent HTML element
         * @param opt_label if set an additional label
         * @returns {*|OverlayDialog}
         */
        valueDialog: function(title,value,okCallback,opt_parent,opt_label){
            if (OverlayDialogListInstance == null) {
                throw new Error("not initialzed");
            }
            var id;
            var Dialog=React.createClass({
                getInitialState: function(){
                    return {value:value};
                },
                valueChanged:   function (event) {
                    this.setState({value:event.target.value});
                },
                okFunction: function (event) {
                    var rt = okCallback(this.state.value);
                    if (rt) OverlayDialogListInstance.hide(id);
                },
                cancelFunction:function (event) {
                    OverlayDialogListInstance.hide(id);
                },
                render: function() {
                    var html = (
                        <div>
                            <h3 className="avn_dialogTitle">{title || 'Input'}</h3>
                            <div>
                                <div className="avn_row"><label>{opt_label || ''}</label>
                                    <input type="text" name="value" value={this.state.value} onChange={this.valueChanged}/></div>
                            </div>
                            <button name="ok" onClick={this.okFunction}>Ok</button>
                            <button name="cancel" onClick={this.cancelFunction}>Cancel</button>
                            <div className="avn_clear"></div>
                        </div>
                    );
                    return html;
                }
        });
            id=OverlayDialog.dialog(<Dialog/>,opt_parent);
            return id;
        },
        /**
         * create an arbitrary dialog
         * @param html the react element to show
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



module.exports= OverlayDialog;
