/**
 * Created by andreas on 02.05.14.
 */
avnav.provide('avnav.gui.Aispage');




/**
 *
 * @constructor
 */
avnav.gui.Aispage=function(){
    avnav.gui.Page.call(this,'aispage');
    /**
     * @private
     * @type {avnav.nav.AisData}
     */
    this.aishandler=null;
    var self=this;
    $(document).on(avnav.nav.NavEvent.EVENT_TYPE, function(ev,evdata){
        self.navEvent(evdata);
    });
};
avnav.inherits(avnav.gui.Aispage,avnav.gui.Page);

avnav.gui.Aispage.prototype.localInit=function(){
    this.aishandler=this.navobject.getAisData();
};
avnav.gui.Aispage.prototype.showPage=function(options) {
    if (!this.gui) return;
    this.fillData(true);
};

avnav.gui.Aispage.prototype.fillData=function(initial){
    var domid="#avi_ais_page_inner";
    var formatter=this.aishandler.getAisFormatter();
    var aisList=this.aishandler.getAisData();
    var html='<div class="avn_ais_infotable">';
    html+='<div class="avn_ais avn_ais_headline">';
    for (var p in formatter){
        html+='<div class="avn_aisparam">'+formatter[p].headline+'</div>';
    }
    html+='</div>';
    var hasTracking=this.aishandler.getTrackedTarget();
    for( var aisidx in aisList){
        var ais=aisList[aisidx];
        var addClass='';
        if (ais.warning) addClass='avn_ais_warning';
        else {
            if ((ais.tracking)|| (ais.nearest && ! hasTracking)) addClass='avn_ais_selected';
        }
        html+='<div class="avn_ais '+addClass+' avn_ais_selector" mmsi="'+ais['mmsi']+'">';
        for (var p in formatter){
            html+='<div class="avn_aisparam">'+formatter[p].format(ais)+'</div>';
        }
        html+='</div>';
    }
    html+='</div>';
    $(domid).html(html);
    $(domid+' .avn_ais_selector').click({self:this},function(ev){
        var mmsi=$(this).attr('mmsi');
        ev.data.self.aishandler.setTrackedTarget(mmsi);
        var pos=ev.data.self.aishandler.getAisPositionByMmsi(mmsi);
        if (pos)ev.data.self.gui.map.setCenter(pos);
        ev.data.self.gui.showPageOrReturn(ev.data.self.returnpage,'navpage');
    });
    if (initial){
        var topElement=$(domid+' .avn_ais_selected').position();
        if (! topElement)topElement=$(domid+' .avn_ais_warning').position();
        if (topElement){
            $(domid).scrollTop(topElement.top);
        }
    }

};


avnav.gui.Aispage.prototype.hidePage=function(){

};
/**
 *
 * @param {avnav.nav.NavEvent} ev
 */
avnav.gui.Aispage.prototype.navEvent=function(ev){
    if (! this.visible) return;
    if (ev.type==avnav.nav.NavEventType.AIS){
        this.fillData(false);
    }
};
avnav.gui.Aispage.prototype.goBack=function(){
    this.btnAisCancel();
};
//-------------------------- Buttons ----------------------------------------

avnav.gui.Aispage.prototype.btnAisNearest=function (button,ev){
    this.aishandler.setTrackedTarget(0);
    this.gui.showPageOrReturn(this.returnpage,'navpage');
    log("Nearest clicked");
};

avnav.gui.Aispage.prototype.btnAisCancel=function (button,ev){
    log("Cancel clicked");
    this.gui.showPageOrReturn(this.returnpage,'navpage');
};
/**
 * create the page instance
 */
(function(){
    //create an instance of the status page handler
    var page=new avnav.gui.Aispage();
}());

