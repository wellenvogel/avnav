/**
 * Created by andreas on 02.05.14.
 */
var Page=require('./page.jsx');
var navobjects=require('../nav/navobjects');
var AisHandler=require('../nav/aisdata');
var React=require('react');
var ItemList=require('../components/ItemListOld.jsx');
var ItemUpdater=require('../components/ItemUpdater.jsx');
var globalStore=require('../util/globalstore.jsx');
var AisFormatter=require('../nav/aisformatter.jsx');
var compare=require('../util/shallowcompare');
var keys=require('../util/keys.jsx');


/**
 *
 * @constructor
 */
var AisInfoPage=function(){
    Page.call(this,'aisinfopage');
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


/**
 * @private
 * @param label
 * @param key
 */
AisInfoPage.prototype.createItem=function(label,key,current,opt_addClass){

        var cl="avn_ais_data";
        if (opt_addClass)cl+=" "+opt_addClass;
        return(
            <div className="avn_row">
                <div className='avn_label '>{label}</div>
                <div className={cl} >{AisFormatter.format(key,current)}</div>
            </div>
        );

};
AisInfoPage.prototype.getPageContent=function() {
    var self = this;
    this.aishandler = this.navobject.getAisHandler();
    var buttons = [
        {key: 'AisInfoNearest'},
        {key: 'AisInfoLocate'},
        {key: 'AisInfoList'},
        {key: 'Cancel'}
    ];
    this.setButtons(buttons);
    var Headline = function (props) {
        return <div className="avn_left_top">AIS Info</div>
    };
    var Status = function (props) {
        return <img src={props.src} style={{transform:'rotate('+props.rotation+'deg)'}} className="avn_Status"/>
    };
    var displayItems = [
        {key: 'mmsi', label: 'MMSI'},
        {key: 'shipname', label: 'Name'},
        {key: 'callsign', label: 'Callsign'},
        {key: 'distance', label: 'Distance'},
        {key: 'heading', label: 'HeadingTo'},
        {key: 'cpa', label: 'CPA(nm)'},
        {key: 'tcpa', label: 'TCPA(h:min:sec)'},
        {key: 'speed', label: 'SOG(kn)'},
        {key: 'course', label: 'COG'},
        {key: 'destination', label: 'Destination'},
        {key: 'shiptype', label: 'Type'},
        {key: 'passFront', label: 'we pass', addClass: 'avn_ais_front'},
        {key: 'position', label: 'Position'}
    ];
    var onClick = function () {
        if (self.isAfterDeadTime()) self.returnToLast();
    };
    let Content = React.createClass({
        shouldComponentUpdate: function (nextProps, nextState) {
            return !compare(this.props.current, nextProps.current) ||
                this.props.src != nextProps.src;
        },
        render: function () {
            let this_=this;
            return (
                <div className="avn_panel_fill_flex">
                    <Headline/>
                    <Status src={this.props.src} rotation={this.props.rotation}/>

                    <div className="avn_listWrapper" onClick={onClick}>
                        <div className='avn_infopage_inner'>
                            <div className="avn_table">
                                {displayItems.map(function (item) {
                                    return self.createItem(item.label, item.key, this_.props.current, item.addClass);
                                })}
                            </div>
                        </div>
                    </div>
                    {self.getAlarmWidget()}
                </div> );
        }
    });
    Content = ItemUpdater(Content,globalStore, [keys.nav.ais.updateCount], function (state) {
            var status = 'normal';
            var currentTarget = self.getCurrentTarget();
            if (currentTarget) {
                if (currentTarget.warning) {
                    status = 'warning';
                }
                else {
                    if (currentTarget.nearest) status = 'nearest';
                }
            }
            var src = self.gui.map.getAisIcon(status);
            return {
                current: currentTarget,
                src: src,
                rotation: currentTarget?currentTarget.course:0
            }
        });
    return Content;
};
AisInfoPage.prototype.showPage=function(options) {
    if (!this.gui) return;
    this.mmsi=options?options.mmsi:undefined;
    if (this.mmsi === undefined) {
        var current=this.aishandler.getNearestAisTarget();
        if (current) this.mmsi=current.mmsi;
    }
    var currentObject=this.getCurrentTarget();
    if (! this.aishandler || currentObject === undefined){
        this.returnToLast();
        return;
    }
};

AisInfoPage.prototype.getCurrentTarget=function(){
    var current=this.aishandler.getAisByMmsi(this.mmsi);
    return current;
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

