/**
 * Created by Andreas on 27.04.2014.
 */

goog.provide('avnav.gui.Handler');


/**
 *
 * @param properties
 * @param navobject
 * @constructor
 */
avnav.gui.Handler=function(properties,navobject){
    this.properties=properties;
    this.navobject=navobject;
    this.map=null;
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
    $(document).trigger(avnav.gui.Handler.PAGE_EVENT,{
        gui:this,
        navobject:this.navobject,
        oldpage:oldname,
        newpage:name,
        options:options
    });
};


/**
 * Event type for the PageEvent
 * @const
 * @type {string}
 */
avnav.gui.Handler.PAGE_EVENT='changepage';