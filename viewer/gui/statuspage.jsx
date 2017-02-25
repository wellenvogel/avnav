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
            if (this.sequence != self.statusQuery) return;
            if (data.handler) {
                data.handler.forEach(function(el){el.key=el.name});
                self.store.storeData(keys.statusItems, {itemList: data.handler});
            }
            self.statusTimer=window.setTimeout(function(){self.doQuery();},self.gui.properties.getProperties().statusQueryTimeout);
        },
        error: function(status,data,error){
            avnav.log("status query error");
            if (this.sequence != this.self.statusQuery) return;
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
        {key:'StatusWpa'},
        {key:'StatusAndroid',android:true}
    ];
    this.store.storeData(this.globalKeys.buttons,{itemList:buttons});
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
            <div className="avn_status">
                <span className="avn_status_name">{props.name.replace(/\[.*\]/,'')}</span>
                {props.info.items.map(function(el){
                    return <ChildStatus {...el} key={el.name}/>
                })}
            </div>

        );
    };
    var StatusList=ItemUpdater(ItemList,this.store,keys.statusItems);
    var listProperties={
        onItemClick: function(item,opt_data){},
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

(function(){
    //create an instance of the status page handler
    var page=new Statuspage();
}());


