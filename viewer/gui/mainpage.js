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
    var page=this;
    var url=this.gui.properties.navUrl+"?request=listCharts";
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

            for (e in data.data){
                var chartEntry=data.data[e];
                var domEntry=entryTemplate.clone();
                //domEntry.attr('href',"javascript:handleNavPage('"+chartEntry.url+"','"+chartEntry.charturl+"')");
                domEntry.on('click',
                    {
                        url: chartEntry.url,
                        charturl: chartEntry.charturl,
                        page:page
                    },
                    page.showNavpage);
                var ehtml='<img src="';
                if (chartEntry.icon) ehmtl+=chartEntry.icon;
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
 * @param evt - the event object
 * !!does not have the this pointer set when called
 */
avnav.gui.Mainpage.prototype.showNavpage=function(evt){
    log("activating navpage with url "+evt.data.url);
    evt.data.page.gui.showPage('navpage',{url:evt.data.url,charturl:evt.data.charturl});

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

