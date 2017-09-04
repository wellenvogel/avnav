/**
 * Created by Andreas on 27.04.2014.
 */
var Page=require('./page.jsx');
var React=require('react');
var ReactDOM=require('react-dom');
var OverlayDialog=require('../components/OverlayDialog.jsx');
var ItemList=require('../components/ItemList.jsx');
var Store=require('../util/store');
var ItemUpdater=require('../components/ItemUpdater.jsx');

var keys={
    itemListKey:'wpaItemns',
    interfaceKey:'interface'
};

/**
 *
 * @constructor
 */
var Wpapage=function(){
    Page.call(this,'wpapage');
    this.statusQuery=0; //sequence handler
    this.timeout=4000;
    this.numErrors=0;
    /**
     * the store that feeds the GUI
     * @private
     * @type {Store|exports|module.exports}
     */
    this.store=new Store();
};
avnav.inherits(Wpapage,Page);



Wpapage.prototype.showPage=function(options){
    if (!this.gui) return;
    var self=this;
    this.statusQuery=window.setInterval(function(){
        self.doQuery();
    },this.timeout);
    this.store.storeData(keys.interfaceKey,{});
    this.store.storeData(keys.itemListKey,{});
    this.doQuery();
};

Wpapage.prototype.doQuery=function(){
    var self=this;
    var url=this.gui.properties.getProperties().navUrl+"?request=wpa&command=all";
    $.ajax({
        url: url,
        dataType: 'json',
        cache:	false,
        success: function(data,status){
            self.showWpaData(data);
            self.numErrors=0;
        },
        error: function(status,data,error){
            self.numErrors++;
            if (self.numErrors > 3) {
                self.numErrors=0;
                self.toast("Status query Error " + avnav.util.Helper.escapeHtml(error), true)
            }
            avnav.log("wpa query error");
        },
        timeout: this.timeout*0.9
    });

};

Wpapage.prototype.hidePage=function(){
    window.clearInterval(this.statusQuery);
};


Wpapage.prototype.showWpaData=function(data){
    var self=this;
    this.store.storeData(keys.interfaceKey,{status:data.status});
    var i;
    var itemList=[];
    for (i in data.list){
        var item=data.list[i];
        var ssid=item.ssid;
        if (ssid === undefined) continue;
        var displayItem={};
        displayItem.ssid=item.ssid;
        displayItem.id=item['network id'];
        displayItem.level=item['signal level'];
        displayItem.flags=item.flags+' '+item['network flags'];
        if (displayItem.id === undefined) displayItem.id=-1;
        if (data.status.ssid && item.ssid == data.status.ssid) {
            displayItem.activeItem=true;
        }
        displayItem.key=ssid;
        itemList.push(displayItem);
    }
    this.store.storeData(keys.itemListKey,{itemList:itemList});
};

Wpapage.prototype.sendRequest=function(request,message,param){
    var self=this;
    self.toast("sending "+message,true);
    var url=this.gui.properties.getProperties().navUrl+"?request=wpa&command="+request;
    $.ajax({
        url: url,
        dataType: 'json',
        cache:	false,
        method: 'POST',
        data: param,
        success: function(data,status){
            avnav.log("request "+request+" OK");
            var statusText=message;
            if (data.status && data.status == "OK") {;}
            else {
                statusText+="...Error";
            }
            self.toast(statusText,true);
        },
        error: function(status,data,error){
            self.toast(message+"...Error",true);
            avnav.log("wpa request error: "+data);
        },
        timeout: this.timeout*2
    });
};

Wpapage.prototype.getPageContent=function() {
    var self=this;
    this.timeout=this.gui.properties.getProperties().wpaQueryTimeout;
    var buttons=[
        {key:'Cancel'} 
    ];
    this.setButtons(buttons);
    var wpaClickHandler=function(item){
        self.showWpaDialog(item.ssid,item.id);
    };
    var listEntryClass=React.createClass({
        propTypes:{
            ssid: React.PropTypes.string.isRequired,
            level:React.PropTypes.string,
            id: React.PropTypes.any.isRequired,
            flags: React.PropTypes.string.isRequired,
            activeItem: React.PropTypes.bool
        },
        onClick: function(ev){
            wpaClickHandler(this.props);
        },
        render: function(){
            var level=this.props.level;
            try {
                level = parseInt(level);
            }catch(e){}
            if (level >= 0) level=level+"%";
            else level=level+"dBm";
            var disabled=(this.props.flags !== undefined && this.props.flags.match(/DISABLED/));
            var addClass=this.props.activeItem?'avn_wpa_active_item':'';
            return(
                <div className={'avn_wpa_item '+addClass} onClick={this.onClick}>
                    <span className='avn_wpa_ssid'>{this.props.ssid}</span>
                    <div className='avn_wpa_item_details_container'>
                        <span className='avn_wpa_item_detail'>Signal:{level}</span>
                        <span className='avn_wpa_item_detail'>{this.props.id >=0?'configured':''}</span>
                        { disabled && <span className='avn_wpa_item_detail'>disabled</span>}
                        { this.props.activeItem  && <span className='avn_wpa_item_detail'>active</span>}
                    </div>
                </div>
            );
        }

    });
    var HeaderClass=ItemUpdater(React.createClass({
        propTypes:{
            status: React.PropTypes.object
        },
        render: function(){
            var status=this.props.status||{};
            if (!status.wpa_state){
                return(
                  <div>Waiting for interface...</div>
                );
            }
            var info=status.ssid?"["+status.ssid+"]":"";
            if (status.ip_address) info+=", IP: "+status.ip_address;
            else info+=" waiting for IP...";
            return (
                <div className="avn_wpa_interface">
                    <div>Interface: {status.wpa_state}</div>
                    { (status.wpa_state == "COMPLETED") &&
                        <div className='avn_wpa_interface_detail'>{info}</div>
                    }
                </div>
            );
        }
    }),this.store,keys.interfaceKey);

    var NetworkList=ItemUpdater(ItemList,this.store,keys.itemListKey);

    var leftPanel=React.createClass({
        render:function(props) {
            return(
                <div className="avn_panel_fill_flex">
                    <div className='avn_left_top'>
                        <div >Wifi Client connection
                        </div>
                    </div>

                    <div className="avn_listWrapper">
                        <HeaderClass></HeaderClass>
                        <NetworkList itemClass={listEntryClass}>
                        </NetworkList>
                    </div>
                </div>
            );
        }
    });
    return leftPanel;

};

Wpapage.prototype.showWpaDialog=function(ssid,id){
    var Dialog=React.createClass({
        propTypes:{
            closeCallback:React.PropTypes.func.isRequired,
            resultCallback: React.PropTypes.func.isRequired

        },
        getInitialState: function(){
            return{
                psk: ''
            }
        },
        valueChange: function(event){
            this.setState({
                psk: event.target.value
            }) ;
        },
        buttonClick: function(event){
            var button=event.target.name;
            this.props.closeCallback();
            if (button != "cancel")  this.props.resultCallback(button,this.state.psk);
        },
        render: function(){
            return (
                    <div className="avi_wpa_dialog">
                        <div>
                            <h3><span >{ssid}</span></h3>
                            <div>
                                <label >Password
                                <input type="password" name="psk" onChange={this.valueChange} value={this.state.psk}/>
                                </label>
                            </div>
                            {id >=0 && <button name="remove" onClick={this.buttonClick}>Remove</button>}
                            <button name="cancel" onClick={this.buttonClick}>Cancel</button>
                            <button name="connect" onClick={this.buttonClick}>Connect</button>
                            {id >= 0 && <button name="enable" onClick={this.buttonClick}>Enable</button>}
                            {id >= 0 && <button name="disable" onClick={this.buttonClick}>Disable</button>}
                            <div className="avn_clear"></div>
                        </div>
                    </div>
            );
        }
    });
    var self=this;
    OverlayDialog.dialog(Dialog,this.getDialogContainer(),{
       resultCallback: function(type,psk){
           var data={
               id: id,
               ssid: ssid
           };
           if (type== 'connect') {
               data.psk=psk;
               self.sendRequest('connect', 'connect to ' + avnav.util.Helper.escapeHtml(data.ssid), data);
               return;
           }
           if (type == 'remove' || type == 'disable'|| type == 'enable'){
               self.sendRequest(type,type+' '+avnav.util.Helper.escapeHtml(data.ssid),data);
               return;
           }
       }
    });
};

//-------------------------- Buttons ----------------------------------------


(function(){
    //create an instance of the status page handler
    var page=new Wpapage();
}());


