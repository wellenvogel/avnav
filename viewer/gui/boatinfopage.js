/**
 * Created by andreas on 02.05.14.
 */
avnav.provide('avnav.gui.BoatInfoPage');




/**
 *
 * @constructor
 */
avnav.gui.BoatInfoPage=function(){
    avnav.gui.Page.call(this,'boatinfopage',
        {
            eventlist:[avnav.nav.NavEvent.EVENT_TYPE],
            returnOnClick: true
        }
    );
    /**
     * private
     * @type {string}
     */
    this.statusItem='.avn_Status';
    this.lastStatus=undefined;
    this.lastCourse=undefined;

};
avnav.inherits(avnav.gui.BoatInfoPage,avnav.gui.Page);

avnav.gui.BoatInfoPage.prototype.localInit=function(){
};
avnav.gui.BoatInfoPage.prototype.showPage=function(options) {
    if (!this.gui) return;
    this.lastStatus=undefined;
    this.lastCourse=undefined;
    this.fillData(true);
};

avnav.gui.BoatInfoPage.prototype.fillData=function(initial){
    var gpsStatus=this.gui.navobject.getRawData(avnav.nav.NavEventType.GPS).valid;
    var newImage=gpsStatus?this.gui.properties.getProperties().statusOkImage:
        this.gui.properties.getProperties().statusErrorImage;
    if (newImage != this.lastStatus) {
        this.selectOnPage('.avn_status_image').attr('src', newImage);
        this.lastStatus = newImage;
    }
    var course=this.gui.navobject.getValue('gpsCourse')||"0";
    if (course != this.lastCourse){
        this.selectOnPage('.avn_course_image').css('transform','rotate('+course+'deg)');
        this.lastCourse=course;
    }
    this.selectOnPage(".avn_infopage_inner").show();
};


avnav.gui.BoatInfoPage.prototype.hidePage=function(){

};
//-------------------------- Buttons ----------------------------------------

avnav.gui.BoatInfoPage.prototype.btnBoatInfoGps=function (button,ev){
    log("gps clicked");
    this.gui.showPage('gpspage',{skipHistory:true});
};
avnav.gui.BoatInfoPage.prototype.btnBoatInfoLocate=function (button,ev){
    log("Locate clicked");
    var gps=this.navobject.getRawData(avnav.nav.NavEventType.GPS);
    if (gps.valid) this.gui.map.setCenter(gps);
    this.returnToLast();
};
/**
 * create the page instance
 */
(function(){
    //create an instance of the status page handler
    var page=new avnav.gui.BoatInfoPage();
}());

