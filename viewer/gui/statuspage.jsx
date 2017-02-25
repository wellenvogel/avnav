/**
 * Created by Andreas on 27.04.2014.
 */
var ItemList=require('../components/ItemList.jsx');
var ItemUpdater=require('../components/ItemUpdater.jsx');
var React=require('react');

var keys={
  statusItems:'status'
};


/**
 *
 * @constructor
 */
var Statuspage=function(){
    avnav.gui.Page.call(this,'statuspage');
    this.statusQuery=0; //sequence counter
};
avnav.inherits(Statuspage,avnav.gui.Page);



Statuspage.prototype.showPage=function(options){
    if (!this.gui) return;
    this.statusQuery=1;
    this.doQuery();
};

Statuspage.prototype.doQuery=function(){
    if (! this.statusQuery) return;
    this.statusQuery++;
    var self=this;
    var url=this.gui.properties.getProperties().navUrl+"?request=status";
    $.ajax({
        url: url,
        dataType: 'json',
        cache:	false,
        context: {sequence:self.statusQuery},
        success: function(data,status){
            var visibility={
                addresses:false,
                wpa:false
            };
            if (this.sequence != self.statusQuery) return;
            if (data.handler) {
                data.handler.forEach(function(el){
                    el.key=el.name;
                    if (el.configname=="AVNHttpServer"){
                        if (el.properties && el.properties.addresses ) visibility.addresses=true;
                    }
                    if (el.configname == "AVNWpaHandler"){
                        visibility.wpa=true;
                    }
                });
                self.store.storeData(keys.statusItems, {itemList: data.handler});
            }
            for (var k in visibility){
                self.changeButtonVisibilityFlag(k,visibility[k]);
            }
            self.statusTimer=window.setTimeout(function(){self.doQuery();},self.gui.properties.getProperties().statusQueryTimeout);
        },
        error: function(status,data,error){
            avnav.log("status query error");
            if (this.sequence != self.statusQuery) return;
            self.statusTimer=window.setTimeout(function(){self.doQuery();},self.gui.properties.getProperties().statusQueryTimeout);
        },
        timeout: self.gui.properties.getProperties().statusQueryTimeout*0.9
    });

};

Statuspage.prototype.hidePage=function(){
    this.statusQuery=0;
    if (this.statusTimer)window.clearTimeout(this.statusTimer);
};



Statuspage.prototype.statusTextToImageUrl=function(text){
    var rt=this.gui.properties.getProperties().statusIcons[text];
    if (! rt) rt=this.gui.properties.getProperties().statusIcons.INACTIVE;
    return rt;
};
Statuspage.prototype.localInit=function() {
};
Statuspage.prototype.getPageContent=function(){
    var self=this;
    var buttons=[
        {key:'Cancel'},
        {key:'StatusWpa',wpa:true},
        {key:'StatusAddresses',addresses:true},
        {key:'StatusAndroid',android:true}
    ];
    this.store.storeData(this.globalKeys.buttons,{itemList:buttons});
    this.changeButtonVisibilityFlag('addresses',false);
    var ChildStatus=function(props){
        return (
            <div className="avn_child_status">
                <img src={self.statusTextToImageUrl(props.status)}/>
                <span className="avn_status_name">{props.name}</span>
                <span className="avn_status_info">{props.info}</span>
            </div>
        );
    };
    var StatusItem=function(props){
        return(
            <div className="avn_status" onClick={props.onClick}>
                <span className="avn_status_name">{props.name.replace(/\[.*\]/,'')}</span>
                {props.info && props.info.items && props.info.items.map(function(el){
                    return <ChildStatus {...el} key={el.name}/>
                })}
            </div>

        );
    };
    var StatusList=ItemUpdater(ItemList,this.store,keys.statusItems);
    var listProperties={
        onItemClick: function(item,opt_data){
            if (item.configname=="AVNHttpServer" && item.properties && item.properties.addresses){
                self.gui.showPage("addresspage");
            }
        },
        itemClass: StatusItem
    };
    var Headline=function(props){
        return <div className="avn_left_top">Server Status</div>
    };
    return React.createClass({
        render: function(){
            return(
                <div className="avn_panel_fill_flex">
                    <Headline/>
                    <div className="avn_listWrapper">
                        <StatusList {...listProperties}/>
                    </div>
                </div>
            );
        }
    });
};

//-------------------------- Buttons ----------------------------------------

Statuspage.prototype.btnStatusWpa=function(button,ev){
    avnav.log("StatusWpa clicked");
    this.gui.showPage('wpapage');
};
Statuspage.prototype.btnStatusAndroid=function(button,ev) {
    avnav.log("StatusAndroid clicked");
    avnav.android.showSettings();
};
Statuspage.prototype.btnStatusAddresses=function(button,ev) {
    avnav.log("StatusAddresses clicked");
    this.gui.showPage('addresspage');
};
(function(){
    //create an instance of the status page handler
    var page=new Statuspage();
}());


