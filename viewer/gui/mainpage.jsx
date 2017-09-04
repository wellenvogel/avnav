/**
 * Created by andreas on 02.05.14.
 */
var Page=require('./page.jsx');
var navobjects=require('../nav/navobjects');
var Store=require('../util/store');
var ItemUpdater=require('../components/ItemUpdater.jsx');
var ItemList=require("../components/ItemList.jsx");
var ReactDOM=require("react-dom");
var React=require("react");
var keys={
    chartlist:'charts',
    status:'status'
};

/**
 *
 * @constructor
 */
var Mainpage=function(){
    Page.call(this,'mainpage');
    var self=this;
    this.lastNmeaStatus=null;
    this.lastAisStatus=null;
    $(document).on(navobjects.NavEvent.EVENT_TYPE, function(ev,evdata){
        self.navEvent(evdata);
    });

    $(document).on(avnav.util.PropertyChangeEvent.EVENT_TYPE,function(){
        self.fillList();
    });
    this.store=new Store();
};
avnav.inherits(Mainpage,Page);

/**
 * changethe night mode
 * @param {boolean} newDim
 */
Mainpage.prototype.changeDim=function(newDim){
    this.gui.properties.setValueByName('nightMode',newDim);
    this.gui.properties.saveUserData();
    this.gui.properties.updateLayout();
    $(document).trigger(avnav.util.PropertyChangeEvent.EVENT_TYPE,new avnav.util.PropertyChangeEvent(this.gui.properties));
};
Mainpage.prototype.getPageContent=function(){
    var self=this;
    var buttons=[
        {key:'ShowStatus'},
        {key:'ShowSettings'},
        {key:'ShowDownload'},
        {key:'Connected',toggle:true},
        {key:'ShowGps'},
        {key:'Night',toggle:true},
        {key:'MainInfo'},
        {key:'MainCancel',android:true}
        ];
    this.setButtons(buttons);
    var Headline=function(props){
        return <div className="avn_left_top">AvNav</div>
    };
    var chartSelected=function(item){
        self.showNavpage(item);
    };
    var ChartItem=function(props){
        return (
            <div className="avn_mainpage_select_item" onClick={props.onClick}>
                <img src="images/Chart60.png"/>
                <span className="avn_mainName">{props.name}</span>
                <span className="avn_more"/>
            </div>
        );
    };
    var BottomLine=function(props){
       return (
           <div className='avn_left_bottom '>
               <div className="avn_mainpage_leftbottominner">
                   <div className='avn_mainpage_status'>
                       <div className='avn_label '>
                           <img  className='avn_status_image_small' src={props.nmeaStatusSrc}/>
                           NMEA&nbsp;{props.nmeaStatusText}
                       </div>
                       <div className='avn_label'>
                           <img id='avi_mainAisStatusImage' className='avn_status_image_small' src={props.aisStatusSrc}/>
                           AIS&nbsp;{props.aisStatusText}
                       </div>
                   </div>
                   <div className="avn_mainpage_link" >
                       <div className="avn_label"> AVNav Version <span id="avi_mainpage_version">develop</span></div>
                       <div><a href="http://www.wellenvogel.de/software/avnav/index.php" className="avn_extlink">www.wellenvogel.de/software/avnav/index.php</a></div>
                   </div>
               </div>
           </div>
       )
    };
    var BottomLineItem=ItemUpdater(BottomLine,this.store,keys.status);
    var ChartList=ItemUpdater(ItemList,this.store,keys.chartlist);
    return React.createClass({
        render: function(){
            return(
                <div className="avn_panel_fill_flex">
                    <Headline/>
                    <div className="avn_listWrapper">
                        <ChartList itemClass={ChartItem}
                                   onItemClick={chartSelected}
                                   className=""
                                   itemList={[]}
                        />
                    </div>
                    <BottomLineItem/>
                </div>
            );
        }
    });
};

Mainpage.prototype.fillList=function(){
    var page=this;
    var url=this.gui.properties.getProperties().navUrl+"?request=listCharts";
    $.ajax({
        url: url,
        dataType: 'json',
        cache: false,
        error: function(ev){
            page.toast("unable to read chart list: "+ev.responseText);
        },
        success: function(data){
            if (data.status != 'OK'){
                page.toast("reading chartlist failed: "+data.info);
                return;
            }
            var items=[];
            for (var e in data.data){
                var chartEntry=data.data[e];
                var listEntry={
                    key: chartEntry.name,
                    name: chartEntry.name,
                    url: chartEntry.url,
                    charturl: chartEntry.charturl
                };
                items.push(listEntry);
            }
            page.store.storeData(keys.chartlist,{itemList: items});
        }

    });
};
Mainpage.prototype.showPage=function(options){
    if (!this.gui) return;
    var ncon=this.gui.properties.getProperties().connectedMode;
    this.handleToggleButton('.avb_Connected',ncon);
    ncon=this.gui.properties.getProperties().nightMode;
    this.handleToggleButton('.avb_Night',ncon);
    this.fillList();
    if (avnav.android || this.gui.properties.getProperties().readOnlyServer){
        this.selectOnPage('.avb_Connected').hide();
    }

};

/**
 * the click handler for the charts
 * @param entry - the chart entry
 */
Mainpage.prototype.showNavpage=function(entry){
    avnav.log("activating navpage with url "+entry.url);
    this.gui.showPage('navpage',{url:entry.url,charturl:entry.charturl});

};
Mainpage.prototype.hidePage=function(){

};
Mainpage.prototype.goBack=function(){
    avnav.android.goBack();
};

Mainpage.prototype.getImgSrc=function(color){
    if (color == "red") return this.gui.properties.getProperties().statusErrorImage;
    if (color == "green") return this.gui.properties.getProperties().statusOkImage;
    if (color == "yellow")return this.gui.properties.getProperties().statusYellowImage;
};

/**
 *
 * @param {navobjects.NavEvent} evdata
 */
Mainpage.prototype.navEvent=function(evdata) {
    if (!this.visible) return;
    if (evdata.type == navobjects.NavEventType.GPS) {
        var nmeaStatus = this.navobject.getValue("aisStatusColor");
        var aisStatus = this.navobject.getValue("nmeaStatusColor");

        this.store.storeData(keys.status, {
            nmeaStatusText: this.navobject.getValue('nmeaStatusText'),
            nmeaStatusSrc: this.getImgSrc(nmeaStatus),
            aisStatusText: this.navobject.getValue('aisStatusText'),
            aisStatusSrc: this.getImgSrc(aisStatus)
        });
    }
};


//-------------------------- Buttons ----------------------------------------

Mainpage.prototype.btnShowHelp=function (button,ev){
    avnav.log("ShowHelp clicked");
};

Mainpage.prototype.btnShowStatus=function (button,ev){
    avnav.log("ShowStatus clicked");
    this.gui.showPage('statuspage');
};
Mainpage.prototype.btnShowSettings=function (button,ev){
    avnav.log("ShowSettings clicked");
    this.gui.showPage('settingspage');
};
Mainpage.prototype.btnShowGps=function (button,ev){
    avnav.log("ShowGps clicked");
    this.gui.showPage('gpspage');
};
Mainpage.prototype.btnConnected=function (button,ev){
    avnav.log("Connected clicked");
    var ncon=!this.gui.properties.getProperties().connectedMode;
    this.handleToggleButton('.avb_Connected',ncon);
    this.gui.properties.setValueByName('connectedMode',ncon);
    this.gui.properties.saveUserData();
    $(document).trigger(avnav.util.PropertyChangeEvent.EVENT_TYPE,new avnav.util.PropertyChangeEvent(this.gui.properties));

};

Mainpage.prototype.btnNight=function (button,ev){
    avnav.log("Night clicked");
    var ncon=this.gui.properties.getProperties().nightMode;
    this.handleToggleButton('.avb_Night',!ncon);
    this.changeDim(!ncon);
};
Mainpage.prototype.btnShowDownload=function (button,ev) {
    avnav.log("show download clicked");
    this.gui.showPage('downloadpage');
};
Mainpage.prototype.btnMainAndroid=function (button,ev) {
    avnav.log("main android settings clicked");
    avnav.android.showSettings();
};
Mainpage.prototype.btnMainInfo=function (button,ev) {
    avnav.log("main info clicked");
    this.gui.showPage('infopage');
};
Mainpage.prototype.btnMainCancel=function (button,ev) {
    avnav.log("main cancel clicked");
    avnav.android.goBack();
};
/**
 * create the page instance
 */
(function(){
    //create an instance of the status page handler
    var page=new Mainpage();
}());

