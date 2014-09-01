/**
 * Created by Andreas on 27.04.2014.
 */

avnav.provide('avnav.gui.Handler');
avnav.provide('avnav.gui.PageEvent');
/**
 * the page change event
 * @param {avnav.gui.Handler} gui
 * @param {avnav.nav.NavObject} navobject
 * @param {string} oldpage
 * @param {string} newpage
 * @param {object} opt_options
 * @constructor
 * @extends {
 */
avnav.gui.PageEvent=function(gui,navobject,oldpage,newpage,opt_options){
    this.gui=gui;
    this.navobject=navobject;
    this.oldpage=oldpage;
    this.newpage=newpage;
    this.options=opt_options;
};
/**
 * the type for the page event
 * @type {string}
 * @const
 */
avnav.gui.PageEvent.EVENT_TYPE='cangepage';


/**
 *
 * @param {avnav.util.PropertyHandler} properties
 * @param {avnav.nav.NavObject} navobject
 * @param {ol.Map} map
 * @constructor
 */
avnav.gui.Handler=function(properties,navobject,map){
    /** {avnav.util.PropertyHandler} */
    this.properties=properties;
    /** {avnav.nav.NavObject} */
    this.navobject=navobject;
    /** {avnav.map.MapHolder} */
    this.map=map;
};
/**
 * return to a page or show a new one if returnpage is not set
 * set the returning flag in options if we return
 * @param returnpage
 * @param page
 * @param opt_options
 * @returns {boolean|*}
 */
avnav.gui.Handler.prototype.showPageOrReturn=function(returnpage,page,opt_options){
    var spage=page;
    if (returnpage !== undefined){
        if (! opt_options) opt_options={};
        opt_options.returning=true;
        spage=returnpage;
    }
    return this.showPage(spage,opt_options);
};
/**
 * show a certain page
 * @param {String} name
 * @param {Object} options options to be send as options with the event
 * @returns {boolean}
 */

avnav.gui.Handler.prototype.showPage=function(name,options){
    if (! name) return false;
    if (name == this.page) return false;
    $('.avn_page').hide();
    $('#avi_'+name).show();
    var oldname=this.page;
    this.page=name;
    log("trigger page event");
    $(document).trigger(avnav.gui.PageEvent.EVENT_TYPE, new avnav.gui.PageEvent(
        this,
        this.navobject,
        oldname,
        name,
        options
    ));

};
/**
 * check whether we are on mobile
 * @returns {boolean}
 */
avnav.gui.Handler.prototype.isMobileBrowser=function(){
    //return true;
    return ( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) )||
        this.properties.getProperties().forceMobile;
    };


