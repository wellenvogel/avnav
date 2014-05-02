/**
 * Created by andreas on 02.05.14.
 */

goog.provide('avnav.gui.Page');
goog.require('avnav.gui.Handler');

/**
 * a base class for all GUI pages
 * @constructor
 */
avnav.gui.Page=function(name){
    this.isInitialized=false;
    this.gui=null;
    this.navobject=null;
    this.name=name;
    this.visible=false;
    var myself=this;
    $(document).on(avnav.gui.Handler.PAGE_EVENT, function(ev,evdata){
        if (evdata.oldpage != myself.name && evdata.newpage != myself.name){
            return;
        }
        myself.handlePage(evdata);
    });
};

/**
 * get the page div (jQuery object)
 */
avnav.gui.Page.prototype.getDiv=function(){
    var div=$('#avi_'+this.name);
    return div;
};

/**
 * check if the page is visible
 */
avnav.gui.Page.prototype.isVisible=function(){
    var rt=this.getDiv().is(':visible');
    return rt;
};

/**
 * event handler that is called by the page event
 * @param evdata
 * @private
 */
avnav.gui.Page.prototype.handlePage=function(evdata){
    if (! this.isInitialized){
        this.gui=evdata.gui;
        this.navobject=evdata.navobject;
        this.isInitialized=true;
        this.initButtons();
    }
    if (this.visible != this.isVisible()){
        //visibility changed
        this.visible=this.isVisible();
        if (this.visible){
            this.showPage();
        }
        else {
            this.hidePage();
        }
    }
};

/**
 * init the buttons (i.e. assign listeners and add the icons)
 * each button click will call a btn<ButtonName> method at this gui object
 * ButtonName is the id of the button minus the leading avb_
 * @private
 *
 */
avnav.gui.Page.prototype.initButtons=function(){
    var page=this;
    var div=this.getDiv();
    div.find('.avn_button').each(function (i, e) {
        $(e).html('<span class="avn_button_icon"></span>');
        var id = $(e).attr('id');
        if (id) {
            id = id.replace(/^avb_/, '');
            var proto=Object.getPrototypeOf(page);
            var f=proto['btn'+id];
            if (f) {
                $(e).click(function (b) {
                    f.call(page, this, b);
                    log("clicked " + id + "at " + b);
                    return false;
                });
            }
        }
    });

};

/**
 * function to be overloaded by pages
 */
avnav.gui.Page.prototype.showPage=function(){

};
/**
 * function to be overloaded by pages
 */
avnav.gui.Page.prototype.hidePage=function(){

};
