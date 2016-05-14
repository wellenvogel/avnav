/**
 * Created by andreas on 26.04.16.
 */
avnav.provide('avnav.gui.WpInfoPage');




/**
 *
 * @constructor
 */
avnav.gui.WpInfoPage=function(){
    avnav.gui.Page.call(this,'wpinfopage',
        {
            eventlist:[avnav.nav.NavEvent.EVENT_TYPE],
            returnOnClick: true
        }
    );
    /**
     * private
     * @type {string}
     */
    this.statusItem='.avn_Status';
    this.wp=undefined;
    this.newWp=false;
    /**
     *
     * @type {avnav.nav.RouteData}
     */
    this._router=undefined;

    this._overlay=new avnav.util.Overlay({
        box: '#avi_wpinfo_box',
        cover: '#avi_wpinfo_overlay'
    });
};
avnav.inherits(avnav.gui.WpInfoPage,avnav.gui.Page);

avnav.gui.WpInfoPage.prototype.localInit=function(){
    var self=this;
    this._router=this.navobject.getRoutingHandler();
    this.selectOnPage('button[name=cancel]').bind('click',function(){
        self._overlay.overlayClose();
        return false;
    });
    this.selectOnPage('button[name=ok]').bind('click',function(){
        self._overlay.overlayClose();
        self._updateWpFromEdit();
        return false;
    });
    $('#avi_wpinfo_box').click(function(ev){
        return false;
    });
};
avnav.gui.WpInfoPage.prototype.showPage=function(options) {
    if (!this.gui) return;
    if (options && options.wp) {
        this.wp = options.wp.clone();
        this.newWp= options.newWp||false;
    }
    else {
        this.wp=this._router.getEditingWp();
        this.newWp=false;
    }
    if (! this.wp) this.returnToLast();
    this.fillData(true);
};

avnav.gui.WpInfoPage.prototype.fillData=function(initial){
    if (! this._checkWpOk()) return;
    this.selectOnPage(".avn_infopage_inner").show();
    var wp=this.wp;
    if (this.newWp){
        this.selectOnPage('.avn_normalHeading').hide();
        this.selectOnPage('.avn_newHeading').show();
        this.selectOnPage('.avb_Ok').show();
    }
    else{
        this.selectOnPage('.avn_normalHeading').show();
        this.selectOnPage('.avn_newHeading').hide();
        this.selectOnPage('.avb_Ok').hide();
    }
    var router=this._router;
    var gps=this.navobject.getGpsHandler().getGpsData();
    var start=router.getCurrentLegStartWp();
    var legData=avnav.nav.NavCompute.computeLegInfo(wp,gps,start);
    var formattedData=this.navobject.formatLegData(legData);
    var isApproaching=router.isApproaching;
    var isTarget=router.isCurrentRoutingTarget(wp);
    var nextWp=router.getCurrentLegNextWp();
    var route=router.getEditingRoute();
    if (route && wp.routeName){
        var ownIdx=route.getIndexFromPoint(wp);
        if (ownIdx >= 0) {
            var numPoints = route.points.length;
            if (ownIdx > 0) this.selectOnPage('.avb_Back').prop("disabled",false);
            else this.selectOnPage('.avb_Back').prop('disabled',true);
            if (ownIdx < (numPoints - 1)) this.selectOnPage('.avb_Forward').prop("disabled",false);
            else this.selectOnPage('.avb_Forward').prop('disabled',true);
            ownIdx++;
            formattedData.routeIndex = ownIdx+"/"+numPoints;
        }
    }
    if (wp.routeName !== undefined){
        this.selectOnPage('.avb_ShowRoutePanel').show();
        this.selectOnPage('.avb_Forward').show();
        this.selectOnPage('.avb_Back').show();
    }else {
        this.selectOnPage('.avb_ShowRoutePanel').hide();
        this.selectOnPage('.avb_Forward').hide();
        this.selectOnPage('.avb_Back').hide();
    }
    if (isTarget) {
        this.selectOnPage('.avb_NavGoto').hide();
    }
    else {
        this.selectOnPage('.avb_NavGoto').show();
    }
    if (isTarget && nextWp){
        formattedData.nextName=nextWp.name;
        var nextLeg=avnav.nav.NavCompute.computeLegInfo(nextWp,gps,undefined);
        var nextFormatted=this.navobject.formatLegData(nextLeg);
        var k;
        for (k in nextFormatted){
            formattedData["next"+k]=nextFormatted[k];
        }
        this.selectOnPage(".avn_NextLeg").show();
        this.selectOnPage(".avb_NavNext").show();
    }
    else{
        this.selectOnPage(".avn_NextLeg").hide();
        this.selectOnPage(".avb_NavNext").hide();
    }
    this.selectOnPage("[data-name]").each(function(idx,el){
        var name=$(this).attr('data-name');
        if (! name) return;
        var val=undefined;
        if (name =='markerName') val=wp.name;
        if (name == 'routeName') val=wp.routeName;
        if (val === undefined){
            val=formattedData[name];
            if (name == 'markerXte' && ! isTarget) val="---";//do not show any xte if we are not the target
        }
        if (val === undefined) val="---";
        $(this).text(val);
    });
    if (! isTarget){
        this.selectOnPage('.avn_Status').removeClass('avn_routingActive avn_routingApproach').
            addClass('avn_routingInactive');
    }else{
        if (isApproaching){
            this.selectOnPage('.avn_Status').removeClass('avn_routingActive avn_routingInactíve').
            addClass('avn_routingApproach');
        }
        else{
            this.selectOnPage('.avn_Status').removeClass('avn_routingInactive avn_routingApproach').
            addClass('avn_routingActive');
        }
    }
    var markerLock=this._router.getLock();
    if (!markerLock) this.selectOnPage('.avb_StopNav').hide();
    else this.selectOnPage('.avb_StopNav').show();
    this.handleToggleButton('.avb_StopNav',markerLock);
};


avnav.gui.WpInfoPage.prototype.hidePage=function(){
    this._overlay.overlayClose();
};
avnav.gui.WpInfoPage.prototype._editWp=function(){
    this.selectOnPage('input[name=name]').val(this.wp.name);
    this.selectOnPage('input[name=lon]').val(this.wp.lon);
    this.selectOnPage('input[name=lat]').val(this.wp.lat);
    this._overlay.showOverlayBox();
};
avnav.gui.WpInfoPage.prototype._updateWpFromEdit=function(){
    if (! this._checkWpOk()) return;
    var wp=this.wp.clone();
    wp.name=this.selectOnPage('input[name=name]').val();
    wp.lon=parseFloat(this.selectOnPage('input[name=lon]').val());
    wp.lat=parseFloat(this.selectOnPage('input[name=lat]').val());
    if (this.newWp){
        this.wp=wp;
    }
    else {
        var ok=undefined;
        var doChange=true;
        var rt = this._router.getEditingRoute();
        if (this.wp.routeName) {
            if (rt) {
                var idx = rt.getIndexFromPoint(this.wp);
                if (idx <0) {
                    avnav.util.Overlay.Toast("internal error, cannot find waypoint", 5000);
                    doChange=false;
                }
                else {
                    ok = rt.checkChangePossible(idx,wp);
                    if (!ok) {
                        avnav.util.Overlay.Toast("name already exists, cannot change", 5000);
                        doChange=false;
                    }
                }
            }
        }
        if (doChange) {
            ok = this._router.changeWp(this.wp, wp);
            if (ok) {
                this.wp = wp
            }
            else {
                avnav.util.Overlay.Toast("cannot change waypoint", 5000);
            }
        }
    }
    this.fillData(false);
};
/*
    check if the current waypoint is still valid:
    either new - always ok
    or check against wp from routing data - either editingWp or currentTarget
 */
avnav.gui.WpInfoPage.prototype._checkWpOk=function(){
    if (this.newWp) return true;
    var isOk=true;
    if (this.wp.routeName){
        var rt=this._router.getEditingRoute();
        var idx=-1;
        if (rt) idx=rt.getIndexFromPoint(this.wp);
        if (idx < 0) isOk=false;
    }
    else {
        var evp = this._router.getEditingWp();
        if (!evp || !evp.compare(this.wp)) {
            isOk = false;
        }
    }
    if (!isOk) {
        var self = this;
        window.setTimeout(function () {
            if (! self.isVisible()) return;
            avnav.util.Overlay.Toast("waypoint is not valid any more", 5000);
            self.returnToLast();
        }, 0);
        return false;
    }
    return true;
};
//-------------------------- Buttons ----------------------------------------

avnav.gui.WpInfoPage.prototype.btnWpInfoGps=function (button,ev){
    log("gps clicked");
    this.gui.showPage('gpspage',{skipHistory:true});
};
avnav.gui.WpInfoPage.prototype.btnWpInfoLocate=function (button,ev){
    log("locate clicked");
    this.gui.map.setCenter(this.wp);
    this._router.setEditingWp(this.wp);
    //make the current WP the active again...
    this._router.resetEditingWp();
    this.returnToLast();
};
avnav.gui.WpInfoPage.prototype.btnShowRoutePanel=function (button,ev){
    log("route clicked");
    this.gui.showPage('navpage',{showRouting: true})
};
avnav.gui.WpInfoPage.prototype.btnStopNav=function (button,ev){
    log("stopNav clicked");
    this._router.routeOff();
    this.returnToLast();
};
avnav.gui.WpInfoPage.prototype.btnNavGoto=function (button,ev){
    log("navGoto clicked");
    this._router.wpOn(this.wp);
    this.returnToLast();
};

avnav.gui.WpInfoPage.prototype.btnNavNext=function (button,ev) {
    if (this.newWp) return;
    this._router.moveEditingWp(1);
    this._router.routeOn();
    this.returnToLast();
};
avnav.gui.WpInfoPage.prototype.btnOk=function (button,ev) {
    if (this.newWp) {
        this._router.wpOnInactive(this.wp);
    }
    this.returnToLast();
};
avnav.gui.WpInfoPage.prototype.btnForward=function (button,ev) {
    if (this.newWp) return;
    this._router.moveEditingWp(1);
    this.wp=this._router.getEditingWp();
    this.fillData(false);
};
avnav.gui.WpInfoPage.prototype.btnBack=function (button,ev) {
    if (this.newWp) return;
    this._router.moveEditingWp(-1);
    this.wp=this._router.getEditingWp();
    this.fillData(false);
};
avnav.gui.WpInfoPage.prototype.btnEdit=function (button,ev) {
    this._editWp();
};
/**
 * create the page instance
 */
(function(){
    //create an instance of the status page handler
    var page=new avnav.gui.WpInfoPage();
}());

