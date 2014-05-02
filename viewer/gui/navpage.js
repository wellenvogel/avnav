/**
 * Created by andreas on 02.05.14.
 */
goog.provide('avnav.gui.Navpage');
goog.require('avnav.gui.Handler');
goog.require('avnav.gui.Page');

/**
 *
 * @constructor
 */
avnav.gui.Navpage=function(){
    goog.base(this,'navpage');
};
goog.inherits(avnav.gui.Navpage,avnav.gui.Page);


avnav.gui.Navpage.prototype.showPage=function(){
    if (!this.gui) return;


};


avnav.gui.Navpage.prototype.hidePage=function(){

};

//-------------------------- Buttons ----------------------------------------

avnav.gui.Navpage.prototype.btnZoomIn=function (button,ev){
    log("ZoomIn clicked");
};

avnav.gui.Navpage.prototype.btnZoomOut=function (button,ev){
    log("ZoomOut clicked");
};
avnav.gui.Navpage.prototype.btnLockPos=function (button,ev){
    log("LockPos clicked");
};
avnav.gui.Navpage.prototype.btnLockMarker=function (button,ev){
    log("LockMarker clicked");
};
avnav.gui.Navpage.prototype.btnCancelNav=function (button,ev){
    log("CancelNav clicked");
    this.gui.showPage('mainpage');
};

/**
 * create the page instance
 */
(function(){
    //create an instance of the status page handler
    var page=new avnav.gui.Navpage();
}());

