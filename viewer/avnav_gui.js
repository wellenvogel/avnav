/**
 * Created by Andreas on 27.04.2014.
 */

goog.provide('avnav.Gui');


/**
 *
 * @param properties
 * @constructor
 */
avnav.Gui=function(properties,navobject){
    this.properties=properties;
    this.navobject=navobject;
    this.page='mainpage';
}


/****************************************
 * the buttons
 */

avnav.Gui.prototype.btnShowHelp=function (button,ev){
    log("ShowHelp clicked");
}

avnav.Gui.prototype.btnShowStatus=function (button,ev){
    log("ShowStatus clicked");
    this.showPage('statuspage');
}
avnav.Gui.prototype.btnStatusCancel=function (button,ev){
    log("StatusCancel clicked");
    this.showPage('mainpage');
}

/**
 * init the buttons (i.e. assign listeners and add the icons)
 * each button click will call a btn<ButtonName> method at this gui object
 * ButtonName is the id of the button minus the leading avb_
 */
avnav.Gui.prototype.initButtons=function(){
    var gui=this;
    $('.avn_button').each(function (i, e) {
        $(e).html('<span class="avn_button_icon"></span>');
        var id = $(e).attr('id');
        if (id) {
            id = id.replace(/^avb_/, '');
            $(e).click(function (b) {
                var f=avnav.Gui.prototype['btn'+id];
                f.call(gui,this,b);
                log("clicked " + id + "at " + b);
                return false;
            });
        }
    });

}

avnav.Gui.prototype.showPage=function(name){
    if (! name) return false;
    if (name == this.page) return false;
    $('.avn_page').hide();
    $('#avi_'+name).show();
    var oldname=this.page;
    this.page=name;
    log("trigger page event");
    $(document).trigger(avnav.Gui.PAGE_EVENT,{
        gui:this,
        oldpage:oldname,
        newpage:name
    });
}


/**
 * Event type for the PageEvent
 * @const
 * @type {string}
 */
avnav.Gui.PAGE_EVENT='changepage';