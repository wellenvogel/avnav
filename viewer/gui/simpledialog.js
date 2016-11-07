/**
 * Created by andreas on 26.09.16.
 * show a waypoint overlay
 * you can edit the waypoint data here
 */
/**
 *
 * @param {String} container
 * @param {Object} opt_options, values:
 *                 box
 *                 okCallback
 *                 cancelCallback
 */
var simpleDialog=function(container, opt_options){
    this._container=container;
    if (! opt_options) opt_options={};
    this._box=opt_options.box||'#avi_simple_input';
    this._overlay=new avnav.util.Overlay({box:this._box,cover:this._container});
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
};

simpleDialog.prototype.show=function(title,label,value){
    this._bindButtons();
    this._overlay.select('input[name=value]').val(value);
    this._overlay.select('label').text(label);
    this._overlay.select('.avn_dialogTitle').html(title);
    this._overlay.showOverlayBox();
};
module.exports=simpleDialog;
