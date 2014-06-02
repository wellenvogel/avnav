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


avnav.gui.Settingspage.prototype.localInit=function(){
    var self=this;
    $('.avn_setting').each(function(idx,el){
        var name=$(el).attr('avn_name');
        self.createSettingHtml(self.gui.properties.getDescriptionByName(name),el);
    });
};
/**
 * create the html for a settings item
 * @private
 * @param {avnav.util.Property} descr
 * @param el
 */
avnav.gui.Settingspage.prototype.createSettingHtml=function(descr,el){
    if (!(descr instanceof avnav.util.Property)) return;
    var html='<label>'+descr.label+'</label>';
    if (descr.type == avnav.util.PropertyType.CHECKBOX){
        html+='<input type="checkbox" class="avn_settings_checkbox" avn_name="'+name+'"></input>';
    }
    $(el).html(html);
};

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


