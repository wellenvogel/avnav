/**
 * Created by Andreas on 27.04.2014.
 */
var ItemList=require('../components/ItemList.jsx');
var ItemUpdater=require('../components/ItemUpdater.jsx');
var React=require('react');


var keys={
    url:'url',
    title:'title'
};


/**
 *
 * @constructor
 */
var AddonPage=function(){
    avnav.gui.Page.call(this,'addonpage');
    this.statusQuery=0; //sequence counter
};
avnav.inherits(AddonPage,avnav.gui.Page);



AddonPage.prototype.showPage=function(options){
    if (! options.url) return;
    this.url=options.url;
    this.title=options.title||"Addon";
};


AddonPage.prototype.hidePage=function(){
};


AddonPage.prototype.getPageContent=function(){
    var self=this;
    var buttons=[
        {key:'Cancel'}
    ];
    this.setButtons(buttons);
    var Frame=function(props){
        return<div className="addonFrame avn_flexFill avn_flexColumn">
                <iframe src={self.url} className="avn_flexFill"/>
            </div>
        };
    var Headline=function(props){
        return <div className="avn_left_top">{self.title}</div>
    };
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


(function(){
    //create an instance of the status page handler
    var page=new AddonPage();
}());


