/**
 * Created by andreas on 02.05.14.
 */

var React=require('react');
var ReactDOM=require('react-dom');
var WaypointList=require('../components/ItemListOld.jsx');
var WaypointItem=require('../components/WayPointItem.jsx');
var ItemList=require('../components/ItemListOld.jsx');
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
var Measure=require('react-measure').default;
var Helper=require('../util/helper');
var gkeys=require('../util/keys.jsx');
var globalStore=require('../util/globalstore.jsx');
var compare=require('../util/shallowcompare');

var keys={
    waypointList: 'waypointList',
    waypointSelections: 'selections',
    leftWidgets: 'leftWidgets',
    leftWidgetsSmall: 'leftWidgetsSmall',
    topWidgets: 'topWidgets',
    bottomLeftWidgets: 'bottomLeft',
    bottomRightWidgets: 'bottomRight',
    routingVisible: 'routingVisible',
    isSmall: 'isSmall',
    wpButtons: 'wpButtons',
    widgetDimensionsFull: 'fullDimensions',
    widgetDimensionsHalf: 'halfDimensions'
};
var wpKeyFlags={
    currentTarget:'currentTarget',
    routeActive: 'routeActive',
    wpActive: 'wpActive',
    routingVisible: 'routingVisible',
    lastRoutePoint: 'lastRoutePoint'
};
var widgetKeys=[keys.leftWidgets, keys.bottomLeftWidgets, keys.bottomRightWidgets,keys.topWidgets, keys.leftWidgetsSmall];
var selectors={
    selected: 'avn_route_info_active_point',
    centered: 'avn_route_info_centered'
};

/**
 *
 * @constructor
 * @extends {avnav.gui.Page}
 */
var Navpage=function(){
    Page.call(this,'navpage');
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
        {name:'CenterDisplay'},
        {name:'Zoom'},
        {name:'WindDisplay'},
        {name: 'DepthDisplay'},
        {name:'AisTarget'},
        {name:'ActiveRoute'},
        {name:'LargeTime'}
    ];
    this.widgetLists[keys.topWidgets]=[
        //items: ['CenterDisplay','AisTarget','ActiveRoute','LargeTime'],
        {name:'CenterDisplay'},
        {name:'DepthDisplay'},
        {name:'AisTarget'},
        {name:'EditRoute'},
        {name:'LargeTime'},
        {name:'Zoom'}
    ];
    this.widgetLists[keys.bottomLeftWidgets]=[
        //['BRG','DST','ETA','WpPosition']
        {name:'BRG'},
        {name:'DST'},
        {name:'ETA'},
        {name:'WpPosition'}
    ];
    this.widgetLists[keys.bottomRightWidgets]=[
        //['COG','SOG','TimeStatus','Position']
        {name:'COG'},
        {name:'SOG'},
        {name:'TimeStatus'},
        {name:'Position'}
    ];
    this.lastOtherLeft=0;
    
    this.panelWidth=undefined;
    this.panelHeight=undefined;
    /**
     * keep the last lock state when showinhg the WP buttons
     * @private
     * @type {undefined}
     */
    this.lastLockWp=undefined;
    this.lastCenter=undefined;

};
avnav.inherits(Navpage,Page);

/**
 * get the mapholder
 * @private
 * @returns {avnav.map.MapHolder}
 */
Navpage.prototype.getMap=function(){
    if (!this.gui) return null;
    return this.gui.map;
};

Navpage.prototype.routingVisible=function(){
    var isVisible=this.store.getData(keys.routingVisible);
    if (! isVisible) return false;
    return true;
};
Navpage.prototype.showPage=function(options){
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
    this.widgetVisibility();
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
    this.getMap().renderTo(this.mapdom);
    this.gui.navobject.setAisCenterMode(navobjects.AisCenterMode.MAP);
    if (!this.gui.properties.getProperties().layers.nav) this.hideRouting();
    if (this.gui.properties.getProperties().showClock) this.selectOnPage('#avi_navpage_clock').show();
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
        this.createButtons();
    }
};

Navpage.prototype.widgetVisibility=function(){
    var isSmall=this.isSmall();
    this.store.storeData(keys.isSmall,isSmall);
    var routingVisible=this.routingVisible();
    if (isSmall){
        this.gui.map.setCompassOffset(this.gui.properties.getProperties().widgetFontSize*5);
    }
    else{
        this.gui.map.setCompassOffset(0);
    }
    var aisVisible=this.gui.properties.getProperties().layers.ais;
    var routeVisible=this.gui.properties.getProperties().layers.nav;
    if (routeVisible) routeVisible=this.navobject.getRoutingHandler().hasActiveRoute();
    var centerVisible=this.gui.properties.getProperties().layers.measures;
    if (this.hidetime <=0 || this.hidetime <= new Date().getTime()|| this.gui.map.getGpsLock()){
        centerVisible=false;
    }
    var clockVisible=this.gui.properties.getProperties().showClock;
    var zoomVisible=this.gui.properties.getProperties().showZoom && ! routingVisible;
    var windVisible=this.gui.properties.getProperties().showWind;
    var depthVisible=this.gui.properties.getProperties().showDepth;
    if (!isSmall){
        this.store.updateData(keys.topWidgets,[],'itemList');
        this.store.updateData(keys.leftWidgets,this.widgetLists[keys.leftWidgets],'itemList');
    }
    else {
        this.store.updateData(keys.leftWidgets,this.widgetLists[keys.leftWidgetsSmall],'itemList');
        this.store.updateData(keys.topWidgets, this.widgetLists[keys.topWidgets], 'itemList');
    }
    globalStore.storeData(gkeys.gui.navpage.topWidgets,
        WidgetFactory.filterListByName(this.widgetLists[keys.topWidgets],
            {
                CenterDisplay: centerVisible && !routingVisible && isSmall,
                EditRoute: routingVisible && isSmall,
                AisTarget: aisVisible && !routingVisible && isSmall,
                LargeTime: clockVisible && !routingVisible && isSmall,
                Zoom: zoomVisible && isSmall,
                WindDisplay: windVisible && !routingVisible && isSmall,
                DepthDisplay: depthVisible && !routingVisible && isSmall
            }
        ));

    globalStore.storeData(gkeys.gui.navpage.leftWidgets,
        WidgetFactory.filterListByName(this.widgetLists[keys.leftWidgets],
            {
                CenterDisplay: centerVisible && !routingVisible && ! isSmall,
                AisTarget: aisVisible && !routingVisible  && ! isSmall,
                LargeTime: clockVisible && !routingVisible && ! isSmall,
                Zoom: zoomVisible  && ! isSmall,
                WindDisplay: windVisible && !routingVisible  && ! isSmall,
                DepthDisplay: depthVisible && !routingVisible  && ! isSmall,
                ActiveRoute: routeVisible && !routingVisible
            }));
    //currently no filtering for the bottom widgets
    globalStore.storeData(gkeys.gui.navpage.bottomLeftWidgets,this.widgetLists[keys.bottomLeftWidgets]);
    globalStore.storeData(gkeys.gui.navpage.bottomRightWidgets,this.widgetLists[keys.bottomRightWidgets]);

};
/**
 * the periodic timer call
 * update buttons and handle hiding of overlay
 * @param startTimer
 */
Navpage.prototype.buttonUpdate=function(){
    //TODO: make this more generic
    var markerLock=this.navobject.getRoutingHandler().getLock()||false;
    this.handleToggleButton('LockMarker',markerLock);
    this.store.updateSubItem(this.globalKeys.buttons,wpKeyFlags.wpActive, (markerLock || this.routingVisible()),"visibilityFlags") ;
    this.handleToggleButton('StopNav',markerLock);
    var gpsLock=this.gui.map.getGpsLock();
    this.handleToggleButton('LockPos',gpsLock);
    var courseUp=this.gui.map.getCourseUp();
    this.handleToggleButton('CourseUp',courseUp);
    var router=this.navobject.getRoutingHandler();
    if (this.selectedWp){
        if (router.isCurrentRoutingTarget(this.selectedWp)){
            this.store.updateSubItem(keys.wpButtons,wpKeyFlags.currentTarget,true,'visibilityFlags');
            this.store.updateSubItem(keys.wpButtons,wpKeyFlags.lastRoutePoint,router.getPointAtOffset(this.selectedWp,1)?false:true,'visibilityFlags');
        }
        else{
            this.store.updateSubItem(keys.wpButtons,wpKeyFlags.currentTarget,false,'visibilityFlags')
        }
        if (this.selectedWp.routeName){
            this.store.updateSubItem(keys.wpButtons,wpKeyFlags.routeActive,true,'visibilityFlags');
        }
        else{
            this.store.updateSubItem(keys.wpButtons,wpKeyFlags.routeActive,false,'visibilityFlags');
        }
    }
    this.store.updateSubItem(keys.wpButtons,wpKeyFlags.routingVisible,this.routingVisible(),'visibilityFlags');
};
/**
 *
 * @private
 */
Navpage.prototype._updateZoom=function(){
    var bzoom=this.getMap().getZoom();
    globalStore.storeMultiple(bzoom,{
        current: gkeys.gui.navpage.zoom,
        required: gkeys.gui.navpage.requiredZoom
    });
};
Navpage.prototype.timerEvent=function(){
    if (this.wpHidetime > 0 && this.wpHidetime <= new Date().getTime()){
        if (! (this.isSmall() && this.routingVisible())){
            this.lastLockWp=undefined; //do not surprise the user...
            this.hideWpButtons();
        }
    }

    this.buttonUpdate();
    this._updateZoom();
};
Navpage.prototype.hidePage=function(){
    this.hideWpButtons();
    this.hidetime=0;
    this.showRouteOnReturn=this.routingVisible();
    this.hideRouting(true);
    var map=this.getMap();
    if (map) map.renderTo(null);
};



Navpage.prototype.createButtons=function()
{
    var buttons;
    if (this.routingVisible()){
        buttons=[
            {key:"ZoomIn"},
            {key:"ZoomOut"},
            {key:"NavAdd"},
            {key:"NavDelete"},
            {key:"NavToCenter"},
            {key:"NavGoto"},
            {key:"NavInvert"},
            {key:"CancelNav"}
        ];
    }
    else {
        buttons = [
            {key: "ZoomIn"},
            {key: "ZoomOut"},
            {key: "LockPos", toggle: true},
            {key: "LockMarker", toggle: true},
            {key: "StopNav", toggle: true},
            {key: "CourseUp", toggle: true},
            {key: "ShowRoutePanel"},
            {key: "AnchorWatch",toggle:true},
            {key: "CancelNav"}
        ];
        Helper.addEntryToListItem(buttons,"key","LockMarker",wpKeyFlags.wpActive,false);
        Helper.addEntryToListItem(buttons,"key","StopNav",wpKeyFlags.wpActive,true);
    }
    var buttonFontSize=this.gui.properties.getButtonFontSize();
    this.store.replaceSubKey(this.globalKeys.buttons,buttonFontSize,'fontSize');
    this.setButtons(buttons);
};
Navpage.prototype.wpButtons=function(onoff){
    //TODO: handle active wp
    var buttonFontSize=this.gui.properties.getButtonFontSize();
    this.store.replaceSubKey(keys.wpButtons,buttonFontSize,'fontSize');
    if (! onoff) {
        this.store.updateSubItem(keys.wpButtons,'itemList',[]);
        return;
    }
    var wpButtons=[
        {key:'WpLocate'},
        {key:'WpEdit'},
        {key:'WpGoto'},
        {key:'NavNext'},
        {key:'WpNext'},
        {key:'WpPrevious'}
    ];
    Helper.addEntryToListItem(wpButtons,"key","WpGoto",wpKeyFlags.currentTarget,false);
    Helper.addEntryToListItem(wpButtons,"key","WpGoto",wpKeyFlags.routingVisible,false);
    Helper.addEntryToListItem(wpButtons,"key","NavNext",wpKeyFlags.currentTarget,true);
    Helper.addEntryToListItem(wpButtons,"key","NavNext",wpKeyFlags.routeActive,true);
    Helper.addEntryToListItem(wpButtons,"key","NavNext",wpKeyFlags.routingVisible,false);
    Helper.addEntryToListItem(wpButtons,"key","NavNext",wpKeyFlags.lastRoutePoint,false);
    Helper.addEntryToListItem(wpButtons,"key","WpNext",wpKeyFlags.routeActive,true);
    Helper.addEntryToListItem(wpButtons,"key","WpPrevious",wpKeyFlags.routeActive,true);
    this.store.updateSubItem(keys.wpButtons,'itemList',wpButtons);
};
/**
 *
 */
Navpage.prototype.getPageContent=function(){
    var self=this;
    self.createButtons();

    $(document).on(navobjects.NavEvent.EVENT_TYPE, function(ev,evdata){
        self.navEvent(evdata);
    });
    $(document).on(avnav.map.MapEvent.EVENT_TYPE, function(ev,evdata){
        self.mapEvent(evdata);
    });
    var widgetCreator=function(widget){
        var store=widget.store||self.store;
        return WidgetFactory.createWidget(widget,{propertyHandler:self.gui.properties, store:store});
    };
    var buttonUpdater={
      dataChanged: function(store, keys){
          if (! keys || keys.length < 1) return; //ignore any global updates
          self.createButtons();
      }
    };
    this.store.register(buttonUpdater,keys.routingVisible);
    var RoutePoints=ItemUpdater(WaypointList,this.store,[keys.waypointList,keys.waypointSelections]);
    var RouteInfo=WidgetFactory.createWidget({name:'EditRoute'});
    var widgetMargin=this.gui.properties.getProperties().style.widgetMargin;
    var routePanel = function (props) {
        if (!props.routingVisible || props.isSmall) return null;
        return (
            <div id="avi_route_info_navpage" className="avn_routeDisplay">
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
    let RoutePanel=ItemUpdater(routePanel,this.store,[keys.routingVisible,keys.isSmall]);
    let numWRows=this.gui.properties.getProperties().allowTwoWidgetRows?2:1;
    let LeftBottom=ItemUpdater(ItemList,globalStore,{itemList:gkeys.gui.navpage.bottomLeftWidgets});
    let leftBottomProperties={
        className: "leftBottomMarker avn_widgetContainer_vertical",
        onItemClick: self.widgetClick,
        itemCreator: widgetCreator
    };
    let RightBottom=ItemUpdater(ItemList,globalStore,{itemList:gkeys.gui.navpage.bottomRightWidgets});
    let rightBottomProperties={
        className: 'leftBottomPosition avn_widgetContainer_vertical',
        onItemClick: self.widgetClick,
        itemCreator: widgetCreator
    };

    var NavLeftContainer=ItemUpdater(ItemList,globalStore,{itemList:gkeys.gui.navpage.leftWidgets});
    let navLeftProperties={
        className: "avn_navLeftContainer avn_widgetContainer",
        onItemClick: self.widgetClick,
        itemCreator: widgetCreator,
        hideOnEmpty: true
    };
    var TopWidgets=ItemUpdater(ItemList,globalStore,{itemList:gkeys.gui.navpage.topWidgets});
    let topWidgetProperties={
        className: "avn_topRightWidgets avn_widgetContainer",
        onItemClick: self.widgetClick,
        itemCreator: widgetCreator,
        hideOnEmpty: true,
        childProperties: {mode: 'small'}
    };
    var WpButtons=ItemUpdater(ButtonList,this.store,keys.wpButtons);
    self.store.updateData(keys.wpButtons,{
        className: "avn_wpbuttons",
        buttonHandler: self
    });
    var Alarm=self.getAlarmWidget();
    class Main extends React.Component{
        constructor(props){
            super(props)
        }
        render(){
            let bottomDouble=self.gui.properties.getProperties().allowTwoWidgetRows?" two_rows":"";
            return (
                <div className="avn_panel_fill_flex">
                    <div id='avi_map_navpage' ref="map" className='avn_panel avn_map'/>
                    <div className="avn_flexFill">
                        <TopWidgets {...topWidgetProperties}/>
                        <RoutePanel/>
                        <WpButtons/>
                        <div className="avn_leftFrame" >
                            <NavLeftContainer {...navLeftProperties}/>
                        </div>
                        {Alarm}
                    </div>
                    <div className="avn_nav_bottom" >
                        <LeftBottom {...leftBottomProperties} className={leftBottomProperties.className + bottomDouble} />
                        <RightBottom {...rightBottomProperties} className={rightBottomProperties.className + bottomDouble}/>
                    </div>
                </div>
            );
        }
        componentDidMount(){
            self.mapdom=this.refs.map;
            var map=self.getMap();
            if (map) map.renderTo(self.mapdom);
        }
    };
    return Main;
};
Navpage.prototype.isWidgetInList=function(widgetDescription,listKey){
    var list=this.widgetLists[listKey];
    if (! list) return false;
    for (var w in list){
        if (list[w].name == widgetDescription.name){
            return true;
        }
    }
    return false;
};
Navpage.prototype.widgetClick=function(widgetDescription){
    if (widgetDescription.name == "AisTarget" && widgetDescription.mmsi){
        this.gui.showPage("aisinfopage",{mmsi:widgetDescription.mmsi});
        return;
    }
    if (widgetDescription.name == "ActiveRoute"){
        this.navobject.getRoutingHandler().startEditingRoute();
        this.gui.showPage("routepage");
        return;
    }
    if (widgetDescription.name == "CenterDisplay"){
        this.hidetime=0;
        this.widgetVisibility();
        return;
    }
    if (widgetDescription.name == "EditRoute"){
        this.gui.showPage("routepage");
        return;
    }
    if (widgetDescription.name == "Zoom"){
        this.gui.map.checkAutoZoom(true);
        return;
    }
    if (widgetDescription.name == 'WindDisplay' || widgetDescription.name == 'DepthDisplay'){
        this.gui.showPage("gpspage",{secondPage:true});
        return;
    }
    if (this.isWidgetInList(widgetDescription,keys.bottomLeftWidgets)){
        var wp=this.navobject.getRoutingHandler().getCurrentLegTarget();
        if (wp){
            this.gui.map.setCenter(wp);
            if (this.routingVisible() && ! this.isSmall()) {
                return;
            }
            this.lastLockWp=this.gui.map.getGpsLock();
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
Navpage.prototype.navEvent=function(evdata){
    if (! this.visible) return;
    if (evdata.type == navobjects.NavEventType.ROUTE){
        if (this.routingVisible())this.updateRoutePoints();
    }
};
/**
 *
 * @param {avnav.map.MapEvent} evdata
 */
Navpage.prototype.mapEvent=function(evdata){
    var self=this;
    if (! this.visible) return;
    this._updateZoom();
    if (evdata.type == avnav.map.EventType.MOVE) {
        var nCenter=this.gui.map.getCenter();
        if (! compare(this.lastCenter,nCenter)) {
            this.lastCenter=nCenter;
            //show the center display if not visible
            if (!this.routingVisible()) {
                this.hidetime = new Date().getTime() + this.gui.properties.getProperties().centerDisplayTimeout;
                this.widgetVisibility();
                return;

            }
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
            this.lastLockWp=this.gui.map.getGpsLock();
            this.showWpButtons(wp);
        }
    }
};


/**
 * show the route editing part
 * @param {boolean} opt_returning
 */
Navpage.prototype.showRouting=function(opt_returning) {
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
    this.gui.map.setRoutingActive(true);
    var nLock=this.gui.map.getGpsLock();
    this.lastGpsLock=nLock;
    if (nLock) {
        this.gui.map.setGpsLock(!nLock);
        this.handleToggleButton('.avb_LockPos', !nLock);
        this.gui.map.triggerRender();
    }
    this.updateRoutePoints(true,false);
    this.hidetime=0;
    if (isSmall) this.showWpButtons(this.navobject.getRoutingHandler().getEditingWp(),true);
};

/**
 * @private
 * @param {boolean} opt_noStop - do not stop editing
 */
Navpage.prototype.hideRouting=function(opt_noStop) {
    var upd=false;
    this.store.storeData(keys.routingVisible,false);
    this.widgetVisibility();
    this.hideWpButtons();
    if (! opt_noStop) {
        this.gui.map.setRoutingActive(false);
        this.navobject.getRoutingHandler().stopEditingRoute();
    }
    if (this.lastGpsLock) {
        this.gui.map.setGpsLock(true);
        this.lastGpsLock=false;
    }
};




Navpage.prototype.leftPanelChanged=function(rect){
    var self=this;
    var doUpdate=false;
    if (rect.width != this.panelWidth || rect.height != this.panelHeight){
        this.panelHeight=rect.height;
        this.panelWidth=rect.width;
        doUpdate=true;
    }
    var buttonFontSize=this.gui.properties.getButtonFontSize();
    this.store.updateData(keys.wpButtons,{fontSize:buttonFontSize});
    if (! doUpdate) return;
    this.getMap().renderTo(this.mapdom);
    self.widgetVisibility();
    window.setTimeout(function(){
        self.scrollRoutePoints();
        if (self.routingVisible()) {
            if (!self.isSmall()) self.hideWpButtons();
            else self.showWpButtons(self.navobject.getRoutingHandler().getEditingWp());
        }
    },0);
};



Navpage.prototype.waypointClicked=function(item,options){
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

Navpage.prototype.scrollRoutePoints=function(){
    avnav.util.Helper.scrollItemIntoView('.avn_route_info_active_point','#avi_route_info_navpage .avn_listContainer');
};
Navpage.prototype.updateRoutePoints=function(opt_initial,opt_centerActive){
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
    self.selectedWp=activeWp;
    if (opt_initial && activeWp){
        var sel={};
        sel[selectors.selected]=active;
        if (opt_centerActive) {
            sel[selectors.centered] = active;
            this.gui.map.setCenter(activeWp);
        }
        else{
            sel[selectors.centered]=-1; //no waypoint centered yet
        }
        this.store.replaceSubKey(keys.waypointSelections,sel,'selectors');
    };
    if (! opt_initial && opt_centerActive && activeWp){
        this.gui.map.setCenter(activeWp);
        this.store.updateSubItem(keys.waypointSelections, selectors.centered, active, 'selectors');

    };
};



Navpage.prototype.checkRouteWritable=function(){
    if (this.navobject.getRoutingHandler().isRouteWritable()) return true;
    var ok=OverlayDialog.confirm("you cannot edit this route as you are disconnected. OK to select a new name",this.getDialogContainer());
    var self=this;
    ok.then(function(){
        self.gui.showPage('routepage');
    });
    return false;
};

Navpage.prototype.showWpButtons=function(waypoint,opt_nocenter){
    if (!opt_nocenter) this.gui.map.setCenter(waypoint);
    this.wpButtons(true);
    this.selectedWp=waypoint;
    this.wpHidetime=new Date().getTime() + this.gui.properties.getProperties().centerDisplayTimeout;
    this.gui.map.setGpsLock(false);
    this.buttonUpdate();
    this.gui.map.triggerRender();
};

Navpage.prototype.hideWpButtons=function(){
    if (!this.selectedWp) return;
    this.wpButtons(false);
    this.selectedWp=undefined;
    this.wpHidetime=0;
    if (this.lastLockWp !== undefined) this.gui.map.setGpsLock(this.lastLockWp);
    this.lastLockWp=undefined;
};


Navpage.prototype.showWaypointDialog=function(wp){
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
    let RenderDialog=function(props){
        return <WaypointDialog
            {...props}
            waypoint={wp}
            okCallback={ok}/>
    };
    OverlayDialog.dialog(RenderDialog,self.getDialogContainer());
};


Navpage.prototype.goBack=function(){
    this.btnCancelNav();
};

//-------------------------- Buttons ----------------------------------------

Navpage.prototype.btnZoomIn=function (button,ev){
    avnav.log("ZoomIn clicked");
    this.getMap().changeZoom(1);
};

Navpage.prototype.btnZoomOut=function (button,ev){
    avnav.log("ZoomOut clicked");
    this.getMap().changeZoom(-1);
};
Navpage.prototype.btnLockPos=function (button,ev){
    this.hideWpButtons();
    var nLock=! this.gui.map.getGpsLock();
    this.gui.map.setGpsLock(nLock);
    this.handleToggleButton("LockPos",nLock);
    this.gui.map.triggerRender();
    this.widgetVisibility();
    avnav.log("LockPos clicked");
};
Navpage.prototype.btnLockMarker=function (button,ev) {
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
Navpage.prototype.btnStopNav=function (button,ev) {
    avnav.log("StopNav clicked");
    this.hideWpButtons();
    this.navobject.getRoutingHandler().routeOff();
    this.buttonUpdate();
    this.hideRouting();
    this.gui.map.triggerRender();

};
Navpage.prototype.btnCourseUp=function (button,ev){
    var nLock=! this.gui.map.getCourseUp();
    nLock=this.gui.map.setCourseUp(nLock);
    this.handleToggleButton("CourseUp",nLock);
    this.gui.map.triggerRender();
    avnav.log("courseUp clicked");
};
Navpage.prototype.btnShowRoutePanel=function (button,ev){
    avnav.log("showRoutePanel clicked");
    this.hideWpButtons();
    if (! this.routingVisible()) this.showRouting();
    else this.hideRouting();
};
Navpage.prototype.btnCancelNav=function (button,ev){
    avnav.log("CancelNav clicked");
    this.hideWpButtons();
    if (this.routingVisible()){
        this.hideRouting();
        return;
    }
    this.gui.showPage('mainpage');
};


//-------------------------- Route ----------------------------------------
Navpage.prototype.btnNavAdd=function (button,ev){
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

Navpage.prototype.btnNavDelete=function (button,ev){
    avnav.log("navDelete clicked");this.checkRouteWritable();
    if (!this.checkRouteWritable()) return false;
    this.navobject.getRoutingHandler().deleteWp(-1);
    this.updateRoutePoints(false,true);
};
Navpage.prototype.btnNavToCenter=function (button,ev){
    avnav.log("navDelete clicked");
    if (!this.checkRouteWritable()) return false;
    var center=this.gui.map.getCenter();
    this.navobject.getRoutingHandler().changeWpByIdx(
        -1,center
    );
};
Navpage.prototype.btnNavGoto=function(button,ev){
    avnav.log("navGoto clicked");
    this.navobject.getRoutingHandler().wpOn(this.navobject.getRoutingHandler().getEditingWp());
    this.hideRouting();
};

Navpage.prototype.btnNavDeleteAll=function(button,ev){
    avnav.log("navDeletAll clicked");
    if (!this.checkRouteWritable()) return false;
    this.navobject.getRoutingHandler().emptyRoute();
};

Navpage.prototype.btnNavInvert=function(button,ev){
    avnav.log("navInvert clicked");
    if (!this.checkRouteWritable()) return false;
    this.navobject.getRoutingHandler().invertRoute();
};

//-------------------------- WP ----------------------------------------
Navpage.prototype.btnWpEdit=function(button,ev) {
    avnav.log("Edit clicked");
    if (! this.selectedWp) return;
    this.showWaypointDialog(this.selectedWp);
};

Navpage.prototype.btnWpLocate=function(button,ev) {
    avnav.log("locate clicked");
    if (! this.selectedWp) return;
    this.gui.map.setCenter(this.selectedWp);
    this.gui.map.triggerRender();
};

Navpage.prototype.btnWpGoto=function(button,ev) {
    avnav.log("Goto clicked");
    var wp=this.selectedWp;
    this.hideWpButtons();
    if (this.routingVisible()) this.hideRouting();
    if (! wp) {
        return;
    }
    this.navobject.getRoutingHandler().wpOn(wp);
};
Navpage.prototype.btnNavNext=function(button,ev) {
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
Navpage.prototype.btnWpNext=function(button,ev) {
    avnav.log("WpNext clicked");
    if (! this.selectedWp) return;
    var router=this.navobject.getRoutingHandler();
    var next=router.getPointAtOffset(this.selectedWp,1);
    if (! next) return;
    if (this.routingVisible()) router.setEditingWp(next);
    this.showWpButtons(next);
};

Navpage.prototype.btnWpPrevious=function(button,ev) {
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
    var page=new Navpage();
}());

