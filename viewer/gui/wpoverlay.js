/**
 * Created by andreas on 26.09.16.
 * show a waypoint overlay
 * you can edit the waypoint data here
 */
var navdata=require('../nav/navdata');
/**
 *
 * @param {String} container
 * @param {Object} opt_options, values:
 *                 box
 *                 okCallback
 *                 cancelCallback
 */
var wpOverlay=function(container,opt_options){
    this._container=container;
    if (! opt_options) opt_options={};
    this._box=opt_options.box||'#avi_wpinfo_box';
    this._overlay=new avnav.util.Overlay({box:this._box,cover:this._container});
    this._cancelCallback=opt_options.cancelCallback;
    this._okCallback=opt_options.okCallback;
    var self=this;
    this._buttonsBound=false;
    this._currentWp=undefined;
};

/**
 * bind the buttons - we must do this lazily as the dom must have been loaded
 * @private
 */
wpOverlay.prototype._bindButtons=function(){
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

/**
 *
 * @param {navdata.WayPoint} wp
 */
wpOverlay.prototype.show=function(wp){
    if (! wp) return;
    this._currentWp=wp;
    this._bindButtons();
    this._overlay.select('input[name=name]').val(wp.name);
    this._overlay.select('input[name=lon]').val(Geo.toLon(wp.lon,'dm',4));
    this._overlay.select('input[name=lat]').val(Geo.toLat(wp.lat,'dm',4));
    this._overlay.showOverlayBox();
};
wpOverlay.prototype.getData=function(){
    var data={
    };
    try {
        data = {
            name: this._overlay.select('input[name=name]').val(),
            lat: Geo.parseDMS(this._overlay.select('input[name=lat]').val()),
            lon: Geo.parseDMS(this._overlay.select('input[name=lon]').val().replace(/o/i, 'e'))
        };
        if (data.lat < -180 || data.lat > 180) delete data.lat;
        if (data.lon < -90 || data.lon > 90) delete data.lon;
    }catch(e){}
    return data;
};

wpOverlay.prototype.overlayClose=function(){
    this._overlay.overlayClose();
};
/**
 * update the waypoint at the router
 * @param {boolean} showErrors show error infos (using toast)
 * @param {avnav.nav.RouteData} router if undefined - do not update there
 * @param {navdata.WayPoint} opt_oldWp - if given use this as the old waypoint
 * @returns {navdata.WayPoint} the changed wp or undefined if no change
 */
wpOverlay.prototype.updateWp=function(showErrors,router,opt_oldWp){
    var oldWp=opt_oldWp||this._currentWp;
    var wp=oldWp.clone();
    var data=this.getData();
    if (! data) return;
    wp.name=data.name;
    var doChange=true;
    try {
        wp.lon = data.lon;
        if (isNaN(wp.lon)|| wp.lon === undefined){
            if (showErrors)avnav.util.Overlay.Toast("invalid lon, cannot convert ", 5000);
            doChange=false;
        }
        wp.lat=data.lat;
        if (isNaN(wp.lat)|| wp.lat === undefined){
            if (showErrors)avnav.util.Overlay.Toast("invalid lat, cannot convert ", 5000);
            doChange=false;
        }
    }catch (e){
        if (showErrors)avnav.util.Overlay.Toast("invalid coordinate, cannot convert", 5000);
        doChange=false;
    }
    if (! doChange) return ;
    if (! router) return wp;
    var ok = false;
    if (wp.routeName && wp.routeName != oldWp.routeName){
        if (showErrors)avnav.util.Overlay.Toast("internal error, route name changed", 5000);
        doChange=false;
    }
    if (wp.routeName && doChange) {
        var rt = router.getRouteByName(oldWp.routeName);
        if (rt) {
            var idx = rt.getIndexFromPoint(oldWp);
            if (idx < 0) {
                if (showErrors)avnav.util.Overlay.Toast("internal error, cannot find waypoint", 5000);
                doChange = false;
            }
            else {
                ok = rt.checkChangePossible(idx, wp);
                if (!ok) {
                    if (showErrors)avnav.util.Overlay.Toast("name already exists, cannot change", 5000);
                    doChange = false;
                }
            }
        }
    }
    if (doChange) {
        ok = router.changeWp(oldWp, wp);
        if (ok) {
            return wp;
        }
        else {
            if (showErrors)avnav.util.Overlay.Toast("cannot change waypoint", 5000);
            return;
        }
    }
};

/**
 * return the old (unchanged) waypoint from the last show call
 * @returns {undefined|*|navdata.WayPoint}
 */
wpOverlay.prototype.getOldWp=function(){
    return this._currentWp;
};

module.exports=wpOverlay;
