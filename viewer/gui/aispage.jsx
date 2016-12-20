/**
 * Created by andreas on 02.05.14.
 */
avnav.provide('avnav.gui.Aispage');
var navobjects=require('../nav/navobjects');
var AisHandler=require('../nav/aisdata');
var Store=require('../util/store');
var ItemUpdater=require('../components/ItemUpdater.jsx');
var ItemList=require('../components/ItemList.jsx');
var ReactDOM=require('react-dom');
var React=require('react');

var keys={
    aisTargets: 'ais',
    summary: 'summary'
};

var selections={
    selected: 'avn_selectedItem',
    nearest:  'avn_nearestItem',
    warning:  'avn_warningItem'
};



/**
 *
 * @constructor
 */
avnav.gui.Aispage=function(){
    avnav.gui.Page.call(this,'aispage');
    /**
     * @private
     * @type {AisHandler}
     */
    this.aishandler=null;
    /**
     * @privvate
     * @type {undefined}
     */
    this.aisFormatter=undefined;

    this.store=new Store();
    var self=this;
    $(document).on(navobjects.NavEvent.EVENT_TYPE, function(ev,evdata){
        self.navEvent(evdata);
    });
};
avnav.inherits(avnav.gui.Aispage,avnav.gui.Page);

var aisInfos=[
    [
        {name:'distance',label:'Dst',unit:'nm'},
        {name:'cpa',label:'Cpa',unit:'nm'},
        {name:'tcpa',label:'Tcpa',unit:'h'}
    ],
    [
        {name:'course',label:'Cog',unit:'°'},
        {name:'speed',label:'Sog',unit:'kn'},
        {name:'heading',label:'Hdg',unit:'°'}
    ],
    [
        {name:'shiptype',label:'Type'},
        {name:'callsign',label:'Call'},
        {name:'destination',label:'Dest'}
    ]
];
avnav.gui.Aispage.prototype.localInit=function(){
    this.aishandler=this.navobject.getAisHandler();
    this.aisFormatter=this.aishandler.getAisFormatter();
    var self=this;

    var AisItem=function(props){
        var fmt=self.aisFormatter;
        var fb=fmt.passFront.format(props);
        var style={
            color:props.color
        };
        var cl=props.addClass;
        if (props.warning) cl+=" avn_aisWarning";
        return ( <div className={"avn_aisListItem "+cl} onClick={props.onClick}>
                <div className="avn_aisItemFB" style={style}>
                    <span className="avn_fb1">{fb.substr(0,1)}</span>{fb.substr(1)}
                </div>
                <div className="avn_aisData">
                    <div className="avn_aisData1">
                        {fmt.mmsi.format(props)}&nbsp;
                        {fmt.shipname.format(props)}
                    </div>
                    { aisInfos.map(function(info1){
                        return <div className="avn_infoLine">
                                {
                                    info1.map(function(info) {
                                        return (
                                            <span className="avn_aisInfoElement">
                                                <span className="avn_aisLabel">{info.label}: </span>
                                                <span className="avn_aisData">{fmt[info.name].format(props)}{info.unit !== undefined && info.unit}</span>
                                            </span>
                                        );
                                    })
                                }
                        </div>
                    })}

                </div>
            </div>
        );
    };
    var Summary=ItemUpdater(function(props){
        var color=self.gui.properties.getAisColor({
            warning: true
        });
        return (
            <div className="avn_aisSummary">
                <span className="avn_aisNumTargets">{props.numTargets} Targets</span>
                {(props.warning !== undefined) && <span className="avn_aisWarning" style={{backgroundColor:color}}
                        onClick={function(){
                            avnav.util.Helper.scrollItemIntoView('.avn_aisWarning','#avi_ais_page_inner');
                        }}/>}
            </div>
        );
    },this.store,keys.summary);
    var AisList=ItemUpdater(ItemList,this.store,keys.aisTargets);
    ReactDOM.render(
        <div className="avn_panel_fill_flex">
            <Summary numTargets={0}/>
            <AisList
                itemClass={AisItem}
                onItemClick={function(item){
                    self.aishandler.setTrackedTarget(item.mmsi);
                    self.gui.showPage('aisinfopage',{mmsi:item.mmsi,skipHistory: true});
                }}
                className="avn_scrollable_page avn_aisList"
            />
        </div>,
        this.selectOnPage('.avn_left_inner')[0]);
};
avnav.gui.Aispage.prototype.showPage=function(options) {
    if (!this.gui) return;
    this.fillData(true);
    avnav.util.Helper.scrollItemIntoView('.avn_selectedItem','#avi_ais_page_inner');
};

avnav.gui.Aispage.prototype.fillData=function(initial){
    var aisList=this.aishandler.getAisData();
    var trackingTarget=this.aishandler.getTrackedTarget();
    var items=[];
    var summary={};
    for( var aisidx in aisList){
        var ais=aisList[aisidx];
        if (! ais.mmsi) continue;
        if (ais.warning ){
            summary.warning=ais.mmsi;
        }
        var color=this.gui.properties.getAisColor({
            nearest: ais.nearest,
            warning: ais.warning,
            //tracking: hasTracking && ais.tracking
        });
        var item=avnav.assign({},ais,{color:color,key:ais.mmsi});
        items.push(item);
    }
    summary.numTargets=items.length;
    var nsel={};
    nsel[selections.selected]=trackingTarget;
    this.store.storeData(keys.aisTargets,{itemList:items,selectors:nsel});
    this.store.storeData(keys.summary,summary);
};


avnav.gui.Aispage.prototype.hidePage=function(){

};
/**
 *
 * @param {navobjects.NavEvent} ev
 */
avnav.gui.Aispage.prototype.navEvent=function(ev){
    if (! this.visible) return;
    if (ev.type==navobjects.NavEventType.AIS){
        this.fillData(false);
    }
};

//-------------------------- Buttons ----------------------------------------

avnav.gui.Aispage.prototype.btnAisNearest=function (button,ev){
    this.aishandler.setTrackedTarget(0);
    this.returnToLast();
    avnav.log("Nearest clicked");
};

/**
 * create the page instance
 */
(function(){
    //create an instance of the status page handler
    var page=new avnav.gui.Aispage();
}());

