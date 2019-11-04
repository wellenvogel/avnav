/**
 * Created by Andreas on 27.04.2014.
 */
var ItemList=require('../components/ItemListOld.jsx');
var ItemUpdater=require('../components/ItemUpdater.jsx');
var React=require('react');
var QRCode=require('qrcode.react');

var keys={
  infoItems:'addresses'
};


/**
 *
 * @constructor
 */
var Addresspage=function(){
    avnav.gui.Page.call(this,'addresspage');
    this.statusQuery=0; //sequence counter
};
avnav.inherits(Addresspage,avnav.gui.Page);



Addresspage.prototype.showPage=function(options){
    if (!this.gui) return;
    this.statusQuery=1;
    this.doQuery();
};

Addresspage.prototype.doQuery=function(){
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
            var hasServer=false;
            if (data.handler) {
                data.handler.forEach(function(el){
                    if (el.configname == "AVNHttpServer" ){
                        hasServer=true;
                        if (el.properties && el.properties.addresses){
                            var items=[];
                            for (var i=0;i<el.properties.addresses.length;i++){
                                items.push({key:i,value:el.properties.addresses[i]});
                            }
                            self.store.storeData(keys.infoItems,{itemList:items});
                        }
                        else{
                            self.store.storeData(keys.infoItems,{itemList:[]});
                        }
                    }
                });
            }
            if (! hasServer){
                self.store.storeData(keys.infoItems,{itemList:[]});
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

Addresspage.prototype.hidePage=function(){
    this.statusQuery=0;
    if (this.statusTimer)window.clearTimeout(this.statusTimer);
};


Addresspage.prototype.getPageContent=function(){
    var self=this;
    var buttons=[
        {key:'Cancel'}
    ];
    this.setButtons(buttons);
    var AddressItem=function(props){
        var url="http://"+props.value;
        return(
            <div className="avn_address">
                <div className="avn_url">
                {url}
                </div>
                <QRCode value={url}/>
            </div>

        );
    };
    var AddressList=ItemUpdater(ItemList,this.store,keys.infoItems);
    var listProperties={
        onItemClick: function(item,opt_data){},
        itemClass: AddressItem
    };
    var Headline=function(props){
        return <div className="avn_left_top">Server Addresses</div>
    };
    return function(props){
            return(
                <div className="avn_panel_fill_flex">
                    <Headline/>
                    <div className="avn_listWrapper">
                        <AddressList {...listProperties}/>
                    </div>
                    {self.getAlarmWidget()}
                </div>
            );
        };
};

//-------------------------- Buttons ----------------------------------------


(function(){
    //create an instance of the status page handler
    var page=new Addresspage();
}());


