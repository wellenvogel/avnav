/**
 * Created by Andreas on 27.04.2014.
 */
var ItemList=require('../components/ItemList.jsx');
var ItemUpdater=require('../components/ItemUpdater.jsx');
var React=require('react');

var keys={
  info:'info'
};


/**
 *
 * @constructor
 */
var Infopage=function(){
    avnav.gui.Page.call(this,'infopage');
    this.statusQuery=0; //sequence counter
};
avnav.inherits(Infopage,avnav.gui.Page);



Infopage.prototype.showPage=function(options){
    if (!this.gui) return;
    this.doQuery();
};

Infopage.prototype.doQuery=function(){
    var self=this;
    var url="info.html";
    $.ajax({
        url: url,
        dataType: 'html',
        cache:	false,
        success: function(data,status){
            self.store.storeData(keys.info,{info:data});
        }
    });
    var url="license.html";
    $.ajax({
        url: url,
        dataType: 'html',
        cache:	false,
        success: function(data,status){
            self.store.storeData(keys.info,{license:data});
        }
    });

};

Infopage.prototype.hidePage=function(){
};





Infopage.prototype.getPageContent=function(){
    var self=this;
    var buttons=[
        {key:'Cancel'}
    ];
    this.setButtons(buttons);
    var Headline=function(props){
        return <div className="avn_left_top">License Info</div>
    };
    var InfoItem=ItemUpdater(function(props){
        return (
            <div className="avn_infoFrame">
                <div className="avn_infoText" dangerouslySetInnerHTML={{__html: props.info}}>
                </div>
                <div className="avn_licenseText" dangerouslySetInnerHTML={{__html: props.license}}>
                </div>
            </div>);
    },self.store,keys.info);
    return React.createClass({
        render: function(){
            return(
                <div className="avn_panel_fill_flex">
                    <Headline/>
                    <div className="avn_listWrapper">
                        <InfoItem/>
                    </div>
                    {self.getAlarmWidget()}
                </div>
            );
        }
    });
};

//-------------------------- Buttons ----------------------------------------


(function(){
    //create an instance of the status page handler
    var page=new Infopage();
}());


