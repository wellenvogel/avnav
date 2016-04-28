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
avnav.inherits(avnav.gui.Aispage,avnav.gui.Page);

avnav.gui.Aispage.prototype.localInit=function(){
    this.aishandler=this.navobject.getAisHandler();
    $('#avi_ais_page_inner').on('scroll',function(){
        $('.avn_ais_headline_elem').css('top',$('#avi_ais_page_inner').scrollTop()-2);
    });
};
avnav.gui.Aispage.prototype.showPage=function(options) {
    if (!this.gui) return;
    this.fillData(true);
    this.showTime=(new Date()).getTime();
};

avnav.gui.Aispage.prototype.fillData=function(initial){
    if (! initial) return;
    var domid="#avi_ais_page_inner";
    var formatter=this.aishandler.getAisFormatter();
    var aisList=this.aishandler.getAisData();
    var html='<table class="avn_ais_infotable">';
    html+='<thead class="avn_ais avn_ais_headline"><tr>';
    for (var p in formatter){
        html+='<th class="avn_aisparam avn_ais_headline_elem">'+formatter[p].headline+'</th>';
    }
    html+='</tr></thead><tbody>';
    var hasTracking=this.aishandler.getTrackedTarget();
    for( var aisidx in aisList){
        var ais=aisList[aisidx];
        var addClass='';
        if (ais.warning) addClass='avn_ais_warning';
        else {
            if (hasTracking){
                if (ais.tracking) addClass='avn_ais_selected';
                else {
                    if (ais.nearest) addClass='avn_ais_info_first';
                    else addClass='avn_ais_info_normal';
                }
            }
            else {
                if (ais.nearest) addClass='avn_ais_info_first';
                else addClass='avn_ais_info_normal';
            }
        }
        html+='<tr class="avn_ais '+addClass+' avn_ais_selector" mmsi="'+ais['mmsi']+'">';
        for (var p in formatter){
            html+='<td class="avn_aisparam">'+formatter[p].format(ais)+'</td>';
        }
        html+='</tr>';
    }
    html+='</tbody></table>';
    $(domid).html(html);
    $(domid+' .avn_ais_selector').click({self:this},function(ev){
        var self=ev.data.self;
        var clickDelay=self.gui.properties.getProperties().aisBrowserWorkaround;
        if (clickDelay> 0 ){
            if ((new Date()).getTime() < (self.showTime+clickDelay)){
                log("ais page click delay");
                return false;
            }
        }
        var mmsi=$(this).attr('mmsi');
        self.aishandler.setTrackedTarget(mmsi);
        self.gui.showPage('aisinfopage',{mmsi:mmsi,skipHistory: true});
    });
    if (initial){
        $(domid).scrollTop(0);
        var topDom=$(domid+' .avn_ais_selected');
        var topElement;
        if (! topDom)topDom=$(domid+' .avn_ais_warning');
        if (topDom) topElement=$(topDom).position();
        if (topElement){
            var scrollTop=topElement.top - $('.avn_ais_headline').height();
            var currentTop=$(domid).scrollTop();
            log("aisPage scroll: elTop:"+topElement.top+",current="+currentTop+", scroll="+scrollTop+", mmsi="+$(topDom).attr('mmsi'));
            $(domid).scrollTop(scrollTop);
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

//-------------------------- Buttons ----------------------------------------

avnav.gui.Aispage.prototype.btnAisNearest=function (button,ev){
    this.aishandler.setTrackedTarget(0);
    this.returnToLast();
    log("Nearest clicked");
};

/**
 * create the page instance
 */
(function(){
    //create an instance of the status page handler
    var page=new avnav.gui.Aispage();
}());

