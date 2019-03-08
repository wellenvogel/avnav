/**
 * Created by Andreas on 27.04.2014.
 */
var ItemList=require('../components/ItemList.jsx');
var ItemUpdater=require('../components/ItemUpdater.jsx');
var React=require('react');


var keys={
    title:'title',
    index:'index'
};


/**
 *
 * @constructor
 */
var AddonPage=function(){
    avnav.gui.Page.call(this,'addonpage');
    this.statusQuery=0; //sequence counter
    this.addOns=[];
    this.fixedButtons=[
        {key:'Cancel'}
    ];
};
avnav.inherits(AddonPage,avnav.gui.Page);


AddonPage.prototype.changeItem=function(active){
    for (var i=0;i<this.addOns.length;i++){
        if (i == active) {
            this.addOns[i].toggle=true;
            this.store.storeData(keys.title,this.addOns[i].title||"AddOns")
        }
        else this.addOns[i].toggle=false;
    }
    this.setButtons(this.addOns.concat(this.fixedButtons));
    this.store.storeData(keys.index,active);
};

AddonPage.prototype.showPage=function(options){
    if (! options.addOns || options.addOns.length < 1) {
        this.returnToLast();
        return;
    }
    this.addOns=options.addOns;
    this.changeItem(this.store.getData(keys.index,0));
};


AddonPage.prototype.hidePage=function(){
};


AddonPage.prototype.getPageContent=function(){
    var self=this;
    var buttons=[
        {key:'Cancel'}
    ];
    this.setButtons(buttons);
    var Frame=ItemUpdater(function(props){
        if (props.index === undefined) return null;
        return<div className="addonFrame avn_flexFill avn_flexColumn">
                <iframe src={self.addOns[props.index].url} className="avn_flexFill"/>
            </div>
        },this.store,keys.index);
    var Headline=ItemUpdater(function(props){
        return <div className="avn_left_top">{props.title}</div>
    },this.store,keys.title);
    return React.createClass({
        render: function(){
            return(
                <div className="avn_panel_fill_flex">
                    <Headline/>
                    <Frame/>
                    {self.getAlarmWidget()}
                </div>
            );
        }
    });
};

//-------------------------- Buttons ----------------------------------------
AddonPage.prototype.btnAny=function(key){
    for (var i=0;i<this.addOns.length;i++){
        if (this.addOns[i].key == key ){
            if (i != this.store.getData(keys.index)){
                this.changeItem(i);
            }
        }
    }
};

(function(){
    //create an instance of the status page handler
    var page=new AddonPage();
}());


