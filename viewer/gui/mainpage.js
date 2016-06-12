/**
 * Created by andreas on 02.05.14.
 */
avnav.provide('avnav.gui.Mainpage');




/**
 *
 * @constructor
 */
avnav.gui.Mainpage=function(){
    avnav.gui.Page.call(this,'mainpage');
    var self=this;
    this.lastNmeaStatus=null;
    this.lastAisStatus=null;
    $(document).on(avnav.nav.NavEvent.EVENT_TYPE, function(ev,evdata){
        self.navEvent(evdata);
    });
    $(window).on('resize', function () {
        self.layout();
    });
    $(document).on(avnav.util.PropertyChangeEvent.EVENT_TYPE,function(){
        self.layout();
        self.fillList();
    });
};
avnav.inherits(avnav.gui.Mainpage,avnav.gui.Page);

avnav.gui.Mainpage.prototype.changeDim=function(newDim){
    this.gui.properties.setValueByName('style.nightMode',newDim);
    this.gui.properties.saveUserData();
    this.gui.properties.updateLayout();
    $(document).trigger(avnav.util.PropertyChangeEvent.EVENT_TYPE,new avnav.util.PropertyChangeEvent(this.gui.properties));
};

avnav.gui.Mainpage.prototype.localInit=function(){

};
avnav.gui.Mainpage.prototype.fillList=function(){
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
                domEntry.on('click',
                    {
                        entry: avnav.clone(chartEntry),
                        page:page
                    },
                    function(ev){
                        page.showNavpage(ev.data.entry);
                    });
                domEntry.find('.avn_mainName').text(chartEntry.name);
                if (chartEntry.icon) domEntry.find('.avn_mainIcon').attr('src',chartEntry.icon);
                div.find('#avi_mainpage_selections').append(domEntry);
            }
            page.layout();


        }

    });
};
avnav.gui.Mainpage.prototype.showPage=function(options){
    if (!this.gui) return;
    var ncon=this.gui.properties.getProperties().connectedMode;
    this.handleToggleButton('.avb_Connected',ncon);
    ncon=this.gui.properties.getProperties().style.nightMode;
    var nightDim=this.gui.properties.getProperties().nightFade;
    if (ncon != 100 && ncon != nightDim){
        //could happen if we return from settings page
        this.changeDim(nightDim);
    }
    this.handleToggleButton('.avb_Night',ncon!=100);
    this.fillList();
    if (avnav.android || this.gui.properties.getProperties().readOnlyServer){
        this.selectOnPage('.avb_Connected').hide();
    }

};

/**
 * the click handler for the charts
 * @param entry - the chart entry
 */
avnav.gui.Mainpage.prototype.showNavpage=function(entry){
    avnav.log("activating navpage with url "+entry.url);
    this.gui.showPage('navpage',{url:entry.url,charturl:entry.charturl});

};
avnav.gui.Mainpage.prototype.hidePage=function(){

};
avnav.gui.Mainpage.prototype.goBack=function(){
    avnav.android.goBack();
};

avnav.gui.Mainpage.prototype.setImageColor=function(imageId,color){
    if (color == "red") $(imageId).attr('src', this.gui.properties.getProperties().statusErrorImage);
    if (color == "green") $(imageId).attr('src', this.gui.properties.getProperties().statusOkImage);
    if (color == "yellow") $(imageId).attr('src', this.gui.properties.getProperties().statusYellowImage);
};

/**
 *
 * @param {avnav.nav.NavEvent} evdata
 */
avnav.gui.Mainpage.prototype.navEvent=function(evdata) {
    if (!this.visible) return;
    if (evdata.type == avnav.nav.NavEventType.GPS){
        var status=this.navobject.getValue("aisStatusColor");
        if (status != this.lastAisStatus) {
            this.setImageColor('#avi_mainAisStatusImage',status);
            this.lastAisStatus=status;
        }
        status=this.navobject.getValue("nmeaStatusColor");
        if (status != this.lastNmeaStatus) {
            this.setImageColor('#avi_mainNmeaStatusImage',status);
            this.lastNmeaStatus=status;
        }
    }
};

avnav.gui.Mainpage.prototype.layout=function(){
    $('#avi_mainpage_selections').vAlign();
    $('#avi_mainpage_selections').hAlign();
};

//-------------------------- Buttons ----------------------------------------

avnav.gui.Mainpage.prototype.btnShowHelp=function (button,ev){
    avnav.log("ShowHelp clicked");
};

avnav.gui.Mainpage.prototype.btnShowStatus=function (button,ev){
    avnav.log("ShowStatus clicked");
    this.gui.showPage('statuspage');
};
avnav.gui.Mainpage.prototype.btnShowSettings=function (button,ev){
    avnav.log("ShowSettings clicked");
    this.gui.showPage('settingspage');
};
avnav.gui.Mainpage.prototype.btnShowGps=function (button,ev){
    avnav.log("ShowGps clicked");
    this.gui.showPage('gpspage');
};
avnav.gui.Mainpage.prototype.btnConnected=function (button,ev){
    avnav.log("Connected clicked");
    var ncon=!this.gui.properties.getProperties().connectedMode;
    this.handleToggleButton('.avb_Connected',ncon);
    this.gui.properties.setValueByName('connectedMode',ncon);
    this.gui.properties.saveUserData();
    $(document).trigger(avnav.util.PropertyChangeEvent.EVENT_TYPE,new avnav.util.PropertyChangeEvent(this.gui.properties));

};

avnav.gui.Mainpage.prototype.btnNight=function (button,ev){
    avnav.log("Night clicked");
    var ncon=this.gui.properties.getProperties().style.nightMode;
    if (ncon == 100){
        ncon=this.gui.properties.getProperties().nightFade;
    }
    else ncon=100;
    this.handleToggleButton('.avb_Night',ncon!=100);
    this.changeDim(ncon);
};
avnav.gui.Mainpage.prototype.btnShowDownload=function (button,ev) {
    avnav.log("show download clicked");
    this.gui.showPage('downloadpage');
};
avnav.gui.Mainpage.prototype.btnMainAndroid=function (button,ev) {
    avnav.log("main android settings clicked");
    avnav.android.showSettings();
};
avnav.gui.Mainpage.prototype.btnMainCancel=function (button,ev) {
    avnav.log("main cancel clicked");
    avnav.android.goBack();
};
/**
 * create the page instance
 */
(function(){
    //create an instance of the status page handler
    var page=new avnav.gui.Mainpage();
}());

