/**
 * Created by Andreas on 27.04.2014.
 */
avnav.provide('avnav.gui.Statuspage');



/**
 *
 * @constructor
 */
avnav.gui.Statuspage=function(){
    avnav.gui.Page.call(this,'statuspage');
    this.statusQuery=0; //sequence counter
};
avnav.inherits(avnav.gui.Statuspage,avnav.gui.Page);



avnav.gui.Statuspage.prototype.showPage=function(options){
    if (!this.gui) return;
    this.statusQuery=1;
    this.doQuery();
};

avnav.gui.Statuspage.prototype.doQuery=function(){
    if (! this.statusQuery) return;
    this.statusQuery++;
    var self=this;
    var url=this.gui.properties.getProperties().navUrl+"?request=status";
    $.ajax({
        url: url,
        dataType: 'json',
        cache:	false,
        context: {sequence:self.statusQuery,self:self},
        success: function(data,status){
            if (this.sequence != this.self.statusQuery) return;
            this.self.showStatusData(data);
            var self=this.self;
            self.statusTimer=window.setTimeout(function(){self.doQuery();},self.gui.properties.getProperties().statusQueryTimeout);
        },
        error: function(status,data,error){
            log("status query error");
            if (this.sequence != this.self.statusQuery) return;
            var self=this.self;
            self.statusTimer=window.setTimeout(function(){self.doQuery();},self.gui.properties.getProperties().statusQueryTimeout);
        },
        timeout: self.gui.properties.getProperties().statusQueryTimeout*0.9
    });

};

avnav.gui.Statuspage.prototype.hidePage=function(){
    this.statusQuery=0;
    if (this.statusTimer)window.clearTimeout(this.statusTimer);
};

avnav.gui.Statuspage.prototype.showStatusData=function(data){
    var statusTemplate=$('#avi_'+this.name+' #avi_statusTemplate:first').clone();
    var childStatusTemplate=$('#avi_'+this.name+' #avi_childStatusTemplate:first').clone();
    $('#avi_'+this.name+' #avi_statusData .avn_status').remove();
    $('#avi_'+this.name+'  #avi_statusData .avn_child_status').remove();
    for (var e in data.handler){
        var worker=data.handler[e];
        var domEntry=statusTemplate.clone();
        domEntry.html('<span class="avn_status_name">'+worker.name+'</span><br>');
        $('#avi_'+this.name+' #avi_statusData').append(domEntry);
        if (worker.info.items) for (var c in worker.info.items){
            var child=worker.info.items[c];
            var cdomEntry=childStatusTemplate.clone();
            cdomEntry.html(this.formatChildStatus(child));
            $('#avi_'+this.name+' #avi_statusData').append(cdomEntry);
        }
    }
    $('#avi_'+this.name+' #avi_statusData .avn_status').show();
    $('#avi_'+this.name+' #avi_statusData .avn_child_status').show();
};

avnav.gui.Statuspage.prototype.formatChildStatus=function(item){
    var ehtml='<img src="';
    ehtml+=this.statusTextToImageUrl(item.status);
    ehtml+='"/><span class="avn_status_name">'+item.name+'</span><span class="avn_status_info">'+item.info+'</span><br>';
    return ehtml;
};

avnav.gui.Statuspage.prototype.statusTextToImageUrl=function(text){
    var rt=this.gui.properties.getProperties().statusIcons[text];
    if (! rt) rt=this.gui.properties.getProperties().statusIcons.INACTIVE;
    return rt;
};
avnav.gui.Statuspage.prototype.localInit=function() {
};

//-------------------------- Buttons ----------------------------------------

avnav.gui.Statuspage.prototype.btnStatusWpa=function(button,ev){
    log("StatusWpa clicked");
    this.gui.showPage('wpapage');
};
avnav.gui.Statuspage.prototype.btnStatusAndroid=function(button,ev) {
    log("StatusAndroid clicked");
    avnav.android.showSettings();
};

(function(){
    //create an instance of the status page handler
    var page=new avnav.gui.Statuspage();
}());


