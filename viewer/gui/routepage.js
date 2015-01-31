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
    $('#routeInfo-'+id).find('.avn_route_listdate').text(this.formatter.formatTime(new Date(routeInfo.time)));
    $('#routeInfo-'+id).find('.avn_route_listinfo').text(routeInfo.name+", "+this.formatter.formatDecimal(routeInfo.length,4,2)+
        " nm, "+routeInfo.numpoints+" points");
    if (routeInfo.server) {
        $('#routeInfo-' + id).find('.avn_route_listrasimage').show();
    }
    else {
        $('#routeInfo-' + id).find('.avn_route_listrasimage').hide();
    }
};
/**
 * add routes to the list
 * @param routeInfos
 */
avnav.gui.Routepage.prototype.addRoutes=function(routeInfos){
    var i,id,curid;
    var self=this;
    id=this.routes.length;
    for (i=0;i<routeInfos.length;i++){
        //skip current route
        if (this.currentName && routeInfos[i].name == this.currentName) continue;
        curid=this.findRouteInfo(routeInfos[i]);
        if (curid >= 0){
            //a second one will always update...
            this.routes[curid]=routeInfos[i];
            this.displayInfo(curid,routeInfos[i]);
            continue;
        }
        this.routes.push(routeInfos[i]);
        $('#avi_route_list_template').clone()
            .attr("routeId",i)
            .attr("id","routeInfo-"+id)
            .attr("routeidx",i)
            .addClass(this.visibleListEntryClass)
            .show()
            .insertAfter('.avn_route_list_entry:last');
        this.displayInfo(id,routeInfos[i]);
        $('#routeInfo-'+id).find('.avn_route_btnDelete').on('click',null,{id:id},function(ev){
            var lid=ev.data.id;
            var name=self.routes[lid].name;
            var ok=confirm("delete route "+name+"?");
            if (ok){
                self.routingData.deleteRoute(name,function(info){
                    alert("failed to delete route "+name+" on server: "+info);
                });
                $('#routeInfo-'+lid).remove();
            }
        });
        $('#routeInfo-'+id).find('.avn_route_btnLoad').on('click',null,{id:id},function(ev){
            var lid=ev.data.id;
            var rtinfo=undefined;
            try {
                rtinfo=self.routes[lid];
            }catch(e){}
            if (rtinfo){
                var name=rtinfo.name;
                self.routingData.fetchRoute(name,!rtinfo.server,
                    function(route){
                        self.routingData.setNewEditingRoute(route);
                        self.gui.showPageOrReturn(this.returnpage,'navpage',{showRouting:true});
                    },
                    function(err){
                        alert("unable to load route "+name+": "+err);
                    }
                );

            }

        });
        id++;
    }
};
avnav.gui.Routepage.prototype.fillData=function(initial){
    this.currentName=undefined;
    if (this.routingData.getCurrentRoute() ) this.currentName=this.routingData.getCurrentRoute().name;
    $('#avi_route_name').val(this.currentName);
    $("."+this.visibleListEntryClass).remove();
    this.routes=[];
    var localRoutes=this.routingData.listRoutesLocal();
    this.addRoutes(localRoutes);
    if (!this.gui.properties.getProperties().connectedMode) return;
    this.routingData.listRoutesServer(
        function(routingInfos,param){
            param.self.addRoutes(routingInfos);
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
    if (name && name !=""){
        this.routingData.changeRouteName(name);
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

