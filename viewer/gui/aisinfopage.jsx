/**
 * Created by andreas on 02.05.14.
 */
var Page=require('./page.jsx');
var navobjects=require('../nav/navobjects');
var AisHandler=require('../nav/aisdata');
var React=require('react');
var ItemList=require('../components/ItemList.jsx');
var ItemUpdater=require('../components/ItemUpdater.jsx');

var keys={
    aisItem: 'aisItem',
    status:'status'
};

/**
 *
 * @constructor
 */
var AisInfoPage=function(){
    Page.call(this,'aisinfopage',
        {
            eventlist:[navobjects.NavEvent.EVENT_TYPE],
            returnOnClick: true
        }
    );
    /**
     * @private
     * @type {AisHandler}
     */
    this.aishandler=null;

    /**
     * @private
     * @type {undefined}
     */
    this.mmsi=undefined;

};
avnav.inherits(AisInfoPage,Page);

AisInfoPage.prototype.localInit=function(){
    this.aishandler=this.navobject.getAisHandler();
};
/**
 * @private
 * @param label
 * @param key
 */
AisInfoPage.prototype.createItem=function(label,key,opt_addClass){
    var self=this;
    var Item=function(props){
        var cl="avn_ais_data";
        if (opt_addClass)cl+=" "+opt_addClass;
        return(
            <div className="avn_row">
                <div className='avn_label '>{label}</div>
                <div className={cl} >{self.aishandler.formatAisValue(key,props)}</div>
            </div>
        );
    };
    return React.createElement(ItemUpdater(Item,this.store,keys.aisItem));
};
AisInfoPage.prototype.getPageContent=function(){
    var self=this;
    this.aishandler=this.navobject.getAisHandler();
    var buttons=[
        {key:'AisInfoNearest'},
        {key:'AisInfoLocate'},
        {key:'AisInfoList'},
        {key:'Cancel'}
    ];
    this.store.storeData(this.globalKeys.buttons,{itemList:buttons});
    var Headline=function(props){
        return <div className="avn_left_top">AIS Info</div>
    };
    var Status=function(props){
        return <img src={props.src} style={{transform:'rotate('+props.rotation+'deg)'}} className="avn_Status"/>
    };
    var StatusItem=ItemUpdater(Status,this.store,keys.status);
    var displayItems=[
        {key:'aisMmsi',label:'MMSI'},
        {key:'aisName',label:'Name'},
        {key:'aisCallsign',label:'Callsign'},
        {key:'aisDst',label:'Distance'},
        {key:'aisHeading',label:'HeadingTo'},
        {key:'aisCpa',label:'CPA(nm)'},
        {key:'aisTcpa',label:'TCPA(h:min:sec)'},
        {key:'aisSog',label:'SOG(kn)'},
        {key:'aisCog',label:'COG'},
        {key:'aisDestination',label:'Destination'},
        {key:'aisShiptype',label:'Type'},
        {key:'aisFront',label:'we pass',addClass:'avn_ais_front'},
        {key:'aisPosition',label:'Position'}
    ];
    var onClick=function(){
        self.returnToLast();
    };
    return React.createClass({
      render: function(){
         return(
             <div className="avn_panel_fill_flex">
                 <Headline/>
                 <StatusItem/>
                 <div className="avn_panel avn_scrollable_page avn_left_inner" onClick={onClick}>
                     <div className='avn_infopage_inner'>
                         <div className="avn_table">
                             {displayItems.map(function(item){
                                 return self.createItem(item.label,item.key,item.addClass);
                             })}
                         </div>
                     </div>
                 </div>
             </div>
         );
      }
  })  
};
AisInfoPage.prototype.showPage=function(options) {
    if (!this.gui) return;
    this.mmsi=options?options.mmsi:undefined;
    if (this.mmsi === undefined) {
        var current=this.aishandler.getNearestAisTarget();
        if (current) this.mmsi=current.mmsi;
    }
    this.fillData(true);
};

AisInfoPage.prototype.getCurrentTarget=function(){
    var current=this.aishandler.getAisByMmsi(this.mmsi);

    return current;
};
AisInfoPage.prototype.fillData=function(initial){
    var currentObject=this.getCurrentTarget();
    if (! this.aishandler || currentObject === undefined){
        this.returnToLast();
        return;
    }
    var status='normal';
    if (currentObject.warning){
        status='warning';
    }
    else{
        if (currentObject.nearest) status='nearest';
    }
    this.store.storeData(keys.status,{rotation:currentObject.course,src:this.gui.map.getAisIcon(status)});
    this.store.storeData(keys.aisItem,currentObject);
};


AisInfoPage.prototype.hidePage=function(){

};
//-------------------------- Buttons ----------------------------------------

AisInfoPage.prototype.btnAisInfoNearest=function (button,ev){
    this.aishandler.setTrackedTarget(0);
    var pos=this.aishandler.getAisPositionByMmsi(this.aishandler.getTrackedTarget());
    if (pos)this.gui.map.setCenter(pos);
    this.returnToLast();
    avnav.log("Nearest clicked");
};

AisInfoPage.prototype.btnAisInfoList=function (button,ev){
    avnav.log("List clicked");
    this.aishandler.setTrackedTarget(this.mmsi);
    this.gui.showPage('aispage',{skipHistory:true});
};
AisInfoPage.prototype.btnAisInfoLocate=function (button,ev){
    avnav.log("Locate clicked");
    if (this.mmsi === undefined) return;
    var pos=this.aishandler.getAisPositionByMmsi(this.mmsi);
    if (pos)this.gui.map.setCenter(pos);
    this.gui.map.setGpsLock(false);
    this.returnToLast();
};
/**
 * create the page instance
 */
(function(){
    //create an instance of the status page handler
    var page=new AisInfoPage();
}());

