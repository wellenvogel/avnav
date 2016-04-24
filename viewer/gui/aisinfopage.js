/**
 * Created by andreas on 02.05.14.
 */
avnav.provide('avnav.gui.AisInfoPage');




/**
 *
 * @constructor
 */
avnav.gui.AisInfoPage=function(){
    avnav.gui.Page.call(this,'aisinfopage');
    /**
     * @private
     * @type {avnav.nav.AisData}
     */
    this.aishandler=null;

    /**
     * @private
     * @type {undefined}
     */
    this.mmsi=undefined;

    /**
     * private
     * @type {number}
     */
    this.showTime=(new Date()).getTime();
    var self=this;
    $(document).on(avnav.nav.NavEvent.EVENT_TYPE, function(ev,evdata){
        self.navEvent(evdata);
    });
};
avnav.inherits(avnav.gui.AisInfoPage,avnav.gui.Page);

avnav.gui.AisInfoPage.prototype.localInit=function(){
    this.aishandler=this.navobject.getAisData();
    var self=this;
    this.selectOnPage('.avn_left_panel').on('click',function(){
        self.goBack();
    });
};
avnav.gui.AisInfoPage.prototype.showPage=function(options) {
    if (!this.gui) return;
    this.mmsi=options.mmsi;
    if (this.mmsi === undefined) {
        var current=this.aishandler.getNearestAisTarget();
        if (current) this.mmsi=current.mmsi;
    }
    this.fillData(true);
    this.showTime=(new Date()).getTime();
};

avnav.gui.AisInfoPage.prototype.getCurrentTarget=function(){
    return this.aishandler.getAisByMmsi(this.mmsi);
};
avnav.gui.AisInfoPage.prototype.fillData=function(initial){
    var currentObject=this.getCurrentTarget();
    if (! this.aishandler || currentObject === undefined){
        this.gui.showPageOrReturn(this.returnpage,'navpage');
        return;
    }
    var self=this;
    $("#avi_ais_infopage_inner").show();
    $("#avi_ais_infopage_inner .avn_ais_data").each(function(idx,el){
        var name=$(this).attr('data-name');
        if (! name) return;
        var val=self.aishandler.formatAisValue(name,currentObject);
        if (name == "aisCpa"){
            if (currentObject.warning){
                $(this).addClass('avn_ais_warning');
            }
            else{
                $(this).remove('avn_ais_warning');
            }
        }
        $(this).text(val);
    });


};


avnav.gui.AisInfoPage.prototype.hidePage=function(){

};
/**
 *
 * @param {avnav.nav.NavEvent} ev
 */
avnav.gui.AisInfoPage.prototype.navEvent=function(ev){
    if (! this.visible) return;
    if (ev.type==avnav.nav.NavEventType.AIS){
        this.fillData(false);
    }
};
avnav.gui.AisInfoPage.prototype.goBack=function(){
    this.btnAisInfoCancel();
};
//-------------------------- Buttons ----------------------------------------

avnav.gui.AisInfoPage.prototype.btnAisInfoNearest=function (button,ev){
    this.aishandler.setTrackedTarget(0);
    var pos=this.aishandler.getAisPositionByMmsi(this.aishandler.getTrackedTarget());
    if (pos)this.gui.map.setCenter(pos);
    this.gui.showPage('navpage');
    log("Nearest clicked");
};

avnav.gui.AisInfoPage.prototype.btnAisInfoCancel=function (button,ev){
    log("Cancel clicked");
    this.gui.showPageOrReturn(this.returnpage,'navpage');
};
avnav.gui.AisInfoPage.prototype.btnAisInfoList=function (button,ev){
    log("List clicked");
    this.aishandler.setTrackedTarget(this.mmsi);
    this.gui.showPage('aispage',{returnpage:this.returnpage});
};
avnav.gui.AisInfoPage.prototype.btnAisInfoLocate=function (button,ev){
    log("Locate clicked");
    if (this.mmsi === undefined) return;
    var pos=this.aishandler.getAisPositionByMmsi(this.mmsi);
    if (pos)this.gui.map.setCenter(pos);
    this.gui.map.setGpsLock(false);
    this.gui.showPage('navpage');
};
/**
 * create the page instance
 */
(function(){
    //create an instance of the status page handler
    var page=new avnav.gui.AisInfoPage();
}());

