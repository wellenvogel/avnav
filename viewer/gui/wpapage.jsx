/**
 * Created by Andreas on 27.04.2014.
 */
var Page=require('./page.jsx');
var React=require('react');
var PropTypes=require('prop-types');
var ReactDOM=require('react-dom');
var OverlayDialog=require('../components/OverlayDialog.jsx');
var ItemList=require('../components/ItemListOld.jsx');
var Store=require('../util/store');
var ItemUpdater=require('../components/ItemUpdater.jsx');

var keys={
    itemListKey:'wpaItemns',
    interfaceKey:'interface',
    showAccess: 'showAccess' //if this is set, we can allow incoming traffic by setting this as id_str
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
    this.store.storeData(keys.showAccess,data.showAccess);
    var i;
    var itemList=[];
    for (i in data.list){
        var item=data.list[i];
        var ssid=item.ssid;
        if (ssid === undefined) continue;
        var displayItem={};
        displayItem.ssid=item.ssid;
        displayItem.allowAccess=item.allowAccess;
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
        self.showWpaDialog(item.ssid,item.id,item.allowAccess);
    };
    var listEntryClass=function(props){
            var level=props.level;
            try {
                level = parseInt(level);
            }catch(e){}
            if (level >= 0) level=level+"%";
            else level=level+"dBm";
            var disabled=(props.flags !== undefined && props.flags.match(/DISABLED/));
            var addClass=props.activeItem?'avn_wpa_active_item':'';
            return(
                <div className={'avn_wpa_item '+addClass} onClick={()=>{wpaClickHandler(props)}}>
                    <span className='avn_wpa_ssid'>{props.ssid}</span>
                    <div className='avn_wpa_item_details_container'>
                        <span className='avn_wpa_item_detail'>Signal:{level}</span>
                        <span className='avn_wpa_item_detail'>{props.id >=0?'configured':''}</span>
                        { disabled && <span className='avn_wpa_item_detail'>disabled</span>}
                        { (props.allowAccess && self.store.getData(keys.showAccess,false))  && <span className='avn_wpa_item_detail'>ext access</span>}
                        { props.activeItem  && <span className='avn_wpa_item_detail'>active</span>}
                    </div>
                </div>
            );
        };
    var HeaderClass=ItemUpdater(function(props){
            var status=props.status||{};
            if (!status.wpa_state){
                return(
                  <div>Waiting for interface...</div>
                );
            }
            var info=status.ssid?"["+status.ssid+"]":"";
            var showAccess=self.store.getData(keys.showAccess,false);
            if (status.ip_address) {
                info+=", IP: "+status.ip_address;
                if (props.status.allowAccess && showAccess){
                    info+=", ext access"
                }
                if (showAccess){
                    info+=", firewall "+((status.fwStatus === 0)?"ok":"failed");
                }
            }
            else info+=" waiting for IP...";
            return (
                <div className="avn_wpa_interface">
                    <div>Interface: {status.wpa_state}</div>
                    { (status.wpa_state == "COMPLETED") &&
                        <div className='avn_wpa_interface_detail'>{info}</div>
                    }
                </div>
            );
        },this.store,keys.interfaceKey);

    var NetworkList=ItemUpdater(ItemList,this.store,keys.itemListKey);

    var leftPanel=function(props) {
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
                    {self.getAlarmWidget()}
                </div>
            );
        };
    return leftPanel;

};

Wpapage.prototype.showWpaDialog=function(ssid,id,allowAccess){
    var self=this;
    const resultCallback=function(type,psk,allowAccess){
        var data={
            id: id,
            ssid: ssid
        };
        if (type== 'connect') {
            data.psk=psk;
            if (allowAccess){
                data.allowAccess=allowAccess;
            }
            self.sendRequest('connect', 'connect to ' + avnav.util.Helper.escapeHtml(data.ssid), data);
            return;
        }
        if (type == 'enable'){
            if (allowAccess){
                data.allowAccess=allowAccess;
            }
            if (psk && psk != ""){
                //allow to change the PSK with enable
                data.psk=psk;
            }
            self.sendRequest(type,type+' '+avnav.util.Helper.escapeHtml(data.ssid),data);
            return;
        }
        if (type == 'remove' || type == 'disable'){
            self.sendRequest(type,type+' '+avnav.util.Helper.escapeHtml(data.ssid),data);
            return;
        }
    };
    class Dialog extends React.Component{
        constructor(props){
            super(props);
            this.state={
                psk: '',
                allowAccess: self.store.getDataLocal(keys.showAccess,false)
            };
            this.valueChange=this.valueChange.bind(this);
            this.accessChange=this.accessChange.bind(this);
            this.buttonClick=this.buttonClick.bind(this);
        }
        valueChange(event){
            this.setState({
                psk: event.target.value
            }) ;
        }
        accessChange(event){
            let newAccess=! this.state.allowAccess;
            this.setState({
                allowAccess: newAccess
            }) ;
        }
        buttonClick(event){
            let button=event.target.name;
            this.props.closeCallback();
            if (button != "cancel")  resultCallback(button,this.state.psk,this.state.allowAccess);
        }
        render(){
            return (
                    <div className="avi_wpa_dialog">
                        <div>
                            <h3><span >{this.props.ssid}</span></h3>
                            <div>
                                <label >Password
                                <input type="password" name="psk" onChange={this.valueChange} value={this.state.psk}/>
                                </label>
                                {this.props.showAccess?
                                    <label onClick={this.accessChange}>External access
                                        <span className={'avnCheckbox'+(this.state.allowAccess?' checked':'')}/>
                                    </label>
                                :null
                                }
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
    };
    Dialog.propTypes={
        closeCallback:PropTypes.func.isRequired
    };
    OverlayDialog.dialog(Dialog,this.getDialogContainer());
};

//-------------------------- Buttons ----------------------------------------


(function(){
    //create an instance of the status page handler
    var page=new Wpapage();
}());


