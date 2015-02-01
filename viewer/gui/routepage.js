/**
 * Created by andreas on 02.05.14.
 */
avnav.provide('avnav.gui.Routepage');




/**
 *
 * @constructor
 */
avnav.gui.Routepage=function(){
    avnav.gui.Page.call(this,'routepage');
    /**
     * the class that is assigned to visible routing entries
     * @type {string}
     */
    this.visibleListEntryClass="avn_route_visible_entry";
    /**
     * @private
     * @type {avnav.nav.RouteData}
     */
    this.routingData=undefined;
    /**
     * @private
     * @type {avnav.util.Formatter}
     */
    this.formatter=new avnav.util.Formatter();
    /**
     *
     * @type {Array:avnav.nav.RouteInfo}
     */
    this.routes=[];

    /**
     * the name of the current route (when the page is loaded)
     * @type {undefined}
     */
    this.currentName=undefined;
    /**
     * if we loaded a route we will keep it here and set this as editing
     * when we leave
     * @type {avnav.nav.Route}
     */
    this.loadedRoute=undefined;
    var self=this;
    $(document).on(avnav.nav.NavEvent.EVENT_TYPE, function(ev,evdata){
        self.navEvent(evdata);
    });
};
avnav.inherits(avnav.gui.Routepage,avnav.gui.Page);

avnav.gui.Routepage.prototype.localInit=function(){
    if (! this.gui) return;
    this.routingData=this.gui.navobject.getRoutingData();
    var self=this;
    $('#avi_route_name').keypress(function( event ) {
        if (event.which == 13) {
            event.preventDefault();
            self.btnRoutePageOk();
        }
    });
};
avnav.gui.Routepage.prototype.showPage=function(options) {
    if (!this.gui) return;
    this.fillData(true);
};
/**
 * find a route info in the list and return the index
 * @param routeInfo
 * @returns -1 if not found
 */
avnav.gui.Routepage.prototype.findRouteInfo=function(routeInfo){
    var i;
    for (i=0;i<this.routes.length;i++){
        if (this.routes[i].name == routeInfo.name) return i;
    }
    return -1;
};

avnav.gui.Routepage.prototype.displayInfo=function(id,routeInfo){
    $('#routeInfo-'+id).find('.avn_route_listdate').text(this.formatter.formatDateTime(new Date(routeInfo.time)));
    $('#routeInfo-'+id).find('.avn_route_listinfo').text(routeInfo.name+", "+this.formatter.formatDecimal(routeInfo.length,4,2)+
        " nm, "+routeInfo.numpoints+" points");
    if (routeInfo.server) {
        $('#routeInfo-' + id).find('.avn_route_listrasimage').show();
    }
    else {
        $('#routeInfo-' + id).find('.avn_route_listrasimage').hide();
    }
};

avnav.gui.Routepage.prototype.sort=function(a,b) {
    try {
        if (a.time == b.time) return 0;
        if (a.time < b.time) return 1;
        return -1;
    } catch (err) {
        return 0;
    }
};
/**
 * add routes to the list
 * @param routeInfos
 */
avnav.gui.Routepage.prototype.addRoutes=function(routeInfos){
    var i,curid;
    var self=this;
    for (i=0;i<routeInfos.length;i++) {
        curid = this.findRouteInfo(routeInfos[i]);
        if (curid >= 0) {
            //a second one will always update...
            this.routes[curid] = routeInfos[i];
            continue;
        }
        this.routes.push(routeInfos[i]);
    }
    this.routes.sort(this.sort);
};
avnav.gui.Routepage.prototype.updateDisplay=function(){
    var self=this;
    $('#avi_route_name').val(this.currentName);
    $("."+this.visibleListEntryClass).remove();
    var activeName=undefined;
    if (this.routingData.hasActiveRoute()){
        activeName=this.routingData.getRouteData().name;
    }
    var id;
    var routeInfos=this.routes;
    for (id=0;id<this.routes.length;id++){
        $('#avi_route_list_template').clone()
            .attr("routeId",id)
            .attr("id","routeInfo-"+id)
            .attr("routeidx",id)
            .addClass(this.visibleListEntryClass)
            .show()
            .insertAfter('.avn_route_list_entry:last');
        this.displayInfo(id,routeInfos[id]);
        if (this.currentName && routeInfos[id].name == this.currentName){
            $('#routeInfo-'+id).find('.avn_route_liststatimage').addClass("avn_route_current");
        }
        if (activeName && activeName == routeInfos[id].name){
            $('#routeInfo-'+id).find('.avn_route_liststatimage').addClass("avn_route_active").removeClass("avn_route_current");
            $('#routeInfo-' + id).find('.avn_route_btnDelete').hide();
        }
        else {
            $('#routeInfo-' + id).find('.avn_route_btnDelete').on('click', null, {id: id}, function (ev) {
                ev.preventDefault();
                var lid = ev.data.id;
                var name = self.routes[lid].name;
                //the current route could have changed...
                if (self.routingData.hasActiveRoute() && self.routingData.getRouteData().name == name){
                    alert("cannot delete active route");
                    self.fillData(false);
                    return false;
                }
                var ok = confirm("delete route " + name + "?");
                if (ok) {
                    self.routingData.deleteRoute(name, function (info) {
                        alert("failed to delete route " + name + " on server: " + info);
                    });
                    if (name == self.currentName) {
                        self.currentName = undefined;
                    }
                    if (self.loadedRoute && name == self.loadedRoute.name) self.loadedRoute=undefined;
                    self.fillData(false);

                }
                return false;
            });
        }
        $('#routeInfo-'+id).on('click',null,{id:id},function(ev){
            ev.preventDefault();
            var lid=ev.data.id;
            var rtinfo=undefined;
            try {
                rtinfo=self.routes[lid];
            }catch(e){}
            if (rtinfo){
                var name=rtinfo.name;
                self.routingData.fetchRoute(name,!rtinfo.server,
                    function(route){
                        self.loadedRoute=route;
                        self.fillData(false);
                        //self.gui.showPageOrReturn(this.returnpage,'navpage',{showRouting:true});
                    },
                    function(err){
                        alert("unable to load route "+name+": "+err);
                    }
                );

            }

        });
    }
};

avnav.gui.Routepage.prototype.fillData=function(initial){
    this.currentName=undefined;
    if (initial) this.loadedRoute=undefined;
    if (this.loadedRoute){
        this.currentName=this.loadedRoute.name;
    }
    else {
        if (this.routingData.getCurrentRoute()) this.currentName = this.routingData.getCurrentRoute().name;
    }
    this.routes=[];
    var localRoutes=this.routingData.listRoutesLocal();
    this.addRoutes(localRoutes);
    this.updateDisplay();
    if (!this.gui.properties.getProperties().connectedMode) return;
    this.routingData.listRoutesServer(
        function(routingInfos,param){
            param.self.addRoutes(routingInfos);
            param.self.updateDisplay();
        },
        function(err,param){
            alert("unable to load routes from server: "+err);
        },
        { self:this}
    );
};


avnav.gui.Routepage.prototype.hidePage=function(){

};
/**
 *
 * @param {avnav.nav.NavEvent} ev
 */
avnav.gui.Routepage.prototype.navEvent=function(ev){
    if (! this.visible) return;

};
//-------------------------- Buttons ----------------------------------------

avnav.gui.Routepage.prototype.btnRoutePageOk=function (button,ev){
    var name=$('#avi_route_name').val();
    var i;
    //if the name has been changed in the edit box
    //it must be different from any loaded route
    if (name != this.currentName) {
        for (i = 0; i < this.routes.length; i++) {
            if (name == this.routes[i].name) {
                alert("route with name " + name + " already exists");
                return;
            }
        }
    }
    if (this.loadedRoute){
        this.routingData.setNewEditingRoute(this.loadedRoute);
        if (name && name != "" && name != this.loadedRoute.name){
            this.routingData.changeRouteName(name);
        }
    }
    else {
        if (name && name != "") {
            this.routingData.changeRouteName(name);
        }
    }
    this.gui.showPageOrReturn(this.returnpage,'navpage',{showRouting:true});
    log("Route OK clicked");
};

avnav.gui.Routepage.prototype.btnRoutePageCancel=function (button,ev){
    log("Cancel clicked");
    this.gui.showPageOrReturn(this.returnpage,'navpage',{showRouting:true});
};
/**
 * create the page instance
 */
(function(){
    //create an instance of the status page handler
    var page=new avnav.gui.Routepage();
}());

