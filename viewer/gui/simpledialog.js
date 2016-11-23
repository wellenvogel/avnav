/**
 * Created by andreas on 26.09.16.
 * show a waypoint overlay
 * you can edit the waypoint data here
 */
var Overlay=require('../util/overlay');
/**
 *
 * @type {simpleDialog[]}
 */
var allDialogs=[];
var removeDialog=function(dialog){
    for (var i=0;i<allDialogs.length;i++){
        if (allDialogs[i] == dialog){
            allDialogs.splice(i,1);
            return;
        }
    }
};
var removeAllDialogs=function(){
    allDialogs.forEach(function(dialog){
       dialog.overlayClose();
    });
    allDialogs=[];
};
/**
 *
 * @param {String} container
 * @param {Object} opt_options, values:
 *                 box
 *                 boxHtml - alternative to box
 *                 okCallback
 *                 cancelCallback
 */
var simpleDialog=function(container, opt_options){
    this._container=container;
    if (! opt_options) opt_options={};
    this._box=opt_options.box||'#avi_simple_input';
    this._boxHtml=opt_options.boxHtml;
    this._overlay=new Overlay({box:this._box,boxHtml:this._boxHtml,cover:this._container});
    this._cancelCallback=opt_options.cancelCallback;
    this._okCallback=opt_options.okCallback;
    var self=this;
    this._buttonsBound=false;
};

/**
 * bind the buttons - we must do this lazily as the dom must have been loaded
 * @private
 */
simpleDialog.prototype._bindButtons=function(){
    if (this._buttonsBound) return;
    this._buttonsBound=true;
    var self=this;
    this._overlay.select('button[name=cancel]').bind('click',function(){
        var doClose=true;
        if (self._cancelCallback){
            doClose=self._cancelCallback();
        }
        if (doClose) self._overlay.overlayClose();
        return false;
    });
    if (! this._okCallback){
        this._overlay.select('button[name=ok]').hide();
    }
    else{
        this._overlay.select('button[name=ok]').show();
        this._overlay.select('button[name=ok]').bind('click',function(){
            var doClose=true;
            doClose=self._okCallback();
            if (doClose) self._overlay.overlayClose();
            return false;
        });
    }
};

simpleDialog.prototype.getData=function(){
    var data={
    };
    try {
        data = {
            value: this._overlay.select('input[name=value]').val(),
        };
    }catch(e){}
    return data;
};

simpleDialog.prototype.overlayClose=function(){
    this._overlay.overlayClose();
    if (this._boxHtml){
        this._buttonsBound=false;
    }
};

simpleDialog.prototype.show=function(title,label,value){
    this._overlay.showOverlayBox();
    this._bindButtons();
    this._overlay.select('input[name=value]').val(value);
    this._overlay.select('.avn_dialogText').text(label);
    this._overlay.select('label').text(label);
    this._overlay.select('.avn_dialogTitle').html(title);
};
/**
 *
 * @param {string} text the html text to display
 * @param {string|undefined} parent a jquery selector for the dialog container (defaults to document)
 * @param {string|undefined} opt_title the dialog title
 * @param {string|undefined} opt_content - the optional content id
 * @returns {*} a jquery promise
 */
simpleDialog.confirm=function(text,parent,opt_title){
    var deferred= $.Deferred();
    var title=opt_title||"Confirm";
    var parentSelector=parent ||'document';
    var dialog=new simpleDialog(parentSelector,{
        box:'#avi_simple_confirm',
        okCallback: function(){
            deferred.resolve();
            removeDialog(dialog);
            return true;
            }
        ,
        cancelCallback: function() {
            deferred.reject();
            removeDialog(dialog);
            return true;
        }
    });
    dialog.show(title,text);
    allDialogs.push(dialog);
    return deferred.promise();
};
simpleDialog.valueDialog=function(text,parent,value,opt_title,opt_label){
    var deferred= $.Deferred();
    var title=opt_title||"Input";
    var parentSelector=parent ||'document';
    var dialog=new simpleDialog(parentSelector,{
        box:'#avi_simple_confirm',
        okCallback: function(){
            var data=dialog.getData();
            deferred.resolve(data.value);
            removeDialog(dialog);
            return true;
        }
        ,
        cancelCallback: function() {
            deferred.reject();
            removeDialog(dialog);
            return true;
        }
    });
    dialog.show(title,opt_label||'',value);
    allDialogs.push(dialog);
    return deferred.promise();
};
simpleDialog.removeAllDialogs=function(){
    removeAllDialogs();
};
module.exports=simpleDialog;
