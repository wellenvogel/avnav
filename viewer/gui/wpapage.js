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
    this.timeout=4000;
    this.numErrors=0;
};
avnav.inherits(avnav.gui.Wpapage,avnav.gui.Page);



avnav.gui.Wpapage.prototype.showPage=function(options){
    if (!this.gui) return;
    var self=this;
    this.statusQuery=window.setInterval(function(){
        self.doQuery();
    },this.timeout);
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
            self.numErrors=0;
        },
        error: function(status,data,error){
            self.numErrors++;
            if (self.numErrors > 3) {
                self.numErrors=0;
                avnav.util.Overlay.Toast("Status query Error " + avnav.util.Helper.escapeHtml(error), self.timeout * 0.6)
            }
            avnav.log("wpa query error");
        },
        timeout: this.timeout*0.9
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
            html+="&nbsp;["+avnav.util.Helper.escapeHtml(status.ssid)+"]&nbsp;"
        }
        if (status.ip_address){
            html+="IP: "+avnav.util.Helper.escapeHtml(status.ip_address);
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
    var ehtml="<li class='avn_wpa_item' id='avi_wpa_item"+index+"' data-id='"+netid+"'><span class='avn_wpa_ssid'>"+avnav.util.Helper.escapeHtml(item.ssid)+"</span>";
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
        $('#avi_wpa_dialog button[name=disable]').css('visibility','hidden');
    }
    else{
        $('#avi_wpa_dialog button[name=remove]').css('visibility','normal');
        $('#avi_wpa_dialog button[name=disable]').css('visibility','normal');
    }
    this.overlay.showOverlayBox();
};
avnav.gui.Wpapage.prototype.statusTextToImageUrl=function(text){
    var rt=this.gui.properties.getProperties().statusIcons[text];
    if (! rt) rt=this.gui.properties.getProperties().statusIcons.INACTIVE;
    return rt;
};
avnav.gui.Wpapage.prototype.sendRequest=function(request,message,param){
    avnav.util.Overlay.Toast("sending "+message,this.timeout*2);
    var self=this;
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
            if (data.status && data.status == "OK") ;
            else {
                statusText+="...Error";
            }
            avnav.util.Overlay.Toast(statusText,5000);
        },
        error: function(status,data,error){
            avnav.util.Overlay.Toast(message+"...Error",5000);
            avnav.log("wpa request error: "+data);
        },
        timeout: this.timeout*2
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
        var data=self.getFormData(true);
        self.sendRequest('connect','connect to '+avnav.util.Helper.escapeHtml(data.ssid),data);
        return false;
    });
    $('#avi_wpa_dialog button[name=remove]').bind('click',function(){
        self.overlay.overlayClose();
        var data=self.getFormData(true);
        self.sendRequest('remove','remove '+avnav.util.Helper.escapeHtml(data.ssid),data);
        return false;
    });
    $('#avi_wpa_dialog button[name=disable]').bind('click',function(){
        self.overlay.overlayClose();
        var data=self.getFormData(true);
        self.sendRequest('disable','disable '+avnav.util.Helper.escapeHtml(data.ssid),data);
        return false;
    });
    this.timeout=this.gui.properties.getProperties().wpaQueryTimeout;
};

//-------------------------- Buttons ----------------------------------------


(function(){
    //create an instance of the status page handler
    var page=new avnav.gui.Wpapage();
}());


