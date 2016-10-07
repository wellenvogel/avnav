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
    this.MAXUPLOADSIZE=100000;
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
     * @type {Array:avnav.nav.navdata.WayPoint}
     */
    this.waypoints=[];

    /**
     * if we loaded a route we will keep it here and set this as editing
     * when we leave
     * @type {avnav.nav.Route}
     */
    this.currentRoute=undefined;
    /**
     * the name of the route when we loaded the page
     * @type {undefined}
     */
    this.initialName=undefined;

    var self=this;
    $(document).on(avnav.nav.NavEvent.EVENT_TYPE, function(ev,evdata){
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
    this.routingData=this.gui.navobject.getRoutingHandler();
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


avnav.gui.Routepage.prototype.displayInfo=function(id,info){
    $('#routeInfo-'+id).find('.avn_route_listname').text(info.name);
    $('#routeInfo-'+id).find('.avn_route_listinfo').text("todo");
};


avnav.gui.Routepage.prototype._updateDisplay=function(){
    var self=this;
    $('#avi_route_name').val("");
    $("."+this.visibleListEntryClass).remove();
    if (! this.currentRoute) return;
    $('#avi_route_name').val(this.currentRoute.name);
    for (id=0;id<this.currentRoute.points.length;id++){
        var wp=this.currentRoute.getPointAtIndex(id);
        $('#avi_route_list_template').clone()
            .attr("id","routeInfo-"+id)
            .attr("wpidx",id)
            .addClass(this.visibleListEntryClass)
            .show()
            .insertAfter('#avi_routepage .avn_list_entry:last');
        this.displayInfo(id,wp);
        $('#routeInfo-' + id).find('.avn_route_btnDelete').on('click', null, {id: id}, function (ev) {
            ev.preventDefault();
            var lid = ev.data.id;
            if (!self.currentRoute) return;
            self.currentRoute.deletePoint(idx);
            self._updateDisplay();
        });

        $('#routeInfo-'+id).on('click',null,{id:id},function(ev){
            ev.preventDefault();
            var lid=ev.data.id;
            if (! self.currentRoute) return;
            //TODO: edit wp
            var wp=self.currentRoute.getPointAtIndex(lid);
            alert("edit wp "+wp.name);
        });
    }
};

avnav.gui.Routepage.prototype.fillData=function(initial){
    if (initial) {
        this.currentRoute = this.routingData.getEditingRoute();
        this.initialName = this.currentRoute.name;
    }
    this._updateDisplay();
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
avnav.gui.Routepage.prototype.androidEvent=function(key,id){
    this.fillData(false);
};
avnav.gui.Routepage.prototype.goBack=function(){
    this.btnRoutePageCancel();
};

avnav.gui.Routepage.prototype.storeRoute=function(){
    if (! this.currentRoute) return;
    this.routingData.saveRoute(this.currentRoute);
};
//-------------------------- Buttons ----------------------------------------

avnav.gui.Routepage.prototype.btnRoutePageOk=function (button,ev){
    var name=$('#avi_route_edit_name').val();
    if (! this.currentRoute) this.gui.returnToLast();
    this.currentRoute.name=name;
    var self=this;
    if (this.currentRoute.name != this.initialName ){
        //check if a route with this name already exists
        this.routingData.fetchRoute(this.currentRoute.name,false,
        function(data){
            avnav.util.Overlay.Toast("route with name "+info.name+" already exists",5000);
        },
        function(er){
            self.storeRoute();
            self.gui.returnToLast();
        });
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
            this.routingData.fetchRoute(item.name,false,
                function(route){
                    self.routingData.setNewEditingRoute(route);
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

