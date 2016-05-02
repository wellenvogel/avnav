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
};
avnav.inherits(avnav.gui.WpInfoPage,avnav.gui.Page);

avnav.gui.WpInfoPage.prototype.localInit=function(){
};
avnav.gui.WpInfoPage.prototype.showPage=function(options) {
    if (!this.gui) return;
    if (options && options.wp) {
        this.wp = options.wp.clone();
        this.newWp= options.newWp||false;
    }
    else {
        this.wp=this.navobject.getRoutingHandler().getEditingWp();
        this.newWp=false;
    }
    if (! this.wp) this.returnToLast();
    this.fillData(true);
    this.updateButtons();
};
avnav.gui.WpInfoPage.prototype.updateButtons=function(){
    var markerLock=this.navobject.getRoutingHandler().getLock(); //TODO: make this generic
    this.handleToggleButton('.avb_LockMarker',markerLock);
};

avnav.gui.WpInfoPage.prototype.timerEvent=function(){
    this.updateButtons();
};
avnav.gui.WpInfoPage.prototype.fillData=function(initial){
    this.selectOnPage(".avn_infopage_inner").show();
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
    var wp=this.wp;
    if (wp.routeName !== undefined){
        this.selectOnPage('.avn_RouteInfo').show();
        this.selectOnPage('.avn_routeBtn').show();
    }else {
        this.selectOnPage('.avn_RouteInfo').hide();
        this.selectOnPage('.avn_routeBtn').hide();
    }
    var router=this.navobject.getRoutingHandler();
    var gps=this.navobject.getGpsHandler().getGpsData();
    var start=router.getCurrentLegStartWp();
    var legData=avnav.nav.NavCompute.computeLegInfo(wp,gps,start);
    var formattedData=this.navobject.formatLegData(legData);
    var isTarget=router.isCurrentRoutingTarget(wp);
    if (isTarget){
        this.selectOnPage('.avb_NavGoto').hide();
    }
    var isApproaching=router.isApproaching;
    var nextWp=router.getCurrentLegNextWp();
    if (nextWp){
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


};


avnav.gui.WpInfoPage.prototype.hidePage=function(){

};
//-------------------------- Buttons ----------------------------------------

avnav.gui.WpInfoPage.prototype.btnWpInfoGps=function (button,ev){
    log("gps clicked");
    this.gui.showPage('gpspage',{skipHistory:true});
};
avnav.gui.WpInfoPage.prototype.btnWpInfoLocate=function (button,ev){
    log("locate clicked");
    var navobject=this.navobject;
    var leg=navobject.getRoutingHandler().getCurrentLeg();
    var marker=navobject.getComputedValues().markerWp;
    this.gui.map.setCenter(marker);
    //make the current WP the active again...
    this.navobject.getRoutingHandler().resetEditingWp();
    this.returnToLast();
};
avnav.gui.WpInfoPage.prototype.btnShowRoutePanel=function (button,ev){
    log("route clicked");
    this.gui.showPage('navpage',{showRouting: true})
};
avnav.gui.WpInfoPage.prototype.btnLockMarker=function (button,ev){
    log("lock marker clicked");
    var nLock=! this.navobject.getRoutingHandler().getLock();
    if (! nLock) this.navobject.getRoutingHandler().routeOff();
    else {
        this.navobject.getRoutingHandler().wpOn(this.wp);
    }
    this.handleToggleButton(button,nLock);
    this.gui.map.triggerRender();
    this.returnToLast();
};

avnav.gui.WpInfoPage.prototype.btnNavNext=function (button,ev) {
    this.navobject.getRoutingHandler().moveEditingWp(1);
    this.navobject.getRoutingHandler().routeOn();
    this.returnToLast();
};
avnav.gui.WpInfoPage.prototype.btnOk=function (button,ev) {
    if (this.newWp) {
        this.navobject.getRoutingHandler().wpOnInactive(this.wp);
    }
    this.returnToLast();
};
/**
 * create the page instance
 */
(function(){
    //create an instance of the status page handler
    var page=new avnav.gui.WpInfoPage();
}());

