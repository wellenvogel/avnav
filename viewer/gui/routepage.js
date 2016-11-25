/**
 * Created by andreas on 02.05.14.
 */
avnav.provide('avnav.gui.Routepage');
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




/**
 *
 * @constructor
 */
avnav.gui.Routepage=function(){
    avnav.gui.Page.call(this,'routepage');
    this.MAXUPLOADSIZE=100000;
    /**
     * @private
     * @type {routeobjects.RouteData}
     */
    this.routingHandler=undefined;
    /**
     * @private
     * @type {avnav.util.Formatter}
     */
    this.formatter=new Formatter();
    /**
     *
     * @type {Array:navobjects.WayPoint}
     */
    this.waypoints=[];

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
    this.waypointList=undefined;
    /**
     * the waypoint that is currently active at the routing handler
     * @type {navobjects.WayPoint}
     * @private
     */
    this._editingWaypoint=undefined;
    /**
     * the current active waypoint
     * @type {undefined|navobjects.WayPoint}
     * @private
     */
    this._selectedWaypoint=undefined;
    /**
     * set to true if we have the active route on show (if we are not returning)
     * @type {boolean}
     * @private
     */
    this._isEditingActive=false;
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
avnav.inherits(avnav.gui.Routepage,avnav.gui.Page);


avnav.gui.Routepage.prototype.localInit=function(){
    if (! this.gui) return;
    this.routingHandler=this.gui.navobject.getRoutingHandler();
    var self=this;
    var list=React.createElement(WaypointList, {
        onClick:function(idx,opt_data){
            self.waypointClicked(idx,opt_data);
        },
        itemClass:WaypointItem,
        selectors:{
            selected: 'avn_route_info_active_point',
            editing: 'avn_route_info_editing_point',
            target: 'avn_route_info_target'
        },
        updateCallback: function(){
            avnav.util.Helper.scrollItemIntoView('.avn_route_info_active_point','#avi_routepage_wplist')
        }
    });
    this.waypointList=ReactDOM.render(list,document.getElementById('avi_routepage_wplist'));
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
avnav.gui.Routepage.prototype.showPage=function(options) {
    if (!this.gui) return;
    var initial=true;
    if (options && options.returning) initial=false;
    this.fillData(initial);

};


avnav.gui.Routepage.prototype._updateDisplay=function(){
    var self=this;
    $('#avi_route_name').text("");
    if (! this.currentRoute) return;
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
    $('#avi_route_name').text(this.currentRoute.name);
    var info="";
    var len=this.currentRoute.computeLength(0);
    info=this.formatter.formatDecimal(this.currentRoute.points.length,2,0)+
            " Points, "+this.formatter.formatDecimal(len,6,2)+" nm";
    this.selectOnPage('.avn_route_info').text(info);
    var waypoints=this.currentRoute.getFormattedPoints();
    var active=this.currentRoute.getIndexFromPoint(this._editingWaypoint);
    var selected=this.currentRoute.getIndexFromPoint(this._selectedWaypoint);
    this.waypointList.setState({
        itemList:waypoints,
        options: {showLatLon: this.gui.properties.getProperties().routeShowLL},
        selectors: {editing:active,selected:selected,target:targetIdx}
    });
};

avnav.gui.Routepage.prototype.waypointClicked=function(idx,param){
    if (param.item && param.item=='btnDelete'){
        if (!this.currentRoute) return;
        this.currentRoute.deletePoint(idx);
        this._updateDisplay();
        return;
    }
    if (! this.currentRoute) return;
    if (! param || ! param.selected){
        this._selectedWaypoint=this.currentRoute.getPointAtIndex(idx);
        this._updateDisplay();
        return;
    }
    var self=this;
    var wp=this.currentRoute.getPointAtIndex(idx);
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
avnav.gui.Routepage.prototype.fillData=function(initial){
    if (initial) {
        this.currentRoute = this.routingHandler.getEditingRoute().clone();
        this.initialName = this.currentRoute.name;
        this._editingWaypoint=this.routingHandler.getEditingWp();
        this._selectedWaypoint=this._editingWaypoint?this._editingWaypoint.clone():undefined;
        this._isEditingActive=this.routingHandler.isActiveRoute(this.currentRoute.name);
    }
    this._updateDisplay();
};



avnav.gui.Routepage.prototype.hidePage=function(){
};

/**
 *
 * @param {navobjects.NavEvent} ev
 */
avnav.gui.Routepage.prototype.navEvent=function(ev){
    if (! this.visible) return;
    if (ev.type == navobjects.NavEventType.ROUTE){
        this._updateDisplay();
    }

};
avnav.gui.Routepage.prototype.androidEvent=function(key,id){
    this.fillData(false);
};
avnav.gui.Routepage.prototype.goBack=function(){
    this.btnRoutePageCancel();
};

/**
 * store the route we are currently editing
 * @private
 * @param opt_targetSelected if this is set to true and we are editing the active route
 *        start routing to the selected waypoint instead of the currently active one
 */
avnav.gui.Routepage.prototype.storeRoute=function(opt_targetSelected){
    if (! this.currentRoute) return;
    this.routingHandler.setNewEditingRoute(this.currentRoute);
    this.routingHandler.setEditingWpIdx(this.currentRoute.getIndexFromPoint(this._selectedWaypoint));
    this._editingWaypoint=this._selectedWaypoint;
    this.initialName=this.currentRoute.name;
    var targetWp;
    if (this._isEditingActive) {
        targetWp = this.currentRoute.getPointAtIndex(this.currentRoute.findBestMatchingIdx(this.routingHandler.getCurrentLegTarget()));
    }
    if (opt_targetSelected) {
        targetWp = this.currentRoute.getPointAtIndex(this.currentRoute.getIndexFromPoint(this._selectedWaypoint));
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

avnav.gui.Routepage.prototype.btnRoutePageOk=function (button,ev){
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

avnav.gui.Routepage.prototype.btnNavGoto=function (button,ev){
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

avnav.gui.Routepage.prototype.btnRoutePageCancel=function (button,ev){
    avnav.log("Cancel clicked");
    this.gui.returnToLast();
};

avnav.gui.Routepage.prototype.btnRoutePageDownload=function(button,ev){
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
                    self._editingWaypoint=self.currentRoute.getPointAtIndex(0);
                    self._selectedWaypoint=self.currentRoute.getPointAtIndex(0);
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


avnav.gui.Routepage.prototype.btnNavDeleteAll=function(button,ev){
    avnav.log("navDeletAll clicked");
    this.currentRoute.points=[];
    this._editingWaypoint=undefined;
    this._selectedWaypoint=undefined;
    this._updateDisplay();
};

avnav.gui.Routepage.prototype.btnNavInvert=function(button,ev){
    avnav.log("navInvert clicked");
    this.currentRoute.swap();
    this._updateDisplay();
};
/**
 * create the page instance
 */
(function(){
    //create an instance of the status page handler
    var page=new avnav.gui.Routepage();
}());

