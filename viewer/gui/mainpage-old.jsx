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
var Dynamic=require('../hoc/Dynamic.jsx');
var keys={
    chartlist:'charts',
    status:'status'
};

const flatten=function(object,key){
    return object[key];
};


/**
 *
 * @constructor
 */
var Mainpage=function(){
    Page.call(this,'mainpage');
    var self=this;
    $(document).on(navobjects.NavEvent.EVENT_TYPE, function(ev,evdata){
        self.navEvent(evdata);
    });

    $(document).on(avnav.util.PropertyChangeEvent.EVENT_TYPE,function(){
        self.fillList();
    });
    $(document).on(avnav.gui.AndroidEvent.EVENT_TYPE,(ev,evdata)=>{
        if (evdata.key && evdata.key === 'reloadData'){
            self.fillList();
        }
    });
    this.store=new Store();
    this.soundHandler=undefined;
    this.soundRepeat=0;
    this.lastAlarmSound=undefined;
    this.initialPlayCheck=0; //1: started, 2: ok
    this.fixedButtons=[
        {key:'ShowStatus'},
        {key:'ShowSettings'},
        {key:'ShowDownload'},
        {key:'Connected',toggle:true, android:false},
        {key:'ShowGps'},
        {key:'Night',toggle:true},
        {key:'MainInfo'},
        {key:'MainCancel',android:true}
    ];
    this.addOnButtons=[
        {key:'MainAddOns'}
    ];
    this.currentButtons=this.fixedButtons;
    this.addOns=[];
};
avnav.inherits(Mainpage,Page);

/**
 * change the night mode
 * @param {boolean} newDim
 */
Mainpage.prototype.changeDim=function(newDim){
    this.gui.properties.setValueByName('nightMode',newDim);
    this.gui.properties.saveUserData();
    this.gui.properties.updateLayout();
    $(document).trigger(avnav.util.PropertyChangeEvent.EVENT_TYPE,new avnav.util.PropertyChangeEvent(this.gui.properties));
};

Mainpage.prototype.enableSound=function(){
    if (this.initialPlayCheck >= 1) return;
    if (avnav.android) return;
    let self=this;
    let hasSounds=self.gui.properties.getProperties().localAlarmSound;
    if (! hasSounds) return;
    if (this.soundHandler){
        this.initialPlayCheck=1;
        this.soundHandler.src=this.gui.properties.getProperties().silenceSound;
        const askForSound=()=>{
            self.initialPlayCheck=0;
            if (! hasSounds) return;
            self.toast("click to allow sounds",true,60000,()=>{
                self.initialPlayCheck=1;
                self.soundHandler.play();
            })
        };
        try {
            this.soundHandler.play().catch(askForSound);
        }catch(e){
            askForSound();
        }
    }
};
Mainpage.prototype.getPageContent=function(){
    var self=this;
    this.soundHandler=document.getElementById('avi_sound');
    if (this.soundHandler) {
        this.soundHandler.addEventListener('playing', () => {
            if (self.initialPlayCheck < 2) {
                self.initialPlayCheck = 2;
                self.soundHandler.pause();
            }
        });
        this.enableSound();
    }

    this.setButtons(this.fixedButtons);
    var Headline=function(props){
        return <div className="header">AvNav</div>
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
    var BottomLine=Dynamic(function(props){
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
                       <div className="avn_label"> AVNav Version <span id="avi_mainpage_version">{window.avnav_version}</span></div>
                       <div><a href="http://www.wellenvogel.de/software/avnav/index.php" className="avn_extlink">www.wellenvogel.de/software/avnav/index.php</a></div>
                   </div>
               </div>
           </div>
       )
    },this.store);
    var ChartList=Dynamic(ItemList,this.store);
    return React.createClass({
        render: function(){
            return(
                <div className="leftPart">
                    <Headline/>
                        <ChartList className="mainContent"
                                   itemClass={ChartItem}
                                   onItemClick={chartSelected}
                                   className=""
                                   itemList={[]}
                                   storeKeys={keys.chartlist}
                                   updateFunction={flatten}
                                   scrollable={true}
                        />
                    {self.getAlarmWidget()}
                    <BottomLine storeKeys={keys.status} updateFunction={flatten}/>
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
Mainpage.prototype.readAddOns=function(){
    if (typeof (avnav.android) !== 'undefined') return; //on addons on android for now
    var page=this;
    var url=this.gui.properties.getProperties().navUrl+"?request=readAddons";
    $.ajax({
        url: url,
        dataType: 'json',
        cache: false,
        error: function(ev){
            page.toast("unable to read addons: "+ev.responseText);
        },
        success: function(data){
            if (data.status != 'OK'){
                page.toast("reading addons failed: "+data.info);
                return;
            }
            var items=[];
            for (var e in data.data){
                var button=data.data[e];
                var entry={
                    key:button.key,
                    url:button.url,
                    icon: button.icon,
                    title: button.title
                };
                if (entry.key){
                    items.push(entry);
                }
            }
            page.addOns=items;
            if (items.length > 0) {
                page.currentButtons = page.fixedButtons.concat(page.addOnButtons);
                page.setButtons(page.currentButtons)
            }
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
    this.readAddOns();
    if (avnav.android || this.gui.properties.getProperties().readOnlyServer){
        this.selectOnPage('.avb_Connected').hide();
    }
    this.enableSound();

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
    this.updateAlarmSound();
    if (!this.visible) return;
    if (evdata.type == navobjects.NavEventType.GPS) {
        var aisStatus = this.navobject.getData("aisStatusColor");
        var nmeaStatus = this.navobject.getData("nmeaStatusColor");

        this.store.storeData(keys.status, {
            nmeaStatusText: this.navobject.getData('nmeaStatusText'),
            nmeaStatusSrc: this.getImgSrc(nmeaStatus),
            aisStatusText: this.navobject.getData('aisStatusText'),
            aisStatusSrc: this.getImgSrc(aisStatus)
        });
    }
};

Mainpage.prototype.updateAlarmSound=function(){
   if (! this.soundHandler) return;
   if (this.initialPlayCheck < 2) return;
   if (avnav.android) return;
   var alarmState=this.navobject.getData('alarmSound');
   var repeat=10000;
   if (alarmState !== undefined) {
       var nameAndRepeat = alarmState.split(",");
       alarmState = nameAndRepeat[0];
       if (nameAndRepeat.length > 1) {
           repeat = parseInt(nameAndRepeat[1]);
       }
   }

   try {
       if (!alarmState || ! this.gui.properties.getProperties().localAlarmSound) {
           this.soundRepeat=0;
           this.lastAlarmSound=undefined;
           if (! this.soundHandler.src) return;
           this.soundHandler.pause();
           this.soundHandler.removeAttribute('src');
           return;
       }
       var self=this;
       if (alarmState !== this.lastAlarmSound){
           this.lastAlarmSound=alarmState;
           self.soundHandler.src=self.gui.properties.getProperties().navUrl+"?request=download&type=alarm&name="+encodeURIComponent(alarmState);
           self.soundHandler.play();
           self.soundRepeat=repeat;
       }
       if (this.soundHandler.ended){
           if (this.soundRepeat > 0){
               this.soundRepeat--;
               this.soundHandler.play();
           }
       }


   }catch(e){}
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

Mainpage.prototype.btnMainAddOns=function(){
    avnav.log("main addons clicked");
    this.gui.showPage('addonpage',{addOns:this.addOns});

};

/**
 * create the page instance
 */
(function(){
    //create an instance of the status page handler
    var page=new Mainpage();
}());

