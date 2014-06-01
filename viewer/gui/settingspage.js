/**
 * Created by Andreas on 01.06.2014.
 */
goog.provide('avnav.gui.Settingspage');
goog.require('avnav.gui.Handler');
goog.require('avnav.gui.Page');

/**
 *
 * @constructor
 */
avnav.gui.Settingspage=function(){
    goog.base(this,'settingspage');
};
goog.inherits(avnav.gui.Settingspage,avnav.gui.Page);



avnav.gui.Settingspage.prototype.showPage=function(options){
    if (!this.gui) return;
};


avnav.gui.Settingspage.prototype.hidePage=function(){

};




//-------------------------- Buttons ----------------------------------------
/**
 * cancel settings page (go back to main)
 * @private
 */
avnav.gui.Settingspage.prototype.btnSettingsCancel=function(button,ev){
    log("SettingsCancel clicked");
    this.gui.showPage('mainpage');
};

/**
 * activate settings and go back to main
 * @private
 */
avnav.gui.Settingspage.prototype.btnSettingsOK=function(button,ev){
    log("SettingsOK clicked");
    this.gui.showPage('mainpage');
};

(function(){
    //create an instance of the status page handler
    var page=new avnav.gui.Settingspage();
}());


