/**
 * Created by andreas on 02.05.14.
 */

goog.provide('avnav.gui.Page');
goog.require('avnav.gui.Handler');
goog.require('goog.asserts');

/**
 * a base class for all GUI pages
 * @constructor
 */
avnav.gui.Page=function(name){
    this.isInitialized=false;
    /** @type{avnav.gui.Handler} */
    this.gui=null;
    /** @type{avnav.nav.NavObject} */
    this.navobject=null;
    this.name=name;
    this.visible=false;
    var myself=this;
    $(document).on(avnav.gui.PageEvent.EVENT_TYPE, function(ev,evdata){
        goog.asserts.assert(evdata instanceof avnav.gui.PageEvent,"invalid event parameter");
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
 * @param {avnav.gui.PageEvent} evdata
 * @private
 */
avnav.gui.Page.prototype.handlePage=function(evdata){
    if (! this.isInitialized){
        this.gui=evdata.gui;
        this.navobject=evdata.navobject;
        this.isInitialized=true;
        this.initButtons();
        this.localInit();
    }
    if (this.visible != this.isVisible()){
        //visibility changed
        this.visible=this.isVisible();
        if (this.visible){
            this.showPage(evdata.options);
        }
        else {
            this.hidePage();
        }
    }
};

/**
 * init function called after receiving the first event
 * intended to be overloaded by subclasses
 */
avnav.gui.Page.prototype.localInit=function(){

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

/**
 * handle the status display of a toggle button
 * @param id
 * @param onoff
 * @param onClass
 */
avnav.gui.Page.prototype.handleToggleButton=function(id,onoff,onClass){
    var oc=onClass || "avn_buttonActive";
    if (onoff){
        $(id).removeClass("avn_buttonActive");
        $(id).removeClass("avn_buttonActiveError");
        $(id).addClass(oc);
        $(id).removeClass("avn_buttonInactive");
    }
    else {
        $(id).removeClass("avn_buttonActive");
        $(id).removeClass("avn_buttonActiveError");
        $(id).addClass("avn_buttonInactive");
    }
};

/**
 * show or hide an panel and resize some related
 * @param id - #id or .class of the panel
 * @param show - true for show, fals for hide
 * @param mainid #id or .class for a panel - if the panel to show has one of the classes
 *               anv_left|right|top|bottom it is resized...
 * @returns {boolean} - true when mainid something changed
 */
avnav.gui.Page.prototype.showHideAdditionalPanel=function(id,show,mainid){
    var mainLocation=null;
    if ($(id).hasClass('avn_bottom')) mainLocation='bottom';
    if ($(id).hasClass('avn_left')) mainLocation='left';
    if ($(id).hasClass('avn_right')) mainLocation='right';
    if ($(id).hasClass('avn_top')) mainLocation='top';
    var npos=null;
    var oval=0;
    if (mainLocation) oval=parseInt($(mainid).css(mainLocation).replace(/px/,''));

    if (show){
        if ($(id).is(':visible')) return false;
        $(id).show();
        if (! mainLocation) return false;
        var elheight=$(id).height();
        var elwidth=$(id).width();
        if (mainLocation == 'bottom' || mainLocation=='top') npos=oval+elheight;
        if (mainLocation == 'left' || mainLocation=='right') npos=oval+elwidth;
    }
    else {
        if (!$(id).is(':visible')) return false;
        var elheight=$(id).height();
        var elwidth=$(id).width();
        $(id).hide();
        if (! mainLocation) return false;
        if (mainLocation == 'bottom' || mainLocation=='top') npos=oval-elheight;
        if (mainLocation == 'left' || mainLocation=='right') npos=oval-elwidth;
    }
    if (npos != null){
        $(mainid).css(mainLocation,npos+"px");
    }
    //additional top/bottom panels should only fill the same width as main
    $('.avn_top:visible').css('left',$(mainid).css('left'));
    $('.avn_bottom:visible').css('left',$(mainid).css('left'));
    $('.avn_top:visible').css('right',$(mainid).css('right'));
    $('.avn_bottom:visible').css('right',$(mainid).css('right'));
    return true;
};
