/**
 * Created by andreas on 02.05.14.
 */
goog.provide('avnav.gui.Mainpage');
goog.require('avnav.gui.Handler');
goog.require('avnav.gui.Page');
goog.require('goog.object');

/**
 *
 * @constructor
 */
avnav.gui.Mainpage=function(){
    goog.base(this,'mainpage');
};
goog.inherits(avnav.gui.Mainpage,avnav.gui.Page);


avnav.gui.Mainpage.prototype.showPage=function(options){
    if (!this.gui) return;
    var page=this;
    var url=this.gui.properties.getProperties().navUrl+"?request=listCharts";
    $.ajax({
        url: url,
        dataType: 'json',
        cache: false,
        error: function(ev){
            alert("unable to read chart list: "+ev.responseText);
        },
        success: function(data){
            if (data.status != 'OK'){
                alert("reading chartlist failed: "+data.info);
                return;
            }
            var div=page.getDiv();
            var entryTemplate=div.find('#avi_mainpage_default_entry:first').clone();
            div.find('#avi_mainpage_selections div').remove();

            for (var e in data.data){
                var chartEntry=data.data[e];
                var domEntry=entryTemplate.clone();
                //domEntry.attr('href',"javascript:handleNavPage('"+chartEntry.url+"','"+chartEntry.charturl+"')");
                domEntry.on('click',
                    {
                        entry: goog.object.clone(chartEntry),
                        page:page
                    },
                    function(ev){
                        page.showNavpage(ev.data.entry);
                    });
                var ehtml='<img src="';
                if (chartEntry.icon) ehtml+=chartEntry.icon;
                else ehtml+=entryTemplate.find('img').attr('src');
                ehtml+='"/>'+chartEntry.name;
                domEntry.html(ehtml);
                div.find('#avi_mainpage_selections').append(domEntry);
            }
        }

    });

};

/**
 * the click handler for the charts
 * @param entry - the chart entry
 */
avnav.gui.Mainpage.prototype.showNavpage=function(entry){
    log("activating navpage with url "+entry.url);
    this.gui.showPage('navpage',{url:entry.url,charturl:entry.charturl});

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
avnav.gui.Mainpage.prototype.btnShowSettings=function (button,ev){
    log("ShowSettings clicked");
    this.gui.showPage('settingspage');
};
/**
 * create the page instance
 */
(function(){
    //create an instance of the status page handler
    var page=new avnav.gui.Mainpage();
}());

