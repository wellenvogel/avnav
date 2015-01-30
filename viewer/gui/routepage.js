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

avnav.gui.Routepage.prototype.fillData=function(initial){
    var name="";
    if (this.routingData.getCurrentRoute() ) name=this.routingData.getCurrentRoute().name;
    $('#avi_route_name').val(name);
    $("."+this.visibleListEntryClass).remove();
    var i=0;
    for (i=0;i<20;i++){
        $('#avi_route_list_template').clone()
        .attr("routeId",i)
        .attr("id","id"+i)
        .addClass(this.visibleListEntryClass)
        .show()
        .insertAfter('.avn_route_list_entry:last');
    }

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

