/**
 * Created by andreas on 02.05.14.
 */
var React=require('react');
var ReactDOM=require('react-dom');
var WaypointList=require('../components/ItemList.jsx');
var WaypointItem=require('../components/WayPointListItem.jsx');
var Formatter=require('../util/formatter');
var NavCompute=require('../nav/navcompute');
var navobjects=require('../nav/navobjects');
var routeobjects=require('../nav/routeobjects');
var OverlayDialog=require('../components/OverlayDialog.jsx');
var WayPointDialog=require('../components/WaypointDialog.jsx');
var Store=require('../util/store');
var ItemUpdater=require('../components/ItemUpdater.jsx');

var keys={
    waypointList:'waypointList',
    waypointSelections: 'waypointSelections',
    routeInfo: 'routeInfo'
};

var selectors={
    selected: 'avn_route_info_active_point',
    target: 'avn_route_info_target'
};

/**
 *
 * @constructor
 */
var Routepage=function(){
    avnav.gui.Page.call(this,'routepage');
    this.MAXUPLOADSIZE=100000;
    /**
     * @private
     * @type {Object}
     */
    this.routingHandler=undefined;
    /**
     * @private
     * @type {avnav.util.Formatter}
     */
    this.formatter=new Formatter();

    /**
     * if we loaded a route we will keep it here and set this as editing
     * when we leave
     * @type {routeobjects.Route}
     */
    this.currentRoute=undefined;
    /**
     * the name of the route when we loaded the page
     * @type {undefined}
     */
    this.initialName=undefined;
    /**
     * set to true if we have the active route on show (if we are not returning)
     * @type {boolean}
     * @private
     */
    this._isEditingActive=false;
    this.store=new Store();
    var self=this;
    $(document).on(navobjects.NavEvent.EVENT_TYPE, function(ev,evdata){
        self.navEvent(evdata);
    });
    $(document).on(avnav.gui.AndroidEvent.EVENT_TYPE,function(ev,evdata){
        if (evdata.key && avnav.util.Helper.startsWith(evdata.key,"route")){
            self.androidEvent(evdata.key,evdata.id);
        }
    });
};
avnav.inherits(Routepage,avnav.gui.Page);


Routepage.prototype.localInit=function(){
    if (! this.gui) return;
    this.routingHandler=this.gui.navobject.getRoutingHandler();
    var self=this;
    var heading = React.createElement(ItemUpdater(React.createClass({
        render: function(){
            return (
                <div className="avn_routeCurrent" onClick={this.props.onClick}>
                <div className="avn_routeName">{this.props.name||''}</div>
                <div className="avn_routeInfo">{this.props.numPoints||0}Points,{this.props.len||0}nm</div>
                <span className="avn_more"> </span>
                </div>
            );
        }
    }), this.store, keys.routeInfo), {
        onClick: function () {
            var okCallback = function (name, closeFunction) {
                if (name != self.initialName) {
                    //check if a route with this name already exists
                    self.routingHandler.fetchRoute(name, false,
                        function (data) {
                            self.toast("route with name " + name + " already exists", true);
                        },
                        function (er) {
                            closeFunction();
                            self.currentRoute.setName(name);
                            self._updateDisplay();
                        });
                    return false;
                }
                return true;
            };
            OverlayDialog.valueDialog("Edit Route Name", self.currentRoute.name,
                okCallback, self.getDialogContainer(), 'Name'
            );
        }
    });
    var list=React.createElement(ItemUpdater(WaypointList,this.store,[keys.waypointList,keys.waypointSelections]), {
        onItemClick:function(item,opt_data){
            self.waypointClicked(item,opt_data);
        },
        itemClass:WaypointItem,
        selectors:selectors,
        updateCallback: function(){
            avnav.util.Helper.scrollItemIntoView('.avn_route_info_active_point','#avi_routepage_wplist')
        }
    });
    var routePageContent=React.createElement("div",{},heading,list);
    ReactDOM.render(routePageContent,this.selectOnPage('.avn_left_inner')[0]);
    this.selectOnPage('#avi_route_current').on('click',function(){
        var okCallback=function(name,closeFunction){
            if (name != self.initialName) {
                //check if a route with this name already exists
                self.routingHandler.fetchRoute(name, false,
                    function (data) {
                        self.toast("route with name " + name + " already exists",true);
                    },
                    function (er) {
                        closeFunction();
                        self.currentRoute.setName(name);
                        self._updateDisplay();
                    });
                return false;
            }
            return true;
        };
        OverlayDialog.valueDialog("Edit Route Name",self.currentRoute.name,
            okCallback,self.getDialogContainer(),'Name'
        );

    });
};
Routepage.prototype.showPage=function(options) {
    if (!this.gui) return;
    var initial=true;
    if (options && options.returning) initial=false;
    this.store.resetData();
    this.fillData(initial);

};


Routepage.prototype._updateDisplay=function(){
    var self=this;
    if (! this.currentRoute) {
        this.store.storeData(keys.waypointList,{itemList:[]});
        this.store.storeData(keys.waypointSelections,{selectors:{}});
        this.store.storeData(keys.routeInfo,{});
        return;
    }
    var targetIdx=-1;
    if (this._isEditingActive){
        $('#avi_routes_headline').text("Active Route");
        this.selectOnPage('.avn_left_top').addClass('avn_active_headline');
        targetIdx=this.currentRoute.findBestMatchingIdx(this.routingHandler.getCurrentLegTarget());
    }
    else{
        $('#avi_routes_headline').text("Inactive Route");
        this.selectOnPage('.avn_left_top').removeClass('avn_active_headline');
    }
    var info={name: this.currentRoute.name};
    var len=this.currentRoute.computeLength(0);
    info.len=this.formatter.formatDecimal(len,6,2);
    info.numPoints=this.formatter.formatDecimal(this.currentRoute.points.length,2,0);
    this.store.storeData(keys.routeInfo,info);
    var waypoints=this.currentRoute.getFormattedPoints();
    waypoints.forEach(function(waypoint){
       waypoint.key=waypoint.idx; 
    });
    this.store.storeData(keys.waypointList,{
        itemList:waypoints,
        childProperties :{showLatLon: this.gui.properties.getProperties().routeShowLL}
        });
    this.updateSelection(selectors.target,targetIdx);
};

Routepage.prototype.waypointClicked=function(item,param){
    if (param && param=='btnDelete'){
        if (!this.currentRoute) return;
        this.currentRoute.deletePoint(item.idx);
        this._updateDisplay();
        return;
    }
    if (! this.currentRoute) return;
    var currentSelectors=this.store.getData(keys.waypointSelections,{}).selectors;
    if (! currentSelectors || currentSelectors[selectors.selected] != item.key){
        this.updateSelection(selectors.selected,item.key);
        return;
    }
    var self=this;
    var wp=this.currentRoute.getPointAtIndex(item.idx);
    var wpChanged=function(newWp,close){
        var changedWp=WayPointDialog.updateWaypoint(wp,newWp,function(err){
            self.toast(avnav.util.Helper.escapeHtml(err));
        });
        if (changedWp) {
            if (!self.currentRoute.changePoint(wp,changedWp)){
                self.toast("unable to set waypoint, already exists");
                return false;
            }
            self._updateDisplay();
            return true;
        }
        return false;
    };
    OverlayDialog.dialog(WayPointDialog,this.getDialogContainer(),{
        waypoint:wp,
        okCallback:wpChanged
    });
};
Routepage.prototype.updateSelection=function(key,value){
    this.store.updateSubItem(keys.waypointSelections,key,value,'selectors');
};
Routepage.prototype.fillData=function(initial){
    if (initial) {
        this.currentRoute = this.routingHandler.getEditingRoute().clone();
        this.initialName = this.currentRoute.name;
        this._isEditingActive=this.routingHandler.isActiveRoute(this.currentRoute.name);
        var editingWaypoint=this.currentRoute.getIndexFromPoint(this.routingHandler.getEditingWp());
        //we use the idx as key in the list...
        this.updateSelection(selectors.selected,editingWaypoint);
    }
    this._updateDisplay();
};



Routepage.prototype.hidePage=function(){
};

/**
 *
 * @param {navobjects.NavEvent} ev
 */
Routepage.prototype.navEvent=function(ev){
    if (! this.visible) return;
    if (ev.type == navobjects.NavEventType.ROUTE){
        this._updateDisplay();
    }

};
Routepage.prototype.androidEvent=function(key,id){
    this.fillData(false);
};
Routepage.prototype.goBack=function(){
    this.btnRoutePageCancel();
};

/**
 * store the route we are currently editing
 * @private
 * @param opt_targetSelected if this is set to true and we are editing the active route
 *        start routing to the selected waypoint instead of the currently active one
 */
Routepage.prototype.storeRoute=function(opt_targetSelected){
    if (! this.currentRoute) return;
    var selectedWaypoint=this.store.getData(keys.waypointSelections,{selectors:{}}).selectors[selectors.selected];
    this.routingHandler.setNewEditingRoute(this.currentRoute, this._isEditingActive);
    if (selectedWaypoint !== undefined) {
        this.routingHandler.setEditingWpIdx(selectedWaypoint);
    }
    this.initialName=this.currentRoute.name;
    var targetWp;
    if (this._isEditingActive) {
        targetWp = this.currentRoute.getPointAtIndex(this.currentRoute.findBestMatchingIdx(this.routingHandler.getCurrentLegTarget()));
    }
    if (opt_targetSelected && selectedWaypoint !== undefined) {
        targetWp = this.currentRoute.getPointAtIndex(selectedWaypoint);
    }
    if (targetWp) {
        this.routingHandler.wpOn(targetWp, !opt_targetSelected);
    }
    else{
        if (this._isEditingActive){
            this.routingHandler.routeOff();
        }
    }

};
//-------------------------- Buttons ----------------------------------------

Routepage.prototype.btnRoutePageOk=function (button,ev){
    if (! this.currentRoute) this.gui.returnToLast();
    var self=this;
    if (this.currentRoute.name != this.initialName ){
        //check if a route with this name already exists
        this.routingHandler.fetchRoute(this.currentRoute.name,false,
        function(data){
            self.toast("route with name "+this.currentRoute.name+" already exists",true);
        },
        function(er){
            self.storeRoute();
            self.gui.returnToLast();
        });
        return;
    }
    this.storeRoute();
    this.gui.returnToLast();
};

Routepage.prototype.btnNavGoto=function (button,ev){
    if (! this.currentRoute) this.gui.returnToLast();
    var self=this;
    if (this.currentRoute.name != this.initialName ){
        //check if a route with this name already exists
        this.routingHandler.fetchRoute(this.currentRoute.name,false,
            function(data){
                self.toast("route with name "+this.currentRoute.name+" already exists",true);
            },
            function(er){
                self.storeRoute(true);
                self.gui.returnToLast();
            });
        return;
    }
    this.storeRoute(true);
    this.gui.returnToLast();
};

Routepage.prototype.btnRoutePageCancel=function (button,ev){
    avnav.log("Cancel clicked");
    this.gui.returnToLast();
};

Routepage.prototype.btnRoutePageDownload=function(button,ev){
    avnav.log("route download clicked");
    //TODO: ask if we had changes
    var self=this;
    this.gui.showPage("downloadpage",{
        downloadtype:'route',
        allowChange: false,
        selectItemCallback: function(item){
            this.routingHandler.fetchRoute(item.name,false,
                function(route){
                    self.currentRoute=route;
                    self.initialName=route.name;
                    self._isEditingActive=self.routingHandler.isActiveRoute(self.currentRoute.name);
                    self.gui.returnToLast();
                },
                function(err){
                    self.toast("unable to load route",true);
                }
            );
        }
    })
};


Routepage.prototype.btnNavDeleteAll=function(button,ev){
    avnav.log("navDeletAll clicked");
    this.currentRoute.points=[];
    this._updateDisplay();
};

Routepage.prototype.btnNavInvert=function(button,ev){
    avnav.log("navInvert clicked");
    this.currentRoute.swap();
    this._updateDisplay();
};
/**
 * create the page instance
 */
(function(){
    //create an instance of the status page handler
    var page=new Routepage();
}());

