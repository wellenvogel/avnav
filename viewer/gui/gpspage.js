/**
 * Created by Andreas on 27.04.2014.
 */
avnav.provide('avnav.gui.Gpspage');



/**
 *
 * @constructor
 */
avnav.gui.Gpspage=function(){
    avnav.gui.Page.call(this,'gpspage');
    /**
     * if set - return to this page on cancel
     * @type {string}
     */
    this.returnpage=undefined;

};
avnav.inherits(avnav.gui.Gpspage,avnav.gui.Page);



avnav.gui.Gpspage.prototype.showPage=function(options){
    if (!this.gui) return;
    if (options && options.return){
        this.returnpage=options.return;
    }
    else {
        this.returnpage=undefined;
    }
    this.computeLayout();
};
avnav.gui.Gpspage.prototype.localInit=function(){
    var self=this;
    $(window).on('resize',function(){
       self.computeLayout();
    });
};


avnav.gui.Gpspage.prototype.hidePage=function(){

};

/**
 * compute the layout for the page
 * we assum n columns of class avn_gpsp_vfield
 * within each solumn we have n boxes of class avn_gpsp_hfield each having
 *   an attr avnfs given the height weight of this field
 * within eacho of such boxes we assume n avn_gpsp_value floating left each
 * having an attr avnrel given a relative with (nearly character units)
 * @private
 */
avnav.gui.Gpspage.prototype.computeLayout=function(){
    var numhfields=0;
    this.getDiv().find('.avn_gpsp_hfield').each(function(i,el){
        numhfields++;
    });
    if (numhfields == 0) return;
    var hfieldw=100/numhfields;
    this.getDiv().find('.avn_gpsp_hfield').each(function(i,el){
        $(el).css('width',hfieldw+"%");
        var vwidth=$(el).width();
        var vheight=$(el).height();
        var numhfields=0;
        var weigthsum=0;
        var vfieldweights=[];
        var vfieldlengths=[];
        $(el).find('.avn_gpsp_vfield').each(function(idx,hel){
            numhfields++;
            vfieldweights[idx]=parseFloat($(hel).attr('avnfs'));
            weigthsum+=vfieldweights[idx];
            var len=0;
            $(hel).find('.avn_gpsp_value').each(function(vidx,vel){
                len+=parseFloat($(vel).attr('avnrel'));
            });
            vfieldlengths[idx]=len;
        });
        $(el).find('.avn_gpsp_vfield').each(function(idx,hel){
            var relheight=vfieldweights[idx]/weigthsum*100;
            $(hel).css('height',relheight+"%");
            var fontbase=relheight*vheight*0.7/100;
            var labelbase=fontbase;
            if ((fontbase * vfieldlengths[idx]) > vwidth ){
                fontbase = vwidth/(vfieldlengths[idx]);
            }
            $(hel).find('.avn_gpsp_value').each(function(vidx,vel){
                $(vel).css('font-size',fontbase+"px");
            });
            $(hel).find('.avn_gpsp_unit').each(function(vidx,vel){
                $(vel).css('font-size',fontbase*0.3+"px");
            });
            $(hel).find('.avn_gpsp_field_label').each(function(vidx,vel){
                $(vel).css('font-size',labelbase*0.2+"px");
            });
        });

    });

};


//-------------------------- Buttons ----------------------------------------
/**
 * cancel gps page (go back to main)
 * @private
 */
avnav.gui.Gpspage.prototype.btnGpsCancel=function(button,ev){
    log("GpsCancel clicked");
    this.gui.showPage(this.returnpage?this.returnpage:'mainpage');
};

(function(){
    //create an instance of the status page handler
    var page=new avnav.gui.Gpspage();
}());


