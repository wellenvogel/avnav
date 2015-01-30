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
    var self=this;
    $(document).on(avnav.nav.NavEvent.EVENT_TYPE, function(ev,evdata){
        self.navEvent(evdata);
    });
};
avnav.inherits(avnav.gui.Routepage,avnav.gui.Page);

avnav.gui.Routepage.prototype.localInit=function(){

};
avnav.gui.Routepage.prototype.showPage=function(options) {
    if (!this.gui) return;
    this.fillData(true);
};

avnav.gui.Routepage.prototype.fillData=function(initial){


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

