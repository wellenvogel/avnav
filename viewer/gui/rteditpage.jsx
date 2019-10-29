/**
 * Created by andreas on 02.05.14.
 */

var React=require('react');
var ReactDOM=require('react-dom');
var WaypointList=require('../components/ItemListOld.jsx');
var WaypointItem=require('../components/WayPointItem.jsx');
var WidgetContainer=require('../components/WidgetContainer.jsx');
var navobjects=require('../nav/navobjects');
var routeobjects=require('../nav/routeobjects');
var WaypointDialog=require('../components/WaypointDialog.jsx');
var OverlayDialog=require('../components/OverlayDialog.jsx');
var Store=require('../util/store');
var ItemUpdater=require('../components/ItemUpdater.jsx');
var WidgetFactory=require('../components/WidgetFactory.jsx');
var EditRouteWidget=require('../components/EditRouteWidget.jsx');
var Page=require('./page.jsx');
var ButtonList=require('../components/ButtonListOld.jsx');

var keys={
    waypointList: 'waypointList',
    waypointSelections: 'selections',
    leftWidgets: 'leftWidgets',
    topWidgets: 'topWidgets',
    bottomLeftWidgets: 'bottomLeft',
    bottomRightWidgets: 'bottomRight',
    routingVisible: 'routingVisible',
    isSmall: 'isSmall',
    zoom: 'zoom',
    wpButtons: 'wpButtons'
};
var wpKeyFlags={
    currentTarget:'currentTarget',
    routeActive: 'routeActive'
};
var widgetKeys=[keys.leftWidgets, keys.bottomLeftWidgets, keys.bottomRightWidgets,keys.topWidgets];
var selectors={
    selected: 'avn_route_info_active_point',
    centered: 'avn_route_info_centered'
};

/**
 *
 * @constructor
 * @extends {avnav.gui.Page}
 */
var RtEditPage=function(){
    Page.call(this,'rteditpage');
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
    this.mapdom=null;
    var self=this;


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


    this.store=new Store();

    /**
     *
     * @type {Object}
     * @private
     */
    this._lastOptions=undefined;

};
avnav.inherits(RtEditPage,Page);

/**
 * get the mapholder
 * @private
 * @returns {avnav.map.MapHolder}
 */
RtEditPage.prototype.getMap=function(){
    if (!this.gui) return null;
    return this.gui.getMap();
};


RtEditPage.prototype.showPage=function(options){
    if (!this.gui) return;
    //recompute layouts
    this.lastOtherLeft=0;
    var self = this;
    this.hideWpButtons();
    var newMap=false;
    var brightness=1;
    this.store.storeData(keys.isSmall,this.isSmall());
    if (this.gui.properties.getProperties().nightMode) {
        brightness=this.gui.properties.getProperties().nightChartFade/100;
    }
    this.buttonUpdate();
    if (options){
        this._lastOptions=options;
    }
    else{
        options={};
    }
    this.getMap().loadMap(options,this.firstShow);
    this.firstShow=false;
    this.getMap().setBrightness(brightness);
    this.getMap().renderTo(this.mapdom);
    this.gui.navobject.setAisCenterMode(navobjects.AisCenterMode.MAP);
    this.getMap().setGpsLock(false);
};



RtEditPage.prototype.timerEvent=function(){
};
RtEditPage.prototype.hidePage=function(){
    var map=this.getMap();
    if (map) map.renderTo(null);
};


var buttons = [
    {key: "ZoomIn"},
    {key: "ZoomOut"},
    {key: "NavAdd"},
    {key: "NavDelete"},
    {key: "NavToCenter"},
    {key: "NavGoto"},
    {key: "NavInvert"},
    {key: "CancelNav"}
];

RtEditPage.prototype.wpButtons=function(onoff){
    //TODO: handle active wp
    var buttonFontSize=this.gui.properties.getButtonFontSize();
    this.store.replaceSubKey(keys.wpButtons,buttonFontSize,'fontSize');
    if (! onoff) {
        this.store.updateSubItem(keys.wpButtons,'itemList',[]);
        return;
    }
    var btGoto={key:'WpGoto'};
    btGoto[wpKeyFlags.currentTarget]=false;
    var btNavNext={key:'NavNext'};
    btNavNext[wpKeyFlags.currentTarget]=true;
    btNavNext[wpKeyFlags.routeActive]=true;
    var btRNext={key:'WpNext'};
    btRNext[wpKeyFlags.routeActive]=true;
    var btRPrev={key:'WpPrevious'};
    btRPrev[wpKeyFlags.routeActive]=true;
    var wpButtons=[
        {key:'WpLocate'},
        {key:'WpEdit'},
        btGoto,
        btNavNext,
        btRNext,
        btRPrev
    ];
    this.store.updateSubItem(keys.wpButtons,'itemList',wpButtons);
};
/**
 *
 */
RtEditPage.prototype.getPageContent=function(){
    var self=this;
    self.setButtons(buttons);

    $(document).on(navobjects.NavEvent.EVENT_TYPE, function(ev,evdata){
        self.navEvent(evdata);
    });
    $(document).on(avnav.map.MapEvent.EVENT_TYPE, function(ev,evdata){
        self.mapEvent(evdata);
    });

    var RoutePoints=ItemUpdater(WaypointList,this.store,[keys.waypointList,keys.waypointSelections]);
    var RouteInfo=ItemUpdater(EditRouteWidget,self.navobject);
    var routePanel = function (props) {
        if (props.isSmall) return null;
        return (
            <div className="avn_routeDisplay">
                <RouteInfo store={self.navobject} onClick={function(){
                    self.gui.showPage('routepage');
                }}
                />
                <RoutePoints onItemClick={function(item,opt_data){
                        self.waypointClicked(item,opt_data);
                        }
                    }
                             itemClass={WaypointItem}
                             updateCallback={function(){
                        self.scrollRoutePoints()
                        }
                    }/>
                </div>
        );
    };
    var RoutePanel=ItemUpdater(routePanel,this.store,keys.isSmall);

    var LeftBottomMarker=ItemUpdater(WidgetContainer,this.store,keys.bottomLeftWidgets);
    var leftBottomMarkerProps={
        className: "leftBottomMarker",
        onItemClick: self.widgetClick,
        itemCreator: widgetCreator,
        itemList: [],
        updateCallback:function(container){
            $('#avi_nav_bottom').css('height',(container.other+container.otherMargin)+"px").css('padding-top',container.otherMargin+"px");
            $('#avi_route_info_navpage').css('bottom',(container.other+container.otherMargin)+"px");
            $('#avi_navpage .navLeftContainer').css('bottom',(container.other+container.otherMargin)+"px");
            self.scrollRoutePoints();
        }
        };
    var LeftBottomPosition=ItemUpdater(WidgetContainer,this.store,keys.bottomRightWidgets);
    var leftBottomPositionProps={
        className: 'leftBottomPosition',
        onItemClick: self.widgetClick,
        itemList:[],
        itemCreator: widgetCreator,
        updateCallback:function(container){
            $('#avi_nav_bottom').css('height',(container.other+container.otherMargin)+"px").css('padding-top',container.otherMargin+"px");
            $('#avi_navpage .navLeftContainer').css('bottom',(container.other+container.otherMargin)+"px");
            $('#avi_navpage .avn_wpbuttons').css('bottom',(container.other+container.otherMargin)+"px");

        }
    };
    var NavLeftContainer=ItemUpdater(WidgetContainer,this.store,keys.leftWidgets);
    var navLeftContainerProps={
        className: "navLeftContainer",
        onItemClick: self.widgetClick,
        itemList:[],
        itemCreator: widgetCreator,
        updateCallback:function(container){
            $('#avi_navpage .navLeftContainer').height(container.main+"px");
            $('#avi_navpage .navLeftContainer').width(container.other+"px");
            if (container.other != self.lastOtherLeft){
                self.lastOtherLeft=container.other;
                window.setTimeout(function(){
                    self.computeLayoutParam();
                },10);
            }
        }
        };
    var TopWidgets=ItemUpdater(WidgetContainer,this.store,keys.topWidgets);
    var topWidgetsProps={
        className: "avn_topRightWidgets",
        onItemClick: self.widgetClick,
        itemList:[],
        itemCreator: widgetCreator,
        updateCallback:function(container){
            self.selectOnPage('.avn_topRightWidgets').css('height',container.other+"px").css('width',container.main+"px");
        }
    };
    var WpButtons=ItemUpdater(ButtonList,this.store,keys.wpButtons);
    var wpButtonProps={
        className: "avn_wpbuttons",
        buttonHandler: self
    };
    return React.createClass({
        render: function(){
            return (
                <div className="avn_panel_fill">
                    <div id='avi_map_navpage' ref="map" className='avn_panel avn_map'>
                        <TopWidgets {...topWidgetsProps}/>
                        <RoutePanel/>
                        <WpButtons {...wpButtonProps}/>
                        <NavLeftContainer {...navLeftContainerProps}/>
                        {self.getAlarmWidget()}
                    </div>
                    <div id="avi_nav_bottom" className="avn_panel avn_left_bottom avn_widgetContainer">
                        <LeftBottomMarker {...leftBottomMarkerProps}/>
                        <LeftBottomPosition {...leftBottomPositionProps}/>
                    </div>
                </div>
            );
        },
        componentDidMount:function(){
            self.mapdom=this.refs.map;
            var map=self.getMap();
            if (map) map.renderTo(self.mapdom);
        }
    });
};
RtEditPage.prototype.isWidgetInList=function(widgetDescription,listKey){
    var list=this.widgetLists[listKey];
    if (! list) return false;
    for (var w in list){
        if (list[w].name == widgetDescription.name){
            return true;
        }
    }
    return false;
};
RtEditPage.prototype.widgetClick=function(widgetDescription){
    if (widgetDescription.name == "AisTarget" && widgetDescription.mmsi){
        this.gui.showPage("aisinfopage",{mmsi:widgetDescription.mmsi});
    }
    if (widgetDescription.name == "ActiveRoute"){
        this.navobject.getRoutingHandler().startEditingRoute();
        this.gui.showPage("routepage");
    }
    if (widgetDescription.name == "CenterDisplay"){
        this.hidetime=0;
        this.widgetVisibility();
    }
    if (widgetDescription.name == "EditRoute"){
        this.gui.showPage("routepage");
    }
    if (widgetDescription.name == "Zoom"){
        this.gui.getMap().checkAutoZoom(true);
    }
    if (this.isWidgetInList(widgetDescription,keys.bottomLeftWidgets)){
        var wp=this.navobject.getRoutingHandler().getCurrentLegTarget();
        if (wp){
            this.gui.getMap().setCenter(wp);
            if (this.routingVisible() && ! this.isSmall()) {
                return;
            }
            this.lastLockWp=this.gui.getMap().getGpsLock();
            this.showWpButtons(wp);
        }
        return;
    }
    if (this.isWidgetInList(widgetDescription,keys.bottomRightWidgets)){
        this.gui.showPage('gpspage');
        return;
    }
};


/**
 *
 * @param {navobjects.NavEvent} evdata
 */
RtEditPage.prototype.navEvent=function(evdata){
    if (! this.visible) return;
    if (evdata.type == navobjects.NavEventType.ROUTE){
        if (this.routingVisible())this.updateRoutePoints();
    }
};
/**
 *
 * @param {avnav.map.MapEvent} evdata
 */
RtEditPage.prototype.mapEvent=function(evdata){
    var self=this;
    if (! this.visible) return;
    this._updateZoom();
    if (evdata.type == avnav.map.EventType.MOVE) {
        //show the center display if not visible
        if (!this.routingVisible()) {
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
        if (this.routingVisible() && wp.routeName ){
            if (currentEditing && currentEditing.compare(wp)){
                self.showWaypointDialog(wp);
            }
            else {
                this.navobject.getRoutingHandler().setEditingWp(wp);
            }
            this.updateRoutePoints(true);
            return;
        }
        if (! wp.routeName){
            this.showWaypointDialog(wp);
            return;
        }
        if (! this.routingVisible() || this.isSmall()){
            this.lastLockWp=this.gui.getMap().getGpsLock();
            this.showWpButtons(wp);
        }
    }
};


/**
 * show the route editing part
 * @param {boolean} opt_returning
 */
RtEditPage.prototype.showRouting=function(opt_returning) {
    var isSmall=this.isSmall();
    if (! isSmall) this.hideWpButtons();
    if (this.routingVisible()) return;
    if (!this.gui.properties.getProperties().layers.nav) return;
    var upd=false;
    var routeActive=this.navobject.getRoutingHandler().hasActiveRoute();
    this.store.storeData(keys.routingVisible,true);
    this.widgetVisibility();
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
    this.gui.getMap().setRoutingActive(true);
    var nLock=this.gui.getMap().getGpsLock();
    this.lastGpsLock=nLock;
    if (nLock) {
        this.gui.getMap().setGpsLock(!nLock);
        this.handleToggleButton('.avb_LockPos', !nLock);
        this.gui.getMap().triggerRender();
    }
    this.updateRoutePoints(true,false);
    this.hidetime=0;
    if (isSmall) this.showWpButtons(this.navobject.getRoutingHandler().getEditingWp(),true);
};

/**
 * @private
 * @param {boolean} opt_noStop - do not stop editing
 */
RtEditPage.prototype.hideRouting=function(opt_noStop) {
    var upd=false;
    this.store.storeData(keys.routingVisible,false);
    this.widgetVisibility();
    this.hideWpButtons();
    if (! opt_noStop) {
        this.gui.getMap().setRoutingActive(false);
        this.navobject.getRoutingHandler().stopEditingRoute();
    }
    if (this.lastGpsLock) {
        this.gui.getMap().setGpsLock(true);
        this.lastGpsLock=false;
    }
};


RtEditPage.prototype.computeLayoutParam=function(){
    //TODO: optimize to decide if we need to change
    var self=this;
    var isSmall=this.isSmall();
    var widgetMargin=this.gui.properties.getProperties().style.widgetMargin;
    this.store.replaceSubKey(keys.bottomLeftWidgets,{
        inverted: false,
        direction: 'left',
        scale: true,
        mainMargin: widgetMargin,
        otherMargin: widgetMargin,
        startMargin: 0,
        outerSize: isSmall?0:$('#avi_navpage .navLeftContainer').width()-widgetMargin,
        maxRowCol: this.gui.properties.getProperties().allowTwoWidgetRows?2:1,
        maxSize:self.panelWidth/2+widgetMargin/2
    },'layoutParameter');
    this.store.replaceSubKey(keys.bottomRightWidgets,{
        inverted: false,
        scale: true,
        direction: 'right',
        mainMargin: widgetMargin,
        otherMargin: widgetMargin,
        startMargin: 0,
        outerSize: isSmall?0:$('#avi_navpage .navLeftContainer').width()-widgetMargin,
        maxRowCol: this.gui.properties.getProperties().allowTwoWidgetRows ? 2 : 1,
        maxSize: self.panelWidth/2+widgetMargin/2
    },'layoutParameter');
    this.store.replaceSubKey(keys.topWidgets,{
        inverted: false,
        scale: true,
        direction: 'right',
        mainMargin: widgetMargin,
        otherMargin: widgetMargin,
        startMargin: 0,
        outerSize: 0,
        maxRowCol: 1,
        maxSize: this.selectOnPage('.avn_left_panel').width()
    },'layoutParameter');
    this.store.replaceSubKey(keys.leftWidgets, {
        inverted: false,
        scale: false,
        mainMargin: widgetMargin,
        otherMargin: widgetMargin,
        maxSize: 0,
        direction: 'bottom',
        inverseAlignment: false
    }, 'layoutParameter');

};

/** @private */
RtEditPage.prototype.updateLayout=function(opt_force){
    var self=this;
    var buttonFontSize=this.gui.properties.getButtonFontSize();
    this.store.replaceSubKey(keys.wpButtons,buttonFontSize,'fontSize');
    var nwidth=this.selectOnPage('.avn_left_panel').width();
    var nheight=this.selectOnPage('.avn_left_panel').height();
    var doUpdate=opt_force;
    if (nwidth != this.panelWidth || nheight != this.panelHeight){
        this.panelHeight=nheight;
        this.panelWidth=nwidth;
        doUpdate=true;
    }
    if (! doUpdate) return;
    window.setTimeout(function(){
        var rtop=$('#avi_nav_bottom').outerHeight();
        $('#avi_navpage .navLeftContainer').css('bottom',rtop+"px");
        $('#avi_navpage .avn_wpbuttons').css('bottom',rtop+"px");
        $('#avi_route_info_navpage').css('bottom',rtop+"px");
        self.scrollRoutePoints();
        var w=$(window).width();
        self.computeLayoutParam();
        if (self.routingVisible()) {
            if (!self.isSmall()) self.hideWpButtons();
            else self.showWpButtons(self.navobject.getRoutingHandler().getEditingWp());
        }
    },0);
};

RtEditPage.prototype.waypointClicked=function(item,options){
    var self=this;
    if (options && options != 'main') return;
    this.navobject.getRoutingHandler().setEditingWpIdx(item.idx);
    var selectorState=this.store.getData(keys.waypointSelections,{}).selectors;
    this.store.updateSubItem(keys.waypointSelections,selectors.selected,item.idx,'selectors');
    if (! selectorState || selectorState[selectors.centered] != item.idx) {
        this.getMap().setCenter(this.navobject.getRoutingHandler().getEditingWp());
        this.store.updateSubItem(keys.waypointSelections,selectors.centered,item.idx,'selectors');
        if (self.isSmall()) self.showWpButtons(this.navobject.getRoutingHandler().getEditingWp());
        return;
    }
    var wp=this.navobject.getRoutingHandler().getEditingWp();
    self.showWaypointDialog(wp);
};

RtEditPage.prototype.scrollRoutePoints=function(){
    avnav.util.Helper.scrollItemIntoView('.avn_route_info_active_point','.avn_routeDisplay .avn_listContainer');
};
RtEditPage.prototype.updateRoutePoints=function(opt_initial,opt_centerActive){
    var editingActiveRoute=this.navobject.getRoutingHandler().isEditingActiveRoute();
    var route=this.navobject.getRoutingHandler().getRoute();
    if (! route) {
        this.store.storeData(keys.waypointList,{
            itemList:[],
            options: {showLatLon: this.gui.properties.getProperties().routeShowLL}
        });
        return;
    }
    var active=this.navobject.getRoutingHandler().getEditingWpIdx();
    var self=this;
    var rebuild=opt_initial||false;
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
    if (opt_initial && activeWp){
        var sel={};
        sel[selectors.selected]=active;
        if (opt_centerActive) {
            sel[selectors.centered] = active;
            this.gui.getMap().setCenter(activeWp);
        }
        else{
            sel[selectors.centered]=-1; //no waypoint centered yet
        }
        this.store.replaceSubKey(keys.waypointSelections,sel,'selectors');
    };
    if (! opt_initial && opt_centerActive && activeWp){
        this.gui.getMap().setCenter(activeWp);
        this.store.updateSubItem(keys.waypointSelections, selectors.centered, active, 'selectors');

    };
};



RtEditPage.prototype.checkRouteWritable=function(){
    if (this.navobject.getRoutingHandler().isRouteWritable()) return true;
    var ok=OverlayDialog.confirm("you cannot edit this route as you are disconnected. OK to select a new name",this.getDialogContainer());
    var self=this;
    ok.then(function(){
        self.gui.showPage('routepage');
    });
    return false;
};

RtEditPage.prototype.showWpButtons=function(waypoint,opt_nocenter){
    if (!opt_nocenter) this.gui.getMap().setCenter(waypoint);
    this.wpButtons(true);
    this.selectedWp=waypoint;
    this.wpHidetime=new Date().getTime() + this.gui.properties.getProperties().centerDisplayTimeout;
    this.gui.getMap().setGpsLock(false);
    this.buttonUpdate();
    this.gui.getMap().triggerRender();
};

RtEditPage.prototype.hideWpButtons=function(){
    if (!this.selectedWp) return;
    this.wpButtons(false);
    this.selectedWp=undefined;
    this.wpHidetime=0;
    if (this.lastLockWp !== undefined) this.gui.getMap().setGpsLock(this.lastLockWp);
    this.lastLockWp=undefined;
};


RtEditPage.prototype.showWaypointDialog=function(wp){
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


RtEditPage.prototype.goBack=function(){
    this.btnCancelNav();
};

//-------------------------- Buttons ----------------------------------------

RtEditPage.prototype.btnZoomIn=function (button,ev){
    avnav.log("ZoomIn clicked");
    this.getMap().changeZoom(1);
};

RtEditPage.prototype.btnZoomOut=function (button,ev){
    avnav.log("ZoomOut clicked");
    this.getMap().changeZoom(-1);
};
RtEditPage.prototype.btnLockPos=function (button,ev){
    this.hideWpButtons();
    var nLock=! this.gui.getMap().getGpsLock();
    this.gui.getMap().setGpsLock(nLock);
    this.handleToggleButton("LockPos",nLock);
    this.gui.getMap().triggerRender();
    this.widgetVisibility();
    avnav.log("LockPos clicked");
};
RtEditPage.prototype.btnLockMarker=function (button,ev) {
    avnav.log("LockMarker clicked");
    this.hideWpButtons();
    var center = this.navobject.getMapCenter();
    var currentLeg=this.navobject.getRoutingHandler().getCurrentLeg();
    var wp=new navobjects.WayPoint();
    //take over the wp name if this was a normal wp with a name
    //but do not take over if this was part of a route
    if (currentLeg && currentLeg.to && currentLeg.to.name && ! currentLeg.to.routeName){
        wp.name=currentLeg.to.name;
    }
    else{
        wp.name = 'Marker';
    }
    center.assign(wp);
    this.navobject.getRoutingHandler().wpOn(wp);

};
RtEditPage.prototype.btnStopNav=function (button,ev) {
    avnav.log("StopNav clicked");
    this.hideWpButtons();
    this.navobject.getRoutingHandler().routeOff();
    this.buttonUpdate();
    this.hideRouting();
    this.gui.getMap().triggerRender();

};
RtEditPage.prototype.btnCourseUp=function (button,ev){
    var nLock=! this.gui.getMap().getCourseUp();
    nLock=this.gui.getMap().setCourseUp(nLock);
    this.handleToggleButton("CourseUp",nLock);
    this.gui.getMap().triggerRender();
    avnav.log("courseUp clicked");
};
RtEditPage.prototype.btnShowRoutePanel=function (button,ev){
    avnav.log("showRoutePanel clicked");
    this.hideWpButtons();
    if (! this.routingVisible()) this.showRouting();
    else this.hideRouting();
};
RtEditPage.prototype.btnCancelNav=function (button,ev){
    avnav.log("CancelNav clicked");
    this.hideWpButtons();
    if (this.routingVisible()){
        this.hideRouting();
        return;
    }
    this.gui.showPage('mainpage');
};


//-------------------------- Route ----------------------------------------
RtEditPage.prototype.btnNavAdd=function (button,ev){
    avnav.log("navAdd clicked");
    if (!this.checkRouteWritable()) return false;
    var center=this.gui.getMap().getCenter();
    var current=this.navobject.getRoutingHandler().getEditingWp();
    if (current) {
        var dst = this.gui.getMap().pixelDistance(center, current);
        //TODO: make this configurable
        if (dst < 8) return; //avoid multiple wp at the same coordinate
    }
    this.navobject.getRoutingHandler().addWp(
        -1,center
    );
};

RtEditPage.prototype.btnNavDelete=function (button,ev){
    avnav.log("navDelete clicked");this.checkRouteWritable();
    if (!this.checkRouteWritable()) return false;
    this.navobject.getRoutingHandler().deleteWp(-1);
    this.updateRoutePoints(false,true);
};
RtEditPage.prototype.btnNavToCenter=function (button,ev){
    avnav.log("navDelete clicked");
    if (!this.checkRouteWritable()) return false;
    var center=this.gui.getMap().getCenter();
    this.navobject.getRoutingHandler().changeWpByIdx(
        -1,center
    );
};
RtEditPage.prototype.btnNavGoto=function(button,ev){
    avnav.log("navGoto clicked");
    this.navobject.getRoutingHandler().wpOn(this.navobject.getRoutingHandler().getEditingWp());
    this.hideRouting();
};

RtEditPage.prototype.btnNavDeleteAll=function(button,ev){
    avnav.log("navDeletAll clicked");
    if (!this.checkRouteWritable()) return false;
    this.navobject.getRoutingHandler().emptyRoute();
};

RtEditPage.prototype.btnNavInvert=function(button,ev){
    avnav.log("navInvert clicked");
    if (!this.checkRouteWritable()) return false;
    this.navobject.getRoutingHandler().invertRoute();
};

//-------------------------- WP ----------------------------------------
RtEditPage.prototype.btnWpEdit=function(button,ev) {
    avnav.log("Edit clicked");
    if (! this.selectedWp) return;
    this.showWaypointDialog(this.selectedWp);
};

RtEditPage.prototype.btnWpLocate=function(button,ev) {
    avnav.log("locate clicked");
    if (! this.selectedWp) return;
    this.gui.getMap().setCenter(this.selectedWp);
    this.gui.getMap().triggerRender();
};

RtEditPage.prototype.btnWpGoto=function(button,ev) {
    avnav.log("Goto clicked");
    var wp=this.selectedWp;
    this.hideWpButtons();
    if (this.routingVisible()) this.hideRouting();
    if (! wp) {
        return;
    }
    this.navobject.getRoutingHandler().wpOn(wp);
};
RtEditPage.prototype.btnNavNext=function(button,ev) {
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
RtEditPage.prototype.btnWpNext=function(button,ev) {
    avnav.log("WpNext clicked");
    if (! this.selectedWp) return;
    var router=this.navobject.getRoutingHandler();
    var next=router.getPointAtOffset(this.selectedWp,1);
    if (! next) return;
    if (this.routingVisible()) router.setEditingWp(next);
    this.showWpButtons(next);
};

RtEditPage.prototype.btnWpPrevious=function(button,ev) {
    avnav.log("WpPrevious clicked");
    if (! this.selectedWp) return;
    var router=this.navobject.getRoutingHandler();
    var next=router.getPointAtOffset(this.selectedWp,-1);
    if (! next) return;
    if (this.routingVisible()) router.setEditingWp(next);
    this.showWpButtons(next);
};


/**
 * create the page instance
 */
(function(){
    //create an instance of the status page handler
    var page=new RtEditPage();
}());

