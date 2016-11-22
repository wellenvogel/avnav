/**
 * Created by andreas on 02.05.14.
 */
avnav.provide('avnav.gui.Routepage');
var React=require('react');
var ReactDOM=require('react-dom');
var WaypointList=require('../components/ItemList.jsx');
var WaypointItem=require('../components/WayPointListItem.jsx');
var EditOverlay=require('./wpoverlay');
var SimpleDialog=require('./simpledialog');
var Formatter=require('../util/formatter');
var NavCompute=require('../nav/navcompute');
var navobjects=require('../nav/navobjects');
var routeobjects=require('../nav/routeobjects');




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
    this.editOverlay=undefined;
    this.editNameOverlay=undefined;
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
    this.editOverlay=new EditOverlay(this.selectOnPage('.avn_left_panel'),{
        okCallback:function(){
            return self._waypointChanged()
        },
        cancelCallback: function(){return true;}
    });
    this.editNameOverlay=new SimpleDialog(this.selectOnPage('.avn_left_panel'),{
       okCallback: function(){
           return self._nameChanged();
       },
       cancelCallback: function(){return true;}
    });

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
       self.editNameOverlay.show("Edit Route Name","Name",self.currentRoute.name);
    });
};
avnav.gui.Routepage.prototype.showPage=function(options) {
    if (!this.gui) return;
    var initial=true;
    if (options && options.returning) initial=false;
    this.fillData(initial);
};

avnav.gui.Routepage.prototype._waypointChanged=function(){
    var changedWp=this.editOverlay.updateWp(true);
    if (changedWp) {
        this.currentRoute.changePoint(this.editOverlay.getOldWp(),changedWp);
        this._updateDisplay();
        return true;
    }
};
avnav.gui.Routepage.prototype._updateDisplay=function(){
    var self=this;
    $('#avi_route_name').text("");
    if (! this.currentRoute) return;
    if (this.routingHandler.isActiveRoute(this.currentRoute.name)){
        $('#avi_routes_headline').text("Active Route");
        this.selectOnPage('.avn_left_top').addClass('avn_active_headline');
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
    var active=this.currentRoute.getIndexFromPoint(this.routingHandler.getCurrentLegTarget());
    this.waypointList.setState({
        itemList:waypoints,
        options: {showLatLon: this.gui.properties.getProperties().routeShowLL},
        selectors: {editing:active,selected:selected,target:active}
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
    var wp=this.currentRoute.getPointAtIndex(idx);
    this.editOverlay.show(wp);
};
avnav.gui.Routepage.prototype.fillData=function(initial){
    if (initial) {
        this.currentRoute = this.routingHandler.getEditingRoute().clone();
        this.initialName = this.currentRoute.name;
        this._editingWaypoint=this.routingHandler.getEditingWp();
        this._selectedWaypoint=this._editingWaypoint?this._editingWaypoint.clone():undefined;

    }
    this._updateDisplay();
};



avnav.gui.Routepage.prototype.hidePage=function(){
    if (this.editOverlay) this.editOverlay.overlayClose();
    if (this.editNameOverlay) this.editNameOverlay.overlayClose();
};

avnav.gui.Routepage.prototype._nameChanged=function() {
    var self=this;
    var data = this.editNameOverlay.getData();
    if (data.value && data.value != "") {
        var name=data.value;
        if (name != this.initialName) {
            //check if a route with this name already exists
            this.routingHandler.fetchRoute(name, false,
                function (data) {
                    avnav.util.Overlay.Toast("route with name " + name + " already exists", 5000);
                },
                function (er) {
                    self.editNameOverlay.overlayClose();
                    self.currentRoute.name=name;
                    self._updateDisplay();
                });
            return false;
        }
    }
    this._updateDisplay();
    return true;
};
/**
 *
 * @param {navobjects.NavEvent} ev
 */
avnav.gui.Routepage.prototype.navEvent=function(ev){
    if (! this.visible) return;

};
avnav.gui.Routepage.prototype.androidEvent=function(key,id){
    this.fillData(false);
};
avnav.gui.Routepage.prototype.goBack=function(){
    this.btnRoutePageCancel();
};

avnav.gui.Routepage.prototype.storeRoute=function(){
    if (! this.currentRoute) return;
    this.routingHandler.setNewEditingRoute(this.currentRoute);
    this.routingHandler.setEditingWpIdx(this.currentRoute.getIndexFromPoint(this._selectedWaypoint));
    this._editingWaypoint=this._selectedWaypoint;
    this.initialName=this.currentRoute.name;
};
//-------------------------- Buttons ----------------------------------------

avnav.gui.Routepage.prototype.btnRoutePageOk=function (button,ev){
    if (! this.currentRoute) this.gui.returnToLast();
    var self=this;
    if (this.currentRoute.name != this.initialName ){
        //check if a route with this name already exists
        this.routingHandler.fetchRoute(this.currentRoute.name,false,
        function(data){
            avnav.util.Overlay.Toast("route with name "+this.currentRoute.name+" already exists",5000);
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
                    self.gui.returnToLast();
                },
                function(err){
                    avnav.util.Overlay.Toast("unable to load route",5000);
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

