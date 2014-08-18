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

};
avnav.inherits(avnav.gui.Gpspage,avnav.gui.Page);



avnav.gui.Gpspage.prototype.showPage=function(options){
    if (!this.gui) return;

};


avnav.gui.Gpspage.prototype.hidePage=function(){

};


//-------------------------- Buttons ----------------------------------------
/**
 * cancel gps page (go back to main)
 * @private
 */
avnav.gui.Gpspage.prototype.btnGpsCancel=function(button,ev){
    log("GpsCancel clicked");
    this.gui.showPage('mainpage');
};

(function(){
    //create an instance of the status page handler
    var page=new avnav.gui.Gpspage();
}());


