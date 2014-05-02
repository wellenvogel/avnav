/**
 * Created by andreas on 02.05.14.
 */
goog.provide('avnav.gui.Mainpage');
goog.require('avnav.gui.Handler');
goog.require('avnav.gui.Page');

/**
 *
 * @constructor
 */
avnav.gui.Mainpage=function(){
    goog.base(this,'mainpage');
};
goog.inherits(avnav.gui.Mainpage,avnav.gui.Page);


avnav.gui.Mainpage.prototype.showPage=function(){
    if (!this.gui) return;
    //TODO:fetch list of items
};
avnav.gui.Mainpage.prototype.hidePage=function(){

};

//-------------------------- Buttons ----------------------------------------

avnav.gui.Mainpage.prototype.btnShowHelp=function (button,ev){
    log("ShowHelp clicked");
};

avnav.gui.Mainpage.prototype.btnShowStatus=function (button,ev){
    log("ShowStatus clicked");
    this.gui.showPage('statuspage');
};
/**
 * create the page instance
 */
(function(){
    //create an instance of the status page handler
    var page=new avnav.gui.Mainpage();
}());

