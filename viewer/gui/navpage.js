/**
 * Created by andreas on 02.05.14.
 */

var React=require('react');
var ReactDOM=require('react-dom');
var WaypointList=require('../components/ItemList.jsx');
var WaypointItem=require('../components/WayPointItem.jsx');
/** @type {DynLayout} */
var DynLayout=require('../util/dynlayout');
var WidgetContainer=require('../components/WidgetContainer.jsx');
var navobjects=require('../nav/navobjects');
var routeobjects=require('../nav/routeobjects');
var WaypointDialog=require('../components/WaypointDialog.jsx');
var OverlayDialog=require('../components/OverlayDialog.jsx');
var Store=require('../util/store');
var ItemUpdater=require('../components/ItemUpdater.jsx');
var WidgetFactory=require('../components/WidgetFactory.jsx');
avnav.provide('avnav.gui.Navpage');

var keys={
    waypointList: 'waypointList',
    waypointSelections: 'selections',
    leftWidgets: 'leftWidgets',
    bottomLeftWidgets: 'bottomLeft',
    bottomRightWidgets: 'bottomRight'
};
var selectors={
    selected: 'avn_route_info_active_point',
    centered: 'avn_route_info_centered'
};

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
     * @type {navobjects.WayPoint}
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
     * @type {routeobjects.Route}
     */
    this.lastRoute=new routeobjects.Route("");
    /**
     * @private
     * @type {avnav.util.Formatter}
     */
    this.formatter=new avnav.util.Formatter();


    this.showRouteOnReturn=false;

    this.widgetClick=this.widgetClick.bind(this);
    this.store=new Store();

    this.widgetLists={};
    this.widgetLists[keys.leftWidgets]=[
        //items: ['CenterDisplay','AisTarget','ActiveRoute','LargeTime'],
        {key:1,name:'CenterDisplay'},
        {key:2,name:'AisTarget'},
        {key:3,name:'ActiveRoute'},
        {key:4,name:'LargeTime'}
    ];
    this.widgetLists[keys.bottomLeftWidgets]=[
        //['BRG','DST','ETA','WpPosition']
        {key:1,name:'BRG'},
        {key:2,name:'DST'},
        {key:3,name:'ETA'},
        {key:4,name:'WpPosition'}
    ];
    this.widgetLists[keys.bottomRightWidgets]=[
        //['COG','SOG','TimeStatus','Position']
        {key:1,name:'COG'},
        {key:2,name:'SOG'},
        {key:3,name:'TimeStatus'},
        {key:4,name:'Position'}
    ];
    this.lastOtherLeft=0;

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
    //recompute layouts
    this.lastOtherLeft=0;
    var self = this;
    this.hideWpButtons();
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
            self.toast("invalid navpage call - no chart selected");
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
                self.toast("unable to load charts " + ev.responseText);
            }
        });
    }
    this.firstShow=false;
    this.getMap().setBrightness(brightness);
    this.updateMainPanelSize('#'+this.mapdom);
    this.getMap().updateSize();
    this.gui.navobject.setAisCenterMode(navobjects.AisCenterMode.MAP);
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
    if (! options || ! options.returning){
        this.store.resetData();
    }
    this.updateRoutePoints(true,showRouting);
    this.resetWidgetLayouts();
    this.widgetVisibility();
    window.setTimeout(function(){
        self.updateLayout();
    },0);

};

avnav.gui.Navpage.prototype.updateWidgetLists=function(){
    for (var key in this.widgetLists){
        var list=this.widgetLists[key];
        var visibleList=[];
        for (var i in list){
            if (list[i].visible === undefined || list[i].visible) visibleList.push(list[i]);
        }
        var current=this.store.getData(key);
        if (current) current=current.itemList;
        var doUpdate=false;
        if (!current && visibleList.length) doUpdate=true;
        if (! doUpdate){
            if (current.length != visibleList.length) doUpdate=true;
        };
        if (! doUpdate){
            for (var i=0; i< visibleList.length;i++){
                if (current[i].key != visibleList[i].key){
                    //TODO: check other parameters?
                    doUpdate=true;
                    break;
                }
            }
        }
        if (doUpdate){
            this.store.replaceSubKey(key,visibleList,'itemList');
        }
    }
};
avnav.gui.Navpage.prototype.setWidgetVisibility=function(key,listName,visible){
    var list=this.widgetLists[key];
    if (! list) return;
    for (var i in list){
        if (list[i].name == listName) list[i].visible=visible;
    }
};
avnav.gui.Navpage.prototype.widgetVisibility=function(){
    var aisVisible=this.gui.properties.getProperties().layers.ais;
    if (aisVisible) {
        var aisTarget=this.navobject.getAisHandler().getNearestAisTarget();
        aisVisible=(aisTarget && aisTarget.mmsi);
    }
    this.setWidgetVisibility(keys.leftWidgets,'AisTarget',aisVisible);
    //aisVisible=true;
    var routeVisible=this.gui.properties.getProperties().layers.nav;
    if (routeVisible) routeVisible=this.navobject.getRoutingHandler().hasActiveRoute();
    this.setWidgetVisibility(keys.leftWidgets,'ActiveRoute',routeVisible);
    var centerVisible=this.gui.properties.getProperties().layers.measures;
    if (this.hidetime <=0 || this.hidetime <= new Date().getTime()|| this.gui.map.getGpsLock()){
        centerVisible=false;
    }
    this.setWidgetVisibility(keys.leftWidgets,'CenterDisplay',centerVisible);
    var clockVisible=this.gui.properties.getProperties().showClock;
    this.setWidgetVisibility(keys.leftWidgets,'LargeTime',clockVisible);
    this.updateWidgetLists();
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
    if (this.wpHidetime > 0 && this.wpHidetime <= new Date().getTime()){
        this.hideWpButtons();
    }
    this.buttonUpdate();
    this.widgetVisibility();
};
avnav.gui.Navpage.prototype.hidePage=function(){
    this.hideWpButtons();
    this.hidetime=0;
    this.showRouteOnReturn=this.routingVisible;
    this.hideRouting(true);
};

avnav.gui.Navpage.prototype.resetWidgetLayouts=function() {
    var self=this;
    var widgetKeys=[keys.leftWidgets, keys.bottomLeftWidgets, keys.bottomRightWidgets];
    for (var i in widgetKeys) {
        var key=widgetKeys[i];
        //re-layout all widgets
        var oldSeq = self.store.getData(key, {}).renewSequence || 0;
        self.store.replaceSubKey(key, oldSeq + 1, 'renewSequence');
    }
};
/**
 *
 */
avnav.gui.Navpage.prototype.localInit=function(){
    var self=this;
    $('#leftBottomMarker').click({page:this},function(ev){
        var wp=self.navobject.getRoutingHandler().getCurrentLegTarget();
        if (wp){
            self.gui.map.setCenter(wp);
            if (self.routingVisible) {
                return;
            }
            self.showWpButtons(wp);
        }
    });
    $('#leftBottomPosition').click({page:this},function(ev){
        ev.stopPropagation();
        self.gui.showPage('gpspage');
    });

    $('#avi_route_info_navpage_inner').click({page:this},function(ev){
        ev.data.page.gui.showPage('routepage');
    });
    $(document).on(navobjects.NavEvent.EVENT_TYPE, function(ev,evdata){
        self.navEvent(evdata);
    });
    $(document).on(avnav.map.MapEvent.EVENT_TYPE, function(ev,evdata){
        self.mapEvent(evdata);
    });
    $(document).on(avnav.util.PropertyChangeEvent.EVENT_TYPE,function(){
        self.updateMainPanelSize('#'+self.mapdom);
        self.resetWidgetLayouts();
    });
    $(window).on('resize',function(){
        self.updateLayout();
    });
    this.resetWidgetLayouts();
    this.computeLayoutParam(); //initially fill the stores
    var list=React.createElement(
        ItemUpdater(WaypointList,this.store,[keys.waypointList,keys.waypointSelections]),
        {
        onItemClick:function(item,opt_data){
            self.waypointClicked(item,opt_data);
        },
        itemClass:WaypointItem,
        updateCallback: function(){
            self.scrollRoutePoints();
        }
    });
    ReactDOM.render(list,document.getElementById('avi_route_info_list'));
    var container=React.createElement(ItemUpdater(WidgetContainer,this.store,keys.bottomLeftWidgets),{
        onClick: self.widgetClick,
        store: self.navobject,
        propertyHandler: self.gui.properties,
        itemCreator: WidgetFactory.createWidget,
        itemList: [],
        updateCallback:function(container){
            $('#leftBottomPosition').height(container.other+"px");
            $('#avi_navLeftContainer').css('bottom',(container.other+3)+"px");
        }
        });
    ReactDOM.render(container,$('#leftBottomPosition')[0]);
    container=React.createElement(ItemUpdater(WidgetContainer,this.store,keys.bottomRightWidgets),{
        onClick: self.widgetClick,
        store: self.navobject,
        itemCreator: WidgetFactory.createWidget,
        propertyHandler: self.gui.properties,
        updateCallback:function(container){
            $('#leftBottomMarker').height(container.other+"px");
            $('#avi_navLeftContainer').css('bottom',(container.other+3)+"px");

        }
    });
    ReactDOM.render(container,$('#leftBottomMarker')[0]);
    container=React.createElement(ItemUpdater(WidgetContainer,this.store,keys.leftWidgets),{
        onClick: self.widgetClick,
        itemList:[],
        store: self.navobject,
        itemCreator: WidgetFactory.createWidget,
        propertyHandler: self.gui.properties,
        updateCallback:function(container){
            $('#avi_navLeftContainer').height(container.main+"px");
            $('#avi_navLeftContainer').width(container.other+"px");
            if (container.other != self.lastOtherLeft){
                self.lastOtherLeft=container.other;
                window.setTimeout(function(){
                    self.computeLayoutParam();
                },10);
            }
        }
        });
    ReactDOM.render(container,$('#avi_navLeftContainer')[0]);
};

avnav.gui.Navpage.prototype.widgetClick=function(widgetDescription,data){
    if (widgetDescription.name == "AisTarget" && data && data.mmsi){
        this.gui.showPage("aisinfopage",{mmsi:data.mmsi});
    }
    if (widgetDescription.name == "ActiveRoute"){
        this.navobject.getRoutingHandler().startEditingRoute();
        this.gui.showPage("routepage");
    }
    if (widgetDescription.name == "CenterDisplay"){
        this.hidetime=0;
        this.widgetVisibility();
    }
};


/**
 *
 * @param {navobjects.NavEvent} evdata
 */
avnav.gui.Navpage.prototype.navEvent=function(evdata){
    if (! this.visible) return;
    if (evdata.type == navobjects.NavEventType.ROUTE){
        this.handleRouteDisplay();
        if (this.routingVisible)this.updateRoutePoints();
    }
};
/**
 *
 * @param {avnav.map.MapEvent} evdata
 */
avnav.gui.Navpage.prototype.mapEvent=function(evdata){
    var self=this;
    if (! this.visible) return;
    if (evdata.type == avnav.map.EventType.MOVE) {
        //show the center display if not visible
        if (!this.routingVisible) {
            this.hidetime = new Date().getTime() + this.gui.properties.getProperties().centerDisplayTimeout;
            this.widgetVisibility();
            return;

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
                self.showWaypointDialog(wp);
            }
            else {
                this.navobject.getRoutingHandler().setEditingWp(wp);
            }
            this.updateRoutePoints();
        }
        else{
            this.showWpButtons(wp);
        }
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
    this.hidetime=0;
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
    this.selectOnPage('#avi_navLeftContainer').css('opacity',1);
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

avnav.gui.Navpage.prototype.computeLayoutParam=function(){
    //TODO: optimize to decide if we need to change
    var widgetMargin=3;
    this.store.replaceSubKey(keys.bottomLeftWidgets,{
        inverted: false,
        direction: 'right',
        scale: true,
        mainMargin: widgetMargin,
        otherMargin: widgetMargin,
        outerSize: $('#avi_navLeftContainer').width()-widgetMargin,
        maxRowCol: this.gui.properties.getProperties().allowTwoWidgetRows?2:1,
        maxSize:$('#leftBottomPosition').width()+widgetMargin/2
    },'layoutParameter');
    this.store.replaceSubKey(keys.bottomRightWidgets,{
        inverted: false,
        scale: true,
        direction: 'left',
        mainMargin: widgetMargin,
        otherMargin: widgetMargin,
        outerSize: $('#avi_navLeftContainer').width()-widgetMargin,
        maxRowCol: this.gui.properties.getProperties().allowTwoWidgetRows ? 2 : 1,
        maxSize: $('#leftBottomMarker').width()+widgetMargin/2
    },'layoutParameter');
    var w=$(window).width();
    var direction='bottom';
    var inverseAlignment=false;
    var containerClass='';
    var maxSize=this.selectOnPage('.avn_left_panel').height() - $('#avi_nav_bottom').outerHeight();
    if ( w<= this.gui.properties.getProperties().smallBreak){
        direction='left';
        maxSize=this.selectOnPage('.avn_left_panel').width();
        inverseAlignment=true;
        containerClass='smallBreak';
    }
    this.store.replaceSubKey(keys.leftWidgets, {
        inverted: false,
        scale: false,
        mainMargin: widgetMargin,
        otherMargin: widgetMargin,
        maxSize: maxSize,
        direction: direction,
        inverseAlignment: inverseAlignment,
        containerClass: containerClass
    }, 'layoutParameter');

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
        var w=$(window).width();
        self.computeLayoutParam();
    },0);
};

avnav.gui.Navpage.prototype.waypointClicked=function(item,options){
    var self=this;
    if (options && options != 'main') return;
    this.navobject.getRoutingHandler().setEditingWpIdx(item.idx);
    var selectorState=this.store.getData(keys.waypointSelections,{}).selectors;
    this.store.updateSubItem(keys.waypointSelections,selectors.selected,item.idx,'selectors');
    if (! selectorState || selectorState[selectors.centered] != item.idx) {
        this.getMap().setCenter(this.navobject.getRoutingHandler().getEditingWp());
        this.store.updateSubItem(keys.waypointSelections,selectors.centered,item.idx,'selectors');
        return;
    }
    var wp=this.navobject.getRoutingHandler().getEditingWp();
    self.showWaypointDialog(wp);
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
        this.store.storeData(keys.waypointList,{
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
        waypoints.forEach(function(waypoint){
           waypoint.key=waypoint.idx;
        });
        this.store.storeData(keys.waypointList,{
            itemList:waypoints,
            options: {showLatLon: this.gui.properties.getProperties().routeShowLL}
        });
    }
    else {
        this.store.updateData(keys.waypointList,
            {showLatLon: this.gui.properties.getProperties().routeShowLL},'options');
    }
    var activeWp=route.getPointAtIndex(active);
    if (opt_centerActive && activeWp){
        this.gui.map.setCenter(activeWp);
        this.store.updateSubItem(keys.waypointSelections,selectors.centered,active,'selectors');
    }
};



avnav.gui.Navpage.prototype.checkRouteWritable=function(){
    if (this.navobject.getRoutingHandler().isRouteWritable()) return true;
    var ok=OverlayDialog.confirm("you cannot edit this route as you are disconnected. OK to select a new name",this.getDialogContainer());
    ok.then(function(){
        this.gui.showPage('routepage');
    });
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


avnav.gui.Navpage.prototype.showWaypointDialog=function(wp){
    var self=this;
    var ok=function(newWp,closeFunction)
    {
        var nwp=WaypointDialog.updateWaypoint(wp,newWp,function(error){
                self.toast(avnav.util.Helper.escapeHtml(error));
            },
            self.navobject.getRoutingHandler());
        if (nwp) {
            self.selectedWp=nwp;
        }
        return (nwp !== undefined);
    };
    OverlayDialog.dialog(WaypointDialog,self.getDialogContainer(),{
        waypoint:wp,
        okCallback: ok
    });
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
    this.gui.map.triggerRender();
    this.widgetVisibility();
    avnav.log("LockPos clicked");
};
avnav.gui.Navpage.prototype.btnLockMarker=function (button,ev) {
    avnav.log("LockMarker clicked");
    this.hideWpButtons();
    var center = this.navobject.getMapCenter();
    var wp = new navobjects.WayPoint();
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
    this.showWaypointDialog(this.selectedWp);
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

