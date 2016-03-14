/**
 * Created by Andreas on 27.04.2014.
 */
avnav.provide('avnav.gui.Wpapage');



/**
 *
 * @constructor
 */
avnav.gui.Wpapage=function(){
    avnav.gui.Page.call(this,'wpapage');
    this.statusQuery=0; //sequence handler
    this.indexMap={}; //map an index to ssid
    this.overlay=new avnav.util.Overlay({
        box: '#avi_wpa_box',
        cover: '#avi_wpa_overlay'
    });
};
avnav.inherits(avnav.gui.Wpapage,avnav.gui.Page);



avnav.gui.Wpapage.prototype.showPage=function(options){
    if (!this.gui) return;
    var self=this;
    this.statusQuery=window.setInterval(function(){
        self.doQuery();
    },self.gui.properties.getProperties().statusQueryTimeout);
    this.indexMap={};
    $('#avi_wpa_interface').html("Query Status");
    $('#avi_wpa_list').html("");
    this.doQuery();
};

avnav.gui.Wpapage.prototype.doQuery=function(){
    var self=this;
    var url=this.gui.properties.getProperties().navUrl+"?request=wpa&command=all";
    $.ajax({
        url: url,
        dataType: 'json',
        cache:	false,
        success: function(data,status){
            self.showWpaData(data);
        },
        error: function(status,data,error){
            log("wpa query error");
        },
        timeout: self.gui.properties.getProperties().statusQueryTimeout*0.9
    });

};

avnav.gui.Wpapage.prototype.hidePage=function(){
    window.clearInterval(this.statusQuery);
    this.overlay.overlayClose();
};

avnav.gui.Wpapage.prototype.formatInterfaceState=function(status){
    var html="<div>Interface: "+status["wpa_state"]+"</div>";
    if (status.wpa_state == "COMPLETED"){
        html+="<div class='avn_wpa_interface_detail'>";
        if (status.ssid){
            html+="&nbsp;["+status.ssid+"]&nbsp;"
        }
        if (status.ip_address){
            html+="IP: "+status.ip_address;
        }
        else{
            html+="waiting for IP...";
        }
        html+="</div>"
    }
    return html;
};
avnav.gui.Wpapage.prototype.showWpaData=function(data){
    var self=this;
    $('#avi_wpa_interface').html(this.formatInterfaceState(data.status));
    var i;
    var listHtml="<ul>";
    var index=0;
    var lindex=0;
    //find free index
    for (i in this.indexMap){
        if (this.indexMap[i]> index) index=this.indexMap[i];
    }
    index++;
    var seenItems={};
    for (i in data.list){
        var item=data.list[i];
        var ssid=item.ssid;
        if (ssid === undefined) continue;
        lindex=this.indexMap[ssid];
        if (lindex === undefined){
            //add entry
            this.addEntry(item,index);
            this.indexMap[ssid]=index;
            seenItems[index]=1;
            lindex=index;
            index++;
        }
        else{
            var self=this;
            var netid=item['network id'];
            $('#avi_wpa_item'+lindex+' .avn_wpa_item_details_container').html(self.formatItemDetails(item));
            $('#avi_wpa_item'+lindex).attr('data-id',netid ===undefined?-1:netid);
            seenItems[lindex]=1;
        }
        if (data.status.ssid && item.ssid == data.status.ssid){
            $('#avi_wpa_item'+lindex).addClass("avn_wpa_active_item");
        }
        else{
            $('#avi_wpa_item'+lindex).removeClass("avn_wpa_active_item");
        }
    }
    for (i in this.indexMap){
        lindex=this.indexMap[i];
        if (! seenItems[lindex]){
            delete this.indexMap[i];
            $('#avi_wpa_item'+lindex).remove();
        }
    }
};

avnav.gui.Wpapage.prototype.addEntry=function(item,index){
    var self=this;
    var ssid=item.ssid;
    var netid=item['network id'];
    if (netid === undefined) netid=-1;
    var ehtml="<li class='avn_wpa_item' id='avi_wpa_item"+index+"' data-id='"+netid+"'><span class='avn_wpa_ssid'>"+item.ssid+"</span>";
    ehtml+="<div class='avn_wpa_item_details_container'>"+this.formatItemDetails(item)+"</div>";
    $('#avi_wpa_list').append(ehtml);
    $('#avi_wpa_item'+index).bind('click',function(){
        self.handleNet(ssid,$(this).attr('data-id'));
    });
};

avnav.gui.Wpapage.prototype.formatItemDetails=function(item){
    var ehtml='';
    if (item['signal level'] >= 0){
        ehtml+="<span class='avn_wpa_item_detail'>Signal:"+item['signal level']+"%</span>";
    }
    else{
        ehtml+="<span class='avn_wpa_item_detail'>not in range</span>";
    }
    if (item['network id'] !== undefined){
        ehtml+="<span class='avn_wpa_item_detail'>configured</span>";
    }
    if (item['network flags'] !== undefined && item['network flags'].match(/DISABLED/)){
        ehtml+="<span class='avn_wpa_item_detail'>disabled</span>";
    }
    return ehtml;
};

avnav.gui.Wpapage.prototype.handleNet=function(ssid,netid){
    $('#avi_wpa_form_ssid').text(ssid);
    $('#avi_wpa_dialog input[name=ssid]').val(ssid);
    $('#avi_wpa_dialog input[name=id]').val(netid);
    $('#avi_wpa_dialog input[name=psk]').val("");
    if (netid === undefined || netid < 0){
        $('#avi_wpa_dialog button[name=remove]').css('visibility','hidden');
    }
    else{
        $('#avi_wpa_dialog button[name=remove]').css('visibility','normal');
    }
    this.overlay.showOverlayBox();
};
avnav.gui.Wpapage.prototype.statusTextToImageUrl=function(text){
    var rt=this.gui.properties.getProperties().statusIcons[text];
    if (! rt) rt=this.gui.properties.getProperties().statusIcons.INACTIVE;
    return rt;
};
avnav.gui.Wpapage.prototype.sendRequest=function(request,param){
    var self=this;
    var url=this.gui.properties.getProperties().navUrl+"?request=wpa&command="+request;
    $.ajax({
        url: url,
        dataType: 'json',
        cache:	false,
        method: 'POST',
        data: param,
        success: function(data,status){
            log("request "+request+" OK");
        },
        error: function(status,data,error){
            log("wpa request error: "+data);
        },
        timeout: self.gui.properties.getProperties().statusQueryTimeout*0.9
    });
};
avnav.gui.Wpapage.prototype.getFormData=function(addPsk){
    var rt={};
    rt.ssid=$('#avi_wpa_dialog input[name=ssid]').val();
    rt.id=$('#avi_wpa_dialog input[name=id]').val();
    if (! addPsk) return rt;
    var psk=$('#avi_wpa_dialog input[name=psk]').val();
    if (psk != '') rt.psk=psk;
    return rt;
};
avnav.gui.Wpapage.prototype.localInit=function() {
    var self=this;
    $('#avi_wpa_dialog button[name=cancel]').bind('click',function(){
        self.overlay.overlayClose();
        return false;
    });
    $('#avi_wpa_dialog button[name=connect]').bind('click',function(){
        self.overlay.overlayClose();
        self.sendRequest('connect',self.getFormData(true));
        return false;
    });
    $('#avi_wpa_dialog button[name=remove]').bind('click',function(){
        self.overlay.overlayClose();
        self.sendRequest('remove',self.getFormData(false));
        return false;
    });
};

avnav.gui.Wpapage.prototype.goBack=function() {
    this.btnWpaCancel();
};
//-------------------------- Buttons ----------------------------------------
/**
 * cancel page (go back to main)
 * @private
 */
avnav.gui.Wpapage.prototype.btnWpaCancel=function(button,ev){
    log("WpaCancel clicked");
    this.gui.showPage('statuspage');
};

(function(){
    //create an instance of the status page handler
    var page=new avnav.gui.Wpapage();
}());


