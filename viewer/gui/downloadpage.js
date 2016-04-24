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
            if (! avnav.util.Helper.endsWith(file.name,".gemf")){
                alert("upload only for .gemf files");
                self.resetUpload();
                return;
            }
            var i;
            for (i=0;i<self.files.length;i++){
                var fname=self.files[i].name+".gemf";
                if (self.files[i].url && avnav.util.Helper.startsWith(self.files[i].url,"/gemf") && fname==file.name){
                    alert("file "+file.name+" already exists");
                    return;
                }
            }
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
    if (this.type == "chart"){
        $('#avi_download_page_listhead').text("Charts");
        if (avnav.android||this.gui.properties.getProperties().onAndroid) $('#avb_DownloadPageUpload').hide();
        else  $('#avb_DownloadPageUpload').show();
        this.handleToggleButton('#avb_DownloadPageTracks',false);
        this.handleToggleButton('#avb_DownloadPageCharts',true);
    }
    else {
        $('#avi_download_page_listhead').text("Tracks");
        $('#avb_DownloadPageUpload').hide();
        this.handleToggleButton('#avb_DownloadPageCharts',false);
        this.handleToggleButton('#avb_DownloadPageTracks',true);
    }
    if (!this.gui.properties.getProperties().connectedMode){
        $('#avb_DownloadPageUpload').hide();
    }
    this.fillData(true);
    this.hideProgress();
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
        if (this.gui.properties.getProperties().connectedMode ) {
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
        }
        else {
            $('#' + this.idPrefix + id).find('.avn_download_btnDelete').hide();
        }

        if (self.type == "track" || (infos[id].url && infos[id].url.match("^/gemf") && ! avnav.android) ) {
            $('#' + this.idPrefix + id).find('.avn_download_btnDownload').show();
            $('#' + this.idPrefix + id).find('.avn_download_btnDownload').on('click', null, {id: id}, function (ev) {
                ev.preventDefault();
                var lid = ev.data.id;
                var info = undefined;
                try {
                    info = self.files[lid];
                } catch (e) {
                }
                if (info) {
                    if (avnav.android){
                        if (info.type=="track") avnav.android.downloadTrack(info.name);
                    }
                    else {
                        if (info.type == "track") self.download(info.url ? info.url : info.name);
                        else self.download(info.name + ".gemf", info.url);
                    }
                }

            });
        }
        else {
            $('#' + this.idPrefix + id).find('.avn_download_btnDownload').hide();
        }
    }

};

avnav.gui.Downloadpage.prototype.fillData=function(initial){
    var self=this;
    this.files=[];
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
                self.files=[];
                self.updateDisplay();
                return;
            }
            self.files=[];
            var i;
            for (i=0;i<data.items.length;i++){
                var fi=new avnav.gui.FileInfo();
                avnav.assign(fi,data.items[i]);
                fi.type=self.type;
                self.files.push(fi);
            }
            self.updateDisplay();
        },
        error:function(err){
            alert("unable to load list of "+self.type+" from server: "+err.statusText);
            self.files=[];
            self.updateDisplay();
        }
    });

};

avnav.gui.Downloadpage.prototype.download=function(name,opt_url) {
    log("download");
    if (!name || name == "") return;

    var f = $('#avi_download_downloadform')
        .attr('action', this.gui.properties.getProperties().navUrl + "/" + encodeURIComponent(name));
    $(f).find('input[name="name"]').val(name);
    $(f).find('input[name="url"]').val(opt_url || "");
    $(f).find('input[name="type"]').val(this.type);
    $(f).submit();

};

avnav.gui.Downloadpage.prototype.directUpload=function(file) {
    self=this;
    var url = self.gui.properties.getProperties().navUrl + "?request=upload&type="+this.type+"&filename=" + encodeURIComponent(file.name);
    self.showProgress();
    avnav.util.Helper.uploadFile(url, file, {
        self: self,
        starthandler: function(param,xhdr){
            param.self.xhdr=xhdr;
        },
        errorhandler: function (param, err) {
            self.hideProgress();
            param.self.xhdr=undefined;
            alert("upload failed: " + err.statusText);
        },
        progresshandler: function (param, ev) {
            if (ev.lengthComputable) {
                var percentComplete = 100*ev.loaded / ev.total;
                $('#avi_download_progress_info').text(ev.loaded+"/"+ev.total);
                self.getDiv().find('.avn_progress_bar_done').css('width',percentComplete+"%");

            }
        },
        okhandler: function (param, data) {
            param.self.xhdr=undefined;
            param.self.hideProgress();
            param.self.fillData(false);
            setTimeout(function(){
                param.self.fillData(false);
            },1500);
        }
    });
};
/**
 * show the progress bar
 * @private
 * @param size
 */
avnav.gui.Downloadpage.prototype.showProgress=function(size){
    $('#avi_download_progress').show();
    $('#avi_download_progress_info').text("0/"+size);
    $('#avi_download_page_inner').addClass("avn_downloadpage_progress_visible");
};
/**
 * hide the progress bar
 * @private
 */
avnav.gui.Downloadpage.prototype.hideProgress=function() {
    $('#avi_download_progress').hide();
    $('#avi_download_page_inner').removeClass("avn_downloadpage_prohidegress_visible");
};


avnav.gui.Downloadpage.prototype.sendDelete=function(info){
    var rname=info.name;
    var self=this;
    var url = self.gui.properties.getProperties().navUrl + "?request=delete&type="+self.type;
    url+="&name="+encodeURIComponent(rname);
    if (self.type == "chart"){
        url+="&url="+encodeURIComponent(info.url);
    }

    $.ajax({
        url: url,
        cache: false,
        dataType: 'json',
        contentType: "application/json; charset=utf-8",
        timeout: 10000,
        success: function(data){
            self.fillData();
            if (self.type =="track"){
                self.gui.navobject.resetTrack(); //this could be our own track - just ensure that we reload from server
                                                 //we do this lazy to ensure that first the server deleted
            }
        },
        error:function(err){
            alert("unable to delete "+rname+": "+err.statusText);
            self.fillData();
        }
    });
};

avnav.gui.Downloadpage.prototype.hidePage=function(){
    this.abortUpload();
};

avnav.gui.Downloadpage.prototype.abortUpload=function(){
    if (this.xhdr){
        this.xhdr.abort();
    }
    this.hideProgress();
};


//-------------------------- Buttons ----------------------------------------


avnav.gui.Downloadpage.prototype.btnDownloadPageUpload=function(button,ev){
    log("upload clicked");
    var i=$("#avi_download_uploadfile");
    $(i).click();
    return false;

};

avnav.gui.Downloadpage.prototype.btnDownloadPageRoutes=function(button,ev){
    this.gui.showPage('routepage',{fromdownload:true})
};
avnav.gui.Downloadpage.prototype.btnDownloadPageTracks=function(button,ev){
    this.showPage({downloadtype:"track"});
};
avnav.gui.Downloadpage.prototype.btnDownloadPageCharts=function(button,ev){
    this.showPage({downloadtype:"chart"});
};
avnav.gui.Downloadpage.prototype.btnDownloadPageUploadCancel=function(button,ev){
    this.abortUpload();
};


/**
 * create the page instance
 */
(function(){
    //create an instance of the status page handler
    var page=new avnav.gui.Downloadpage();
}());

