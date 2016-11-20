/**
 * Created by andreas on 02.05.14.
 */
var WpOverlay=require('./wpoverlay.js');
var React=require('react');
var ReactDOM=require('react-dom');
var WaypointList=require('../components/ItemList.jsx');
var WaypointItem=require('../components/WayPointItem.jsx');
/** @type {DynLayout} */
var DynLayout=require('../util/dynlayout');
var WidgetContainer=require('../components/WidgetContainer.jsx');
avnav.provide('avnav.gui.Navpage');



/**
 *
 * @constructor
 * @extends {avnav.gui.Page}
 */
avnav.gui.Navpage=function(){
    avnav.gui.Page.call(this,'navpage');
    /** @private */
    this.options_=null;
    /**
     * the current visible overlay (jQuery object)
     * @type {null}
     */
    this.overlay=null;
    /**
     * the time (in ms) when the current overlay should be hidden
     * @type {number}
     */
    this.hidetime=0;
    /**
     * the dom id of the map
     * @private
     * @type {string}
     */
    this.mapdom='avi_map_navpage';
    var self=this;
    /**
     * @private
     * @type {boolean}
     */
    this.routingVisible=false;

    /**
     * @private
     * @type {avnav.nav.navdata.WayPoint}
     */
    this.selectedWp=undefined;
    /**
     * the time (in ms) when the wp buttons should be hidden
     * @type {number}
     */
    this.wpHidetime=0;

    /**
     * keep the lock mode when showing routing
     * @private
     * @type {boolean}
     */
    this.lastGpsLock=false;

    /**
     * load chart when showing first
     * @type {boolean}
     */
    this.firstShow=true;


    /**
     * @private
     * @type {avnav.nav.Route}
     */
    this.lastRoute=new avnav.nav.Route("");
    /**
     * @private
     * @type {avnav.util.Formatter}
     */
    this.formatter=new avnav.util.Formatter();


    this.showRouteOnReturn=false;

    this.waypointList=undefined;
    /**
     * @private
     * @type {DynLayout[]}
     */
    this.bottomLayoutContainers=[];

    this.bottomContainers=[
        {
            selector:'#leftBottomMarker',
            inverted: false,
            direction: 'left'
        },
        {
            selector:'#leftBottomPosition',
            inverted: false,
            direction: 'right'
        }
    ];
    /**
     * @private
     * @type {DynLayout[]}
     */
    this.sideLayoutContainers=[];
};
avnav.inherits(avnav.gui.Navpage,avnav.gui.Page);

/**
 * get the mapholder
 * @private
 * @returns {avnav.map.MapHolder}
 */
avnav.gui.Navpage.prototype.getMap=function(){
    if (!this.gui) return null;
    return this.gui.map;
};


avnav.gui.Navpage.prototype.showPage=function(options){
    if (!this.gui) return;
    var self = this;
    this.hideWpButtons();
    this.fillDisplayFromGps();
    var newMap=false;
    var brightness=1;
    if (this.gui.properties.getProperties().nightMode) {
        brightness=this.gui.properties.getProperties().nightChartFade/100;
    }
    this.buttonUpdate();
    if (options && options.url) {
        newMap=true;
        if (this.options_){
            if (this.options_.url == options.url && this.options_.charturl == options.charturl) newMap=false;
        }
        this.options_=options;
    }
    else {
        if (! this.options_){
            alert("invalid navpage call - no chart selected");
            return;
        }
    }
    if (newMap|| this.firstShow) {
        //chartbase: optional url for charts
        //list: the base url
        var chartbase = this.options_.charturl;
        var list = this.options_.url;
        if (!chartbase) {
            chartbase = list;
        }
        if (!list.match(/^http:/)) {
            if (list.match(/^\//)) {
                list = window.location.href.replace(/^([^\/:]*:\/\/[^\/]*).*/, '$1') + list;
            }
            else {
                list = window.location.href.replace(/[?].*/, '').replace(/[^\/]*$/, '') + "/" + list;
            }
        }
        var url = list + "/avnav.xml";
        $.ajax({
            url: url,
            dataType: 'xml',
            cache: false,
            success: function (data) {
                self.getMap().initMap(self.mapdom, data, chartbase);
                self.getMap().setBrightness(brightness);
            },
            error: function (ev) {
                alert("unable to load charts " + ev.responseText);
            }
        });
    }
    this.firstShow=false;
    this.getMap().setBrightness(brightness);
    this.updateMainPanelSize('#'+this.mapdom);
    this.getMap().updateSize();
    if (!this.gui.properties.getProperties().layers.ais){
        $('#avi_aisInfo').hide();
    }
    this.gui.navobject.setAisCenterMode(avnav.nav.AisCenterMode.MAP);
    this.updateAisPanel();
    this.fillDisplayFromGps();
    if (!this.gui.properties.getProperties().layers.nav) this.hideRouting();
    if (this.gui.properties.getProperties().showClock) this.selectOnPage('#avi_navpage_clock').show();
    else this.selectOnPage('#avi_navpage_clock').hide();
    this.handleRouteDisplay();
    var showRouting=options && options.showRouting;
    if (! showRouting ){
        showRouting=options && options.returning && this.showRouteOnReturn;
    }
    if (showRouting){
        this.showRouting(options && options.returning);
    }
    else {
        this.hideRouting();
    }
    this.updateRoutePoints(true,showRouting);
    self.bottomLayoutContainers.forEach(function(layout){
        layout.reset();
    });
    window.setTimeout(function(){
        self.bottomLayoutContainers.forEach(function(layout){
            layout.init()
        });
        self.updateLayout();
    },0);

};
/**
 * the periodic timer call
 * update buttons and handle hiding of overlay
 * @param startTimer
 */
avnav.gui.Navpage.prototype.buttonUpdate=function(){
    //TODO: make this more generic
    var markerLock=this.navobject.getRoutingHandler().getLock()||false;
    this.handleToggleButton('.avb_LockMarker',markerLock);
    if (markerLock || this.routingVisible) this.selectOnPage('.avb_LockMarker').hide();
    else this.showBlock('.avb_LockMarker');
    this.handleToggleButton('.avb_StopNav',markerLock);
    if (!markerLock || this.routingVisible) this.selectOnPage('.avb_StopNav').hide();
    else this.showBlock('.avb_StopNav');
    var gpsLock=this.gui.map.getGpsLock();
    this.handleToggleButton('.avb_LockPos',gpsLock);
    var courseUp=this.gui.map.getCourseUp();
    this.handleToggleButton('.avb_CourseUp',courseUp);
    if (this.selectedWp){
        var router=this.navobject.getRoutingHandler();
        if (router.isCurrentRoutingTarget(this.selectedWp)){
            this.selectOnPage('.avb_WpGoto').hide();
            this.selectOnPage('.avb_NavNext').show();
        }
        else{
            this.selectOnPage('.avb_WpGoto').show();
            this.selectOnPage('.avb_NavNext').hide();
        }
        if (this.selectedWp.routeName){
            this.selectOnPage('.avb_WpNext').show();
            this.selectOnPage('.avb_WpPrevious').show();
        }
        else{
            this.selectOnPage('.avb_WpNext').hide();
            this.selectOnPage('.avb_WpPrevious').hide();
            this.selectOnPage('.avb_NavNext').hide();
        }
    }
};

avnav.gui.Navpage.prototype.timerEvent=function(){
    if (this.hidetime >0 && this.hidetime <= new Date().getTime()|| this.gui.map.getGpsLock()){
        this.hideOverlay();
        this.hidetime=0;
    }
    if (this.wpHidetime > 0 && this.wpHidetime <= new Date().getTime()){
        this.hideWpButtons();
    }
    this.buttonUpdate();
};
avnav.gui.Navpage.prototype.hidePage=function(){
    this.hideOverlay();
    this.hideWpButtons();
    this.hidetime=0;
    this.showRouteOnReturn=this.routingVisible;
    this.hideRouting(true);
    this._wpOverlay.overlayClose();
};
/**
 *
 */
avnav.gui.Navpage.prototype.localInit=function(){
    var self=this;
    $('#leftBottomMarker').click({page:this},function(ev){
        var wp=self.navobject.getRoutingHandler().getCurrentLegTarget();
        if (wp){
            if (self.routingVisible) {
                self.gui.map.setCenter(wp);
                return;
            }
            self.showWpButtons(wp);
        }
    });
    $('#leftBottomPosition').click({page:this},function(ev){
        ev.stopPropagation();
        self.gui.showPage('gpspage');
    });
    $('#avi_centerDisplay').click({page:this},function(ev){
       ev.data.page.hideOverlay();
    });
    $('#avi_aisInfo').click(function(ev){
        var mmsi=$(this).attr('data-aismmsi');
        if (mmsi===undefined || mmsi == "") return;
        self.gui.showPage('aisinfopage',{mmsi:mmsi});
    });
    var self=this;
    $('#avi_route_info_navpage_inner').click({page:this},function(ev){
        ev.data.page.gui.showPage('routepage');
    });
    $('#avi_routeDisplay').click({page:this},function(ev){
        self.navobject.getRoutingHandler().startEditingRoute();
        self.gui.showPage("routepage");
    });
    $(document).on(avnav.nav.NavEvent.EVENT_TYPE, function(ev,evdata){
        self.navEvent(evdata);
    });
    $(document).on(avnav.map.MapEvent.EVENT_TYPE, function(ev,evdata){
        self.mapEvent(evdata);
    });
    $(document).on(avnav.util.PropertyChangeEvent.EVENT_TYPE,function(){
        self.updateMainPanelSize('#'+self.mapdom);
    });
    $(window).on('resize',function(){
        self.updateLayout();
    });
    var list=React.createElement(WaypointList, {
        onClick:function(idx,opt_data){
            self.waypointClicked(idx,opt_data);
        },
        itemClass:WaypointItem,
        selectors:{
            selected: 'avn_route_info_active_point',
            centered: 'avn_route_info_centered'
        },
        updateCallback: function(){
            self.scrollRoutePoints();
        }
    });
    this.waypointList=ReactDOM.render(list,document.getElementById('avi_route_info_list'));

    var boatWidgets=React.createElement(WidgetContainer,{
        onClick: function(widgetDescription){

        },
        updateCallback: function(){
            self.updateLayout();
        },
        items: ['COG','SOG','TimeStatus','Position'],
        store: self.navobject
    });
    ReactDOM.render(boatWidgets,document.getElementById('leftBottomPosition'));
    var markerWidgets=React.createElement(WidgetContainer,{
        onClick: function(widgetDescription){

        },
        updateCallback: function(){
            self.updateLayout();
        },
        items: ['BRG','DST','ETA','WpPosition'],
        store: self.navobject
    });
    ReactDOM.render(markerWidgets,document.getElementById('leftBottomMarker'));
    this._wpOverlay=new WpOverlay(this.selectOnPage('.avn_left_panel'),{
        okCallback:function(){
            var close=self._updateWpFromEdit();
            return close;
        },
        cancelCallback: function(){return true;}
    });
    this.readLayout();
};

/**
 * read the elements to be layouted
 * @private
 */
avnav.gui.Navpage.prototype.readLayout=function(){
    var self=this;
    this.bottomContainers.forEach(function(el){
        var rowLayout=new DynLayout(el.selector,'.avn_widget',{
            inverted:el.inverted,
            direction:el.direction,
            marginLocation:1
        });
        rowLayout.init();
        self.bottomLayoutContainers.push(rowLayout);
    });
    var sideLayout=new DynLayout('#avi_navLeftContainer','.avn_widget',{
        inverted: false,
        direction: 'bottom',
        scale: false
    });
    sideLayout.init();
    this.sideLayoutContainers.push(sideLayout);
};



/**
 * @private
 * @param {Array.<string>} opt_names
 */
avnav.gui.Navpage.prototype.fillDisplayFromGps=function(opt_names){
    if (! this.navobject) return;
    if (this.navobject.getRoutingHandler().getApproaching()){
        $('#avi_routeDisplay').addClass('avn_route_display_approach');
        $('#avi_routeDisplay_next').show();
    }
    else {
        $('#avi_routeDisplay').removeClass('avn_route_display_approach');
        $('#avi_routeDisplay_next').hide();
    }
};

/**
 * update the AIS panel
 */
avnav.gui.Navpage.prototype.updateAisPanel=function() {
    if (!this.gui.properties.getProperties().layers.ais) return;
    var nearestTarget = this.navobject.getAisHandler().getNearestAisTarget();
    if (nearestTarget.mmsi) {
        $('#avi_aisInfo').attr('data-aismmsi', nearestTarget.mmsi);
        var color=this.gui.properties.getAisColor({
            warning: nearestTarget.warning,
            nearest: nearestTarget.nearest
        });
        $('#avi_aisInfo').css('background-color',color);
    }
    var isHidden=$('#avi_aisInfo').is(':hidden');
    if (nearestTarget.mmsi && ! this.routingVisible) {
        $('#avi_aisInfo').show();
        if (isHidden) this.updateLayout();
    }
    else {
        $('#avi_aisInfo').hide();
        if (! isHidden) this.updateLayout();
    }
};

/**
 *
 * @param {avnav.nav.NavEvent} evdata
 */
avnav.gui.Navpage.prototype.navEvent=function(evdata){
    if (! this.visible) return;
    if (evdata.type == avnav.nav.NavEventType.AIS){
        this.updateAisPanel();
    }
    if (evdata.type == avnav.nav.NavEventType.ROUTE){
        this.handleRouteDisplay();
        if (this.routingVisible)this.updateRoutePoints();
    }
    this.fillDisplayFromGps(evdata.changedNames);
};
/**
 *
 * @param {avnav.map.MapEvent} evdata
 */
avnav.gui.Navpage.prototype.mapEvent=function(evdata){
    if (! this.visible) return;
    if (evdata.type == avnav.map.EventType.MOVE) {
        //show the center display if not visible
        if (! this.routingVisible) {
            if (this.overlay != null) {
                this.hidetime = new Date().getTime() + this.gui.properties.getProperties().centerDisplayTimeout;
                return;
            }
            this.overlay = this.getDiv().find('#avi_centerDisplay');
            this.hidetime = new Date().getTime() + this.gui.properties.getProperties().centerDisplayTimeout;
            this.overlay.show();
            this.updateLayout();
        }
    }
    if (evdata.type == avnav.map.EventType.SELECTAIS){
        var aisparam=evdata.parameter.aisparam;
        if (! aisparam) return;
        if (aisparam.mmsi){
            this.navobject.getAisHandler().setTrackedTarget(aisparam.mmsi);
            this.gui.showPage('aisinfopage',{mmsi: aisparam.mmsi});
        }
    }
    if (evdata.type == avnav.map.EventType.SELECTWP){
        var wp=evdata.parameter.wp;
        if (! wp) return;
        var currentEditing=this.navobject.getRoutingHandler().getEditingWp();
        if (this.routingVisible){
            if (currentEditing && currentEditing.compare(wp)){
                this._wpOverlay.show(wp);
            }
            else {
                this.navobject.getRoutingHandler().setEditingWp(wp);
            }
            this.updateRoutePoints();
        }
        else{
            this._wpOverlay.show(wp);
        }
    }
};

/**
 * hide the center overlay
 */
avnav.gui.Navpage.prototype.hideOverlay=function(){
    if (this.overlay != null){
        this.overlay.hide();
        this.overlay=null;
        this.hidetime=0;
        this.updateLayout();
    }
};
/**
 * show the route editing part
 * @param {boolean} opt_returning
 */
avnav.gui.Navpage.prototype.showRouting=function(opt_returning) {
    this.hideWpButtons();
    if (this.routingVisible) return;
    if (!this.gui.properties.getProperties().layers.nav) return;
    var upd=false;
    //this.showHideAdditionalPanel('#avi_second_buttons_navpage', true, '#' + this.mapdom);
    var routeActive=this.navobject.getRoutingHandler().hasActiveRoute();
    this.showBlock('.avn_routeBtn');
    this.selectOnPage('.avn_noRouteBtn').hide();
    if (this.showHideAdditionalPanel('#avi_route_info_navpage', true, '#' + this.mapdom)) upd=true;
    if (upd)this.gui.map.updateSize();
    this.routingVisible=true;
    this.handleToggleButton('.avb_ShowRoutePanel',true);
    var isReactivating=false;
    if (opt_returning ){
        //first try to reactivate the las editing route
        if (this.navobject.getRoutingHandler().getEditingRoute()){
            isReactivating=true;
        }
    }
    if (! isReactivating) {
        this.navobject.getRoutingHandler().stopEditingRoute(); //always reset to active route if any
                                                               //TODO: should we keep the last edited route?
        this.navobject.getRoutingHandler().startEditingRoute();
    }
    this.gui.map.setRoutingActive(true);
    this.handleRouteDisplay();
    this.updateRoutePoints(true,isReactivating);
    //if (this.gui.isMobileBrowser()) this.showWpPopUp(this.navobject.getRoutingData().getActiveWpIdx());
    var nLock=this.gui.map.getGpsLock();
    this.lastGpsLock=nLock;
    if (nLock) {
        this.gui.map.setGpsLock(!nLock);
        this.handleToggleButton('.avb_LockPos', !nLock);
        this.gui.map.triggerRender();
    }
    this.hideOverlay();
    this.updateAisPanel();
    this.selectOnPage('#avi_navLeftContainer').css('opacity',0);
};

/**
 * @private
 * @param {boolean} opt_noStop - do not stop editing
 */
avnav.gui.Navpage.prototype.hideRouting=function(opt_noStop) {
    var upd=false;
    //this.showHideAdditionalPanel('#avi_second_buttons_navpage', false, '#' + this.mapdom);
    this.selectOnPage('.avn_routeBtn').hide();
    this.showBlock('.avn_noRouteBtn');
    if (this.showHideAdditionalPanel('#avi_route_info_navpage', false, '#' + this.mapdom)) upd=true;
    if (upd) this.gui.map.updateSize();
    this.routingVisible=false;
    this.handleToggleButton('.avb_ShowRoutePanel',false);
    if (! opt_noStop) {
        this.gui.map.setRoutingActive(false);
        this.navobject.getRoutingHandler().stopEditingRoute();
    }
    this.handleRouteDisplay();
    if (this.lastGpsLock) {
        this.gui.map.setGpsLock(true);
        this.lastGpsLock=false;
    }
    $('#avi_route_info_navpage_inner').removeClass("avn_activeRoute avn_otherRoute");
    this.updateAisPanel();
    this.selectOnPage('#avi_navLeftContainer').css('opacity',1);
    this._wpOverlay.overlayClose();
};

/**
 * control the route display
 * @private
 */
avnav.gui.Navpage.prototype.handleRouteDisplay=function() {
    if (! this.navobject) return;
    var routeActive=this.navobject.getRoutingHandler().hasActiveRoute();
    if (routeActive && ! this.routingVisible  ){
        $('#avi_routeDisplay').show();
    }
    else {
        $('#avi_routeDisplay').hide();
    }
    this.updateLayout();
};

/**
 * @private
 */
avnav.gui.Navpage.prototype.updateSideContainers=function() {
    var self=this;
    var reset=$(window).width() <= this.gui.properties.getProperties().smallBreak;
    this.sideLayoutContainers.forEach(function (container) {
        if (reset){
            container.reset();
        }
        else {
            container.layout({
                maxSize: self.selectOnPage('.avn_left_panel').height() - $('#avi_nav_bottom').outerHeight()
            });
        }
    });
};
/** @private */
avnav.gui.Navpage.prototype.updateLayout=function(){
    var self=this;
    window.setTimeout(function(){
        var rtop=$('#avi_nav_bottom').outerHeight();
        $('#avi_navLeftContainer').css('bottom',rtop+"px");
        $('#avi_navpage_wpbuttons').css('bottom',rtop+"px");
        $('#avi_route_info_navpage').css('bottom',rtop+"px");
        self.scrollRoutePoints();
        self.updateSideContainers();
    },0);
    /**layout for the bottom part:
     * we determine which elements will be visible in the top row
     * the left most will be set to the width of the left container, the others will be stretched
     * 3 steps:
     * - remove all width stuff
     * - compute visibility and current width
     * - set new width
     */
    var outerElWidth=$('#avi_navLeftContainer').width();
    this.bottomLayoutContainers.forEach(function(rowLayout){
       rowLayout.layout({
           maxRowCol:self.gui.properties.getProperties().allowTwoWidgetRows?2:1,
           outerSize: outerElWidth
       })
    });
};

avnav.gui.Navpage.prototype.waypointClicked=function(idx,options){
    if (options.item && options.item != 'main') return;
    this.navobject.getRoutingHandler().setEditingWpIdx(idx);
    var selectors=['selected'];
    if (! options.centered) {
        this.getMap().setCenter(this.navobject.getRoutingHandler().getEditingWp());
        selectors.push('centered');
    }
    if (options.selected && options.centered){
        this._wpOverlay.show(this.navobject.getRoutingHandler().getEditingWp());
    }
    this.waypointList.setSelectors(idx,selectors);
};

avnav.gui.Navpage.prototype.scrollRoutePoints=function(){
    avnav.util.Helper.scrollItemIntoView('.avn_route_info_active_point','#avi_route_info_list');
};
avnav.gui.Navpage.prototype.updateRoutePoints=function(opt_force,opt_centerActive){
    var editingActiveRoute=this.navobject.getRoutingHandler().isEditingActiveRoute();
    $('#avi_route_info_navpage_inner').removeClass("avn_activeRoute avn_otherRoute");
    $('#avi_route_info_navpage_inner').addClass(editingActiveRoute?"avn_activeRoute":"avn_otherRoute");
    var html="";
    var route=this.navobject.getRoutingHandler().getRoute();
    if (route) {
        var rname = route.name.substr(0, 14);
        if (route.name.length > 14) rname += "..";
        $('#avi_route_info_name').text(rname);
    }
    else {
        this.waypointList.setState({
            itemList:[],
            options: {showLatLon: this.gui.properties.getProperties().routeShowLL}
        });
        return;
    }
    var active=this.navobject.getRoutingHandler().getEditingWpIdx();
    var self=this;
    var rebuild=opt_force||false;
    if (! rebuild) rebuild=this.lastRoute.differsTo(route);
    this.lastRoute=route.clone();
    if (rebuild){
        var waypoints=route.getFormattedPoints();
        this.waypointList.setState({
            itemList:waypoints,
            options: {showLatLon: this.gui.properties.getProperties().routeShowLL}
        });
    }
    else {
        this.waypointList.setState({
            options:{showLatLon: this.gui.properties.getProperties().routeShowLL}
        });
        //update
    }
    var selectors=['selected'];
    var activeWp=route.getPointAtIndex(active);
    if (opt_centerActive && activeWp){
        this.gui.map.setCenter(activeWp);
        selectors.push('centered')
    }
    this.waypointList.setSelectors(active,selectors);
};



avnav.gui.Navpage.prototype.checkRouteWritable=function(){
    if (this.navobject.getRoutingHandler().isRouteWritable()) return true;
    var ok=confirm("you cannot edit this route as you are disconnected. OK to select a new name");
    if (ok){
        this.gui.showPage('routepage');
    }
    return false;
};

avnav.gui.Navpage.prototype.showWpButtons=function(waypoint){
    this.gui.map.setCenter(waypoint);
    this.selectOnPage('#avi_navpage_wpbuttons').show();
    this.selectedWp=waypoint;
    this.wpHidetime=new Date().getTime() + this.gui.properties.getProperties().centerDisplayTimeout;
    this.gui.map.setGpsLock(false);
    this.buttonUpdate();
    this.gui.map.triggerRender();
};

avnav.gui.Navpage.prototype.hideWpButtons=function(){
    if (!this.selectedWp) return;
    this.selectOnPage('#avi_navpage_wpbuttons').hide();
    this.selectedWp=undefined;
    this.wpHidetime=0;
};

avnav.gui.Navpage.prototype._updateWpFromEdit=function(){
    var nwp=this._wpOverlay.updateWp(true,this.navobject.getRoutingHandler());
    if (nwp) this.selectedWp=nwp;
    return (nwp !== undefined);
};

avnav.gui.Navpage.prototype.goBack=function(){
    this.btnCancelNav();
};

//-------------------------- Buttons ----------------------------------------

avnav.gui.Navpage.prototype.btnZoomIn=function (button,ev){
    avnav.log("ZoomIn clicked");
    this.getMap().changeZoom(1);
};

avnav.gui.Navpage.prototype.btnZoomOut=function (button,ev){
    avnav.log("ZoomOut clicked");
    this.getMap().changeZoom(-1);
};
avnav.gui.Navpage.prototype.btnLockPos=function (button,ev){
    this.hideWpButtons();
    var nLock=! this.gui.map.getGpsLock();
    this.gui.map.setGpsLock(nLock);
    this.handleToggleButton(button,nLock);
    if (nLock) this.hideOverlay();
    this.gui.map.triggerRender();
    avnav.log("LockPos clicked");
};
avnav.gui.Navpage.prototype.btnLockMarker=function (button,ev) {
    avnav.log("LockMarker clicked");
    this.hideWpButtons();
    var center = this.navobject.getMapCenter();
    var wp = new avnav.nav.navdata.WayPoint();
    center.assign(wp);
    wp.name = 'Marker';
    this.navobject.getRoutingHandler().wpOn(wp);

};
avnav.gui.Navpage.prototype.btnStopNav=function (button,ev) {
    avnav.log("StopNav clicked");
    this.hideWpButtons();
    this.navobject.getRoutingHandler().routeOff();
    this.buttonUpdate();
    this.hideRouting();
    this.gui.map.triggerRender();

};
avnav.gui.Navpage.prototype.btnCourseUp=function (button,ev){
    var nLock=! this.gui.map.getCourseUp();
    nLock=this.gui.map.setCourseUp(nLock);
    this.handleToggleButton(button,nLock);
    this.gui.map.triggerRender();
    avnav.log("courseUp clicked");
};
avnav.gui.Navpage.prototype.btnShowRoutePanel=function (button,ev){
    avnav.log("showRoutePanel clicked");
    this.hideWpButtons();
    if (! this.routingVisible) this.showRouting();
    else this.hideRouting();
};
avnav.gui.Navpage.prototype.btnCancelNav=function (button,ev){
    avnav.log("CancelNav clicked");
    this.hideWpButtons();
    if (this.routingVisible){
        this.hideRouting();
        return;
    }
    this.gui.showPage('mainpage');
};


//-------------------------- Route ----------------------------------------
avnav.gui.Navpage.prototype.btnNavAdd=function (button,ev){
    avnav.log("navAdd clicked");
    if (!this.checkRouteWritable()) return false;
    var center=this.gui.map.getCenter();
    var current=this.navobject.getRoutingHandler().getEditingWp();
    if (current) {
        var dst = this.gui.map.pixelDistance(center, current);
        //TODO: make this configurable
        if (dst < 8) return; //avoid multiple wp at the same coordinate
    }
    this.navobject.getRoutingHandler().addWp(
        -1,center
    );
};

avnav.gui.Navpage.prototype.btnNavDelete=function (button,ev){
    avnav.log("navDelete clicked");this.checkRouteWritable();
    if (!this.checkRouteWritable()) return false;
    this.navobject.getRoutingHandler().deleteWp(-1);
    this.updateRoutePoints(false,true);
};
avnav.gui.Navpage.prototype.btnNavToCenter=function (button,ev){
    avnav.log("navDelete clicked");
    if (!this.checkRouteWritable()) return false;
    var center=this.gui.map.getCenter();
    this.navobject.getRoutingHandler().changeWpByIdx(
        -1,center
    );
};
avnav.gui.Navpage.prototype.btnNavGoto=function(button,ev){
    avnav.log("navGoto clicked");
    this.navobject.getRoutingHandler().wpOn(this.navobject.getRoutingHandler().getEditingWp());
    this.hideRouting();
};

avnav.gui.Navpage.prototype.btnNavDeleteAll=function(button,ev){
    avnav.log("navDeletAll clicked");
    if (!this.checkRouteWritable()) return false;
    this.navobject.getRoutingHandler().emptyRoute();
};

avnav.gui.Navpage.prototype.btnNavInvert=function(button,ev){
    avnav.log("navInvert clicked");
    if (!this.checkRouteWritable()) return false;
    this.navobject.getRoutingHandler().invertRoute();
};

//-------------------------- WP ----------------------------------------
avnav.gui.Navpage.prototype.btnWpEdit=function(button,ev) {
    avnav.log("Edit clicked");
    if (! this.selectedWp) return;
    this._wpOverlay.show(this.selectedWp);
};

avnav.gui.Navpage.prototype.btnWpGoto=function(button,ev) {
    avnav.log("Goto clicked");
    var wp=this.selectedWp;
    this.hideWpButtons();
    if (! wp) {
        return;
    }
    this.navobject.getRoutingHandler().wpOn(wp);
};
avnav.gui.Navpage.prototype.btnNavNext=function(button,ev) {
    avnav.log("NavNext clicked");
    var wp=this.selectedWp;
    this.hideWpButtons();
    if (! wp) {
        return;
    }
    var router=this.navobject.getRoutingHandler();
    if (! router.isCurrentRoutingTarget(wp)) return;
    var next=router.getPointAtOffset(wp,1);
    if (! next ) return;
    router.wpOn(next);
};
avnav.gui.Navpage.prototype.btnWpNext=function(button,ev) {
    avnav.log("WpNext clicked");
    if (! this.selectedWp) return;
    var router=this.navobject.getRoutingHandler();
    var next=router.getPointAtOffset(this.selectedWp,1);
    if (! next) return;
    this.showWpButtons(next);
};

avnav.gui.Navpage.prototype.btnWpPrevious=function(button,ev) {
    avnav.log("WpPrevious clicked");
    if (! this.selectedWp) return;
    var router=this.navobject.getRoutingHandler();
    var next=router.getPointAtOffset(this.selectedWp,-1);
    if (! next) return;
    this.showWpButtons(next);
};


/**
 * create the page instance
 */
(function(){
    //create an instance of the status page handler
    var page=new avnav.gui.Navpage();
}());

