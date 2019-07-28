/**
 * Created by andreas on 02.05.14.
 */
var navobjects=require('../nav/navobjects');
var AisHandler=require('../nav/aisdata');
var Store=require('../util/store');
var ItemUpdater=require('../components/ItemUpdater.jsx');
var ItemList=require('../components/ItemList.jsx');
var ReactDOM=require('react-dom');
var React=require('react');
var OverlayDialog=require('../components/OverlayDialog.jsx');
var AisFormatter=require('../nav/aisformatter.jsx');

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
var Aispage=function(){
    avnav.gui.Page.call(this,'aispage');
    /**
     * @private
     * @type {AisHandler}
     */
    this.aishandler=null;

    this.store=new Store();
    var self=this;
    this.sortField='cpa';
    this.sort=this.sort.bind(this);
    $(document).on(navobjects.NavEvent.EVENT_TYPE, function(ev,evdata){
        self.navEvent(evdata);
    });
};
avnav.inherits(Aispage,avnav.gui.Page);

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
Aispage.prototype.getPageContent=function(){
    this.aishandler=this.navobject.getAisHandler();
    var self=this;
    var buttons=[
        {key:"AisNearest"},
        {key:"AisSort"},
        {key:"Cancel"}
    ];
    this.setButtons(buttons);

    var AisItem=function(props){
        var fmt=AisFormatter;
        var fb=fmt.format('passFront',props);
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
                        {fmt.format('mmsi',props)}&nbsp;
                        {fmt.format('shipname',props)}
                    </div>
                    { aisInfos.map(function(info1){
                        return <div className="avn_infoLine">
                            {
                                info1.map(function(info) {
                                    return (
                                        <span className="avn_aisInfoElement">
                                                <span className="avn_aisLabel">{info.label}: </span>
                                                <span className="avn_aisData">{fmt.format(info.name,props)}{info.unit !== undefined && info.unit}</span>
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
            <div className="avn_aisSummary" onClick={function(){self.sortDialog()}}>
                <span className="avn_aisNumTargets">{props.numTargets} Targets</span>
                {(props.warning) && <span className="avn_aisWarning" style={{backgroundColor:color}}
                                          onClick={function(){
                            avnav.util.Helper.scrollItemIntoView('.avn_aisWarning','#avi_ais_page_inner');
                        }}/>}
                <span>sorted by {self.fieldToLabel(self.sortField)}</span>
            </div>
        );
    },this.store,keys.summary);
    var AisList=ItemUpdater(ItemList,this.store,keys.aisTargets);
    return React.createClass({
        render: function() {
            return (
                <div className="avn_panel_fill_flex">
                    <div className="avn_left_top">
                        <div>Ais</div>
                    </div>

                        <Summary numTargets={0}/>
                        <div className="avn_listWrapper">
                            <AisList
                                itemClass={AisItem}
                                onItemClick={function (item) {
                                    self.aishandler.setTrackedTarget(item.mmsi);
                                    self.gui.showPage('aisinfopage', {mmsi: item.mmsi, skipHistory: true});
                                }}
                                className="avn_aisList"
                            />
                        </div>
                    {self.getAlarmWidget()}
                </div>);
        }
    });
};

Aispage.prototype.showPage=function(options) {
    if (!this.gui) return;
    this.fillData(true);
    avnav.util.Helper.scrollItemIntoView('.avn_selectedItem','#avi_ais_page_inner');
};

Aispage.prototype.fieldToLabel=function(field){
    var rt;
    aisInfos.map(function(l1){
        l1.map(function(l2){
            if (l2.name == field) rt=l2.label;
        })
    });
    return rt||field;
};
Aispage.prototype.sort=function(a,b){
    var fa=a[this.sortField];
    var fb=b[this.sortField];
    if (this.sortField == 'tcpa'){
        if (fa<0 && fb >=0) return 1;
        if (fb<0 && fa >=0) return -1;
        if (fa <0 && fb < 0) {
            if (fa < fb) return 1;
            if (fa > fb) return -1;
            return 0;
        }
    }
    if (fa < fb) return -1;
    if (fa > fb) return 1;
    if (fa == fb) return 0;
};
Aispage.prototype.fillData=function(initial){
    var aisList=this.aishandler.getAisData();
    var trackingTarget=this.aishandler.getTrackedTarget();
    var items=[];
    var summary={
        warning:null
    };
    aisList.sort(this.sort);
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


Aispage.prototype.hidePage=function(){

};
/**
 *
 * @param {navobjects.NavEvent} ev
 */
Aispage.prototype.navEvent=function(ev){
    if (! this.visible) return;
    if (ev.type==navobjects.NavEventType.AIS){
        this.fillData(false);
    }
};

Aispage.prototype.sortDialog=function(){
    var list=[
        {label:'CPA', value:'cpa'},
        {label:'TCPA',value:'tcpa'},
        {label:'DST',value:'distance'}
    ];
    for (var i in list){
        if (list[i].value == this.sortField) list[i].selected=true;
    }
    var p=OverlayDialog.selectDialogPromise('Sort Order',list,this.getDialogContainer());
    var self=this;
    p.then(function(selected){
        self.sortField=selected.value;
        self.fillData();
    });
};

//-------------------------- Buttons ----------------------------------------

Aispage.prototype.btnAisNearest=function (button,ev){
    this.aishandler.setTrackedTarget(0);
    this.returnToLast();
    avnav.log("Nearest clicked");
};

Aispage.prototype.btnAisSort=function (button,ev){
    avnav.log("Sort clicked");
    this.sortDialog();
};

/**
 * create the page instance
 */
(function(){
    //create an instance of the status page handler
    var page=new Aispage();
}());

