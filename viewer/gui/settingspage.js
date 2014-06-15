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
    //a collection of all items, key is the name, value a function to get the current value
    this.allItems={};
    /**
     * @private
     * @type {avnav.util.Formatter}
     */
    this.formatter=new avnav.util.Formatter();

    goog.base(this,'settingspage');
};
goog.inherits(avnav.gui.Settingspage,avnav.gui.Page);

/**
 * the local init called from the base class when the page is instantiated
 */
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
    var self=this;
    var numdigits=0;
    var numdecimal=0;
    var value=this.gui.properties.getValue(descr);
    if (descr.type == avnav.util.PropertyType.CHECKBOX){
        var html='<label>'+descr.label;
        html+='<input type="checkbox" class="avn_settings_checkbox" avn_name="'+name+'"';
        if (value) html+="checked";
        html+='></input></label>';
        this.allItems[descr.completeName]= {
            read: function () {
                return $(el).find('input').is(':checked');
            },
            write: function (value) {
                $(el).find('input').prop('checked', value);
            }
        };
    }
    if (descr.type == avnav.util.PropertyType.RANGE){
        var html='<div class=""><div class="avn_slider_label" >'+descr.label+'</div>';
        html+='<div class="avn_slider_label avn_out">'+value+'</div>';
        var range=descr.values;
        numdigits=Math.ceil(Math.log(range[1])/Math.log(10));
        html+='<div class="avn_slider" ><input type="range" min="'+range[0]+'" max="'+range[1]+'" avn_name="'+name+'" value="'+value+'"';
        if (range[2]) {
            html+=' step="'+range[2]+'"';
        }
        if (range[3]){
            numdecimal=range[3];
        }
        html+='/></div>';
        html+='<div class="avn_clear"/>';
        html+='</div>';
        this.allItems[descr.completeName]= {
            read: function () {
                return parseFloat($(el).find('input').val());
            },
            write: function (value) {
                $(el).find('input').val(value).change();
            }
        };
    }
    if (descr.type == avnav.util.PropertyType.COLOR){
        var html='<div class=""><div class="avn_color_label" >'+descr.label+'</div>';
        html+='<div class="avn_color_label avn_out">'+value+'</div>';
        html+='<input type="color" class="avn_color"/>';
        html+='<div class="avn_clear"/>';
        html+='</div>';
        this.allItems[descr.completeName]= {
            read: function () {
                return $(el).find('input').val();
            },
            write: function (value) {
                $(el).find('input').val(value).change();
            }
        };
    }
    $(el).html(html);
    $(el).find('input[type="range"]').rangeslider({
            polyfill: false,
            onSlide: function(pos,val){
                val=self.formatter.formatDecimal(val,numdigits,numdecimal);
                $(el).find('.avn_out').text(val);
            },
            fillClass: 'avn_rangeslider__fill',
            handleClass: 'avn_rangeslider__handle'
        });
    $(el).find('input[type="color"]').each(function(idx,elx){
            if (elx.type === 'text'){
                //fallback if the browser does not support color input
                var cp=new jscolor.color(elx,{
                    hash:true,
                    pickerClosable:true
                });
                cp.fromString(value.replace(/^#/,''));
                $(elx).css('background-color',value);
                self.allItems[descr.completeName].write=function(val){
                    $(el).find('input').val(value).change();
                    $(elx).css('background-color',val);
                    cp.fromString(val.replace(/^#/,''));
                }
            }
    });

};

/**
 * @private
 * read all data and update the elements
 */
avnav.gui.Settingspage.prototype.readData=function(){
    for (var idx in this.allItems){
        var value=this.gui.properties.getValueByName(idx);
        this.allItems[idx].write(value);
    }
};

avnav.gui.Settingspage.prototype.showPage=function(options){
    if (!this.gui) return;
    this.readData();
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
    var txt="";
    for (var idx in this.allItems){
        var val=this.allItems[idx].read();
        this.gui.properties.setValueByName(idx,val);
    }
    this.gui.properties.setUserData({}); //write changes to cookie
    this.gui.properties.updateLayout();  //update the layout based on less
    $(document).trigger(avnav.util.PropertyChangeEvent.EVENT_TYPE,new avnav.util.PropertyChangeEvent(this.gui.properties));
    this.gui.showPage('mainpage');
};

avnav.gui.Settingspage.prototype.btnSettingsDefaults=function(button,ev) {
    log("SettingsDefaults clicked");
    for (var idx in this.allItems) {
        var val = this.gui.properties.getDescriptionByName(idx).defaultv;
        this.allItems[idx].write(val);
    }
};

(function(){
    //create an instance of the status page handler
    var page=new avnav.gui.Settingspage();
}());


