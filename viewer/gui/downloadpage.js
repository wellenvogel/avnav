/**
 * Created by andreas on 02.05.14.
 */
avnav.provide('avnav.gui.Downloadpage');
avnav.provide('avnav.gui.FileInfo');


avnav.gui.FileInfo=function(name,type,time){
    /**
     * @type {String}
     */
    this.name=name;

    /**
     * @type {String} track,chart
     */
    this.type=type||"track";
    /**
     * @type {number} ms timestamp
     */
    this.time=time||0;

};


/**
 *
 * @constructor
 */
avnav.gui.Downloadpage=function(){
    avnav.gui.Page.call(this,'downloadpage');
    this.MAXUPLOADSIZE=100000; //for tracks
    /**
     * the class that is assigned to visible routing entries
     * @type {string}
     */
    this.visibleListEntryClass="avn_download_visible_entry";

    /**
     *
     * @type {string}
     */
    this.idPrefix="avi_downloadInfo";

    /**
     * @private
     * @type {avnav.util.Formatter}
     */
    this.formatter=new avnav.util.Formatter();
    /**
     *
     * @type {Array:avnav.gui.FileInfo}
     */
    this.files=[];
    /**
     * the type of items to handle
     * @type {string}
     */
    this.type="track";

    /**
     * translates the type into a headline
     * @type {{track: string, chart: string}}
     */
    this.headlines={
        track: "Tracks",
        chart: "Charts"
    };

    /**
     * if set - a running upload
     * @type {Xhdr}
     */
    this.xhdr=undefined;

    var self=this;

};
avnav.inherits(avnav.gui.Downloadpage,avnav.gui.Page);

avnav.gui.Downloadpage.prototype.resetUpload=function(){
    $('#avi_download_uploadfile').replaceWith($('#avi_download_uploadfile').clone(true));
};
avnav.gui.Downloadpage.prototype.localInit=function(){
    if (! this.gui) return;
    var self=this;

    $('#avi_download_uploadform').submit(function(form){
       alert("upload file");
    });
    $('#avi_download_uploadfile').on('change',function(ev){
        ev.preventDefault();
        if (this.files && this.files.length > 0) {
            var file = this.files[0];
            self.resetUpload();
            self.directUpload(file);
        }
        return false;
    });
};
avnav.gui.Downloadpage.prototype.showPage=function(options) {
    if (!this.gui) return;
    if(options && options.downloadtype){
        this.type=options.downloadtype;
    }
    else this.type="track";
    if (this.type == "chart"){
        $('#avb_DownloadPageUpload').show();
    }
    else {
        $('#avb_DownloadPageUpload').hide();
    }
    this.fillData(true);
};

/**
 *
 * @param id
 * @param {avnav.gui.FileInfo} info
 */
avnav.gui.Downloadpage.prototype.displayInfo=function(id,info){
    $('#'+this.idPrefix+id).find('.avn_download_listdate').text(this.formatter.formatDateTime(new Date(info.time*1000)));
    $('#'+this.idPrefix+id).find('.avn_download_listinfo').text(info.name);

};

avnav.gui.Downloadpage.prototype.sort=function(a,b) {
    try {
        if (a.time == b.time) return 0;
        if (a.time < b.time) return 1;
        return -1;
    } catch (err) {
        return 0;
    }
};

avnav.gui.Downloadpage.prototype.updateDisplay=function(){
    var self=this;
    $("."+this.visibleListEntryClass).remove();
    var id;
    var infos=this.files;
    infos.sort(this.sort);
    for (id=0;id<infos.length;id++){
        $('#avi_download_list_template').clone()
            .attr("downloadId",id)
            .attr("id",this.idPrefix+id)
            .addClass(this.visibleListEntryClass)
            .show()
            .insertAfter('.avn_download_list_entry:last');
        this.displayInfo(id,infos[id]);

        $('#' + this.idPrefix + id).find('.avn_download_btnDelete').on('click', null, {id: id}, function (ev) {
            ev.preventDefault();
            var lid = ev.data.id;
            var name = self.files[lid].name;
            var ok = confirm("delete " + self.files[lid].type + " " + name + "?");
            if (ok) {
                self.sendDelete(self.files[lid]);
                self.fillData(false);
            }
            return false;
        });

        $('#'+this.idPrefix+id).find('.avn_download_btnDownload').on('click',null,{id:id},function(ev){
            ev.preventDefault();
            var lid=ev.data.id;
            var info=undefined;
            try {
                info=self.files[lid];
            }catch(e){}
            if (info){
                self.download(info.name);
            }

        });
    }

};

avnav.gui.Downloadpage.prototype.fillData=function(initial){
    var self=this;
    this.files=[];
    if (!this.gui.properties.getProperties().connectedMode) {{
        this.updateDisplay();
        return;
    }};
    var url = self.gui.properties.getProperties().navUrl + "?request=listdir&type="+this.type;
    $.ajax({
        url: url,
        cache: false,
        dataType: 'json',
        contentType: "application/json; charset=utf-8",
        timeout: 10000,
        success: function(data){
            if (data.status && data.status != 'OK'){
                alert("unable to load list of "+self.type+" from server: "+data.status);
                self.updateDisplay();
                return;
            }
            var i;
            for (i=0;i<data.items.length;i++){
                var fi=new avnav.gui.FileInfo();
                avnav.assign(fi,data.items[i]);
                self.files.push(fi);
            }
            self.updateDisplay();
        },
        error:function(err){
            alert("unable to load list of "+self.type+" from server: "+err.statusText);
            self.updateDisplay();
        }
    });

};

avnav.gui.Downloadpage.prototype.download=function(name) {
    log("download");
    if (!name || name == "") return;
    if (this.gui.properties.getProperties().connectedMode) {
        var f = $('#avi_download_downloadform')
            .attr('action', this.gui.properties.getProperties().navUrl + "/" + encodeURIComponent(name));
        $(f).find('input[name="name"]').val(name);
        $(f).find('input[name="type"]').val(this.type);
        $(f).submit();
    }
};

avnav.gui.Downloadpage.prototype.directUpload=function(file) {
    self=this;
    var url = self.gui.properties.getProperties().navUrl + "?request=upload&type="+this.type+"&filename=" + encodeURIComponent(file.name);
    $('#avi_download_progess').show();
    avnav.util.Helper.uploadFile(url, file, {
        self: self,
        starthandler: function(param,xhdr){
            param.self.xhdr=xhdr;
        },
        errorhandler: function (param, err) {
            $('#avi_download_progess').hide();
            param.self.xhdr=undefined;
            alert("upload failed: " + err.responseText||err.statusText);
        },
        progresshandler: function (param, ev) {
            if (ev.lengthComputable) {
                //TODO: update progress bar
                log("progress called");
            }
        },
        okhandler: function (param, data) {
            param.self.xhdr=undefined;
            $('#avi_download_progess').hide();
            param.self.fillData(false);
        }
    });
};

avnav.gui.Downloadpage.prototype.sendDelete=function(info){
    var rname=info.name;
    var self=this;
    var url = self.gui.properties.getProperties().navUrl + "?request=delete&type="+this.type+"&name="+encodeURIComponent(rname);
    $.ajax({
        url: url,
        cache: false,
        dataType: 'json',
        contentType: "application/json; charset=utf-8",
        timeout: 10000,
        success: function(data){
            self.updateDisplay();
        },
        error:function(err){
            alert("unable to delete "+rname+": "+err.statusText);
            self.updateDisplay();
        }
    });
};

avnav.gui.Downloadpage.prototype.hidePage=function(){
    if (this.xhdr){
        alert("upload running");
    }
};

//-------------------------- Buttons ----------------------------------------


avnav.gui.Downloadpage.prototype.btnDownloadPageCancel=function (button,ev){
    log("Cancel clicked");
    this.gui.showPageOrReturn(this.returnpage,'mainpage');
};



avnav.gui.Downloadpage.prototype.btnDownloadPageUpload=function(button,ev){
    log("upload clicked");
    var i=$("#avi_download_uploadfile");
    $(i).click();
    return false;

};

avnav.gui.Downloadpage.prototype.btnDownloadPageDelete=function(button,ev){
    log("route delete all clicked");
    ok=confirm("delete all local routes on this device that are not on the server?");
    if (! ok) return;
    var i;
    var activeName=undefined;
    if (this.routingData.hasActiveRoute()){
        activeName=this.routingData.getRouteData().name;
    }
    var dname=$('#avi_route_name').val();
    for (i=0;i<this.routes.length;i++){
        if (this.routes[i].server) continue;
        if (activeName && this.routes[i].name == activeName) continue;
        if (this.loadedRoute && this.loadedRoute.name == this.routes[i].name) {
            this.loadedRoute=undefined;
            this.currentName=undefined;
        }
        this.routingData.deleteRoute(this.routes[i].name,undefined,true);
    }
    this.fillData(false);
};
/**
 * create the page instance
 */
(function(){
    //create an instance of the status page handler
    var page=new avnav.gui.Downloadpage();
}());

