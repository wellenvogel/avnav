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
    this.MAXUPLOADSIZE=100000; //for tracks and routes
    /**
     * the class that is assigned to visible routing entries
     * @type {string}
     */
    this.visibleListEntryClass="avn_download_visible_entry";
    this.activeListEntryClass="avn_download_active_entry";

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
     * @type {string} - track, chart,route
     */
    this.type="track";

    /**
     * translates the type into a headline
     * @type {{track: string, chart: string}}
     */
    this.headlines={
        track: "Tracks",
        chart: "Charts",
        route: "Routes"
    };

    /**
     * if set - a running upload
     * @type {Xhdr}
     */
    this.xhdr=undefined;
    /**
     * @private
     * @type {avnav.nav.RouteData}
     */
    this.routingData=undefined;
    /**
     * allow to change the type of data we show
     * @private
     * @type {boolean}
     */
    this.allowChange=true;

    /**
     * set a callback that should be executed when selecting an item
     * parameter will be the item info
     * @private
     * @type {function}
     */
    this.selectItemCallback=undefined;

};
avnav.inherits(avnav.gui.Downloadpage,avnav.gui.Page);

avnav.gui.Downloadpage.prototype.resetUpload=function(){
    $('#avi_download_uploadfile').replaceWith($('#avi_download_uploadfile').clone(true));
};

avnav.gui.Downloadpage.prototype.uploadChart=function(fileObject){
    if (fileObject.files && fileObject.files.length > 0) {
        var file = fileObject.files[0];
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

};
/**
 * route upload
 * this will also work if we are not connected - we try a loacl load using file reader
 * @param fileObject
 * @returns {boolean}
 */
avnav.gui.Downloadpage.prototype.uploadRoute=function(fileObject){
    var self=this;
    if (fileObject.files && fileObject.files.length > 0) {
        var file = fileObject.files[0];
        self.resetUpload();
        if (file.name.indexOf(".gpx", file.name.length - 4) == -1) {
            alert("only .gpx routes");
            return false;
        }
        var rname = file.name.replace(".gpx", "");
        if (file.size) {
            if (file.size > self.MAXUPLOADSIZE) {
                alert("file is to big, max allowed: " + self.MAXUPLOADSIZE);
                return;
            }
        }
        if (!window.FileReader) {
            if (!self.fallbackUpload) {
                alert("your browser does not support FileReader, cannot upload");
                return;
            }
            self.directUpload(file);
            return;
        }
        var reader = new FileReader();
        reader.onloadend = function () {
            var xml = reader.result;
            if (!xml) {
                alert("unable to load file " + file.name);
                return;
            }
            var route = undefined;
            try {
                route = new avnav.nav.Route("");
                route.fromXml(xml);
            } catch (e) {
                alert("unable to parse route from " + file.name + ", error: " + e);
                return;
            }
            if (!route.name || route.name == "") {
                alert("route from " + file.name + " has no route name");
                return;
            }
            if (self.findFileInfo(route) >= 0) {
                alert("route with name " + route.name + " in file " + rname + " already exists");
                return false;
            }
            if (self.gui.properties.getProperties().connectedMode) route.server = true;
            self.routingData.saveRoute(route, function () {
                self.fillData(false);
            });

        };
        reader.readAsText(file);
    }
};

avnav.gui.Downloadpage.prototype.localInit=function(){
    if (! this.gui) return;
    this.routingData=this.gui.navobject.getRoutingHandler();
    var self=this;

    $('#avi_download_uploadform').submit(function(form){
       alert("upload file");
    });
    $('#avi_download_uploadfile').on('change',function(ev){
        ev.preventDefault();
        if (self.type == "route"){
            self.uploadRoute(this);
            return false;
        }
        if (self.type == "chart"){
            self.uploadChart(this);
            return false;
        }
    });

};
avnav.gui.Downloadpage.prototype.showPage=function(options) {
    if (!this.gui) return;
    if(options && options.downloadtype){
        this.type=options.downloadtype;
    }
    if(options && options.allowChange !== undefined){
        this.allowChange=options.allowChange;
    }
    if(options && options.selectItemCallback !== undefined){
        this.selectItemCallback=options.selectItemCallback;
    }
    $('#avi_download_page_listhead').text(this.headlines[this.type]);
    if (this.type == "chart"){
        if (avnav.android||this.gui.properties.getProperties().onAndroid) this.selectOnPage('.avb_DownloadPageUpload').hide();
        else  this.selectOnPage('.avb_DownloadPageUpload').show();
        this.handleToggleButton('.avb_DownloadPageTracks',false);
        this.handleToggleButton('.avb_DownloadPageCharts',true);
        this.handleToggleButton('.avb_DownloadPageRoutes',false);
    }
    if (this.type == "track") {
        this.selectOnPage('.avb_DownloadPageUpload').hide();
        this.handleToggleButton('.avb_DownloadPageCharts',false);
        this.handleToggleButton('.avb_DownloadPageTracks',true);
        this.handleToggleButton('.avb_DownloadPageRoutes',false);
    }
    if (this.type == "route") {
        this.selectOnPage('.avb_DownloadPageUpload').show();
        this.handleToggleButton('.avb_DownloadPageCharts',false);
        this.handleToggleButton('.avb_DownloadPageTracks',false);
        this.handleToggleButton('.avb_DownloadPageRoutes',true);
    }
    if (!this.gui.properties.getProperties().connectedMode && this.type != "route"){
        this.selectOnPage('.avb_DownloadPageUpload').hide();
    }
    if ( this.allowChange){
        this.selectOnPage('.avn_changeDownload').show();
    }
    else{
        this.selectOnPage('.avn_changeDownload').hide();
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
    var timeText;
    if (info.type == "route"){
        timeText=this.formatter.formatDateTime(new Date(info.time));
    }
    else{
        timeText=this.formatter.formatDateTime(new Date(info.time*1000));
    }
    $('#'+this.idPrefix+id).find('.avn_download_listdate').text(timeText);
    var infoText=info.name;
    var showRas=false;
    if (info.type == "route"){
        infoText+=","+this.formatter.formatDecimal(info.length,4,2)+
            " nm, "+info.numpoints+" points";
        if (info.server) showRas=true;
    }
    $('#'+this.idPrefix+id).find('.avn_download_listinfo').text(infoText);
    if (showRas) $('#'+this.idPrefix+id).find('.avn_download_listrasimage').show();
    else  $('#'+this.idPrefix+id).find('.avn_download_listrasimage').hide();
};

avnav.gui.Downloadpage.prototype.sort = function (a, b) {
    try {
        if (a.time == b.time) return 0;
        if (a.time < b.time) return 1;
        return -1;
    } catch (err) {
        return 0;
    }
};

avnav.gui.Downloadpage.prototype._isActiveRoute=function(info){
    if (! info.type || info.type != "route") return false;
    var activeRoute=this.routingData.getRoute();
    if (!activeRoute) return false;
    return activeRoute.name == info.name;
};
avnav.gui.Downloadpage.prototype._updateDisplay=function(){
    var self=this;
    $("."+this.visibleListEntryClass).remove();
    var id;
    var infos=this.files;
    infos.sort(this.sort);
    for (id=0;id<infos.length;id++){
        var isActive=this._isActiveRoute(infos[id]);
        $('#avi_download_list_template').clone()
            .attr("downloadId",id)
            .attr("id",this.idPrefix+id)
            .addClass(this.visibleListEntryClass)
            .addClass(isActive?this.activeListEntryClass:"")
            .show()
            .insertAfter('.avn_download_list_entry:last');
        this.displayInfo(id,infos[id]);
        if (this.gui.properties.getProperties().connectedMode || (this.type == "route" && ! infos[id].server)) {
            $('#' + this.idPrefix + id).find('.avn_download_btnDelete').on('click', null, {id: id}, function (ev) {
                ev.preventDefault();
                var lid = ev.data.id;
                var name = self.files[lid].name;
                var ok = confirm("delete " + self.files[lid].type + " " + name + "?");
                if (ok) {
                    if (self.type != "route") {
                        self.sendDelete(self.files[lid]);
                    }
                    else{
                        if (self._isActiveRoute(self.files[lid])){
                            avnav.util.Overlay.Toast("unable to delete active route",5000);
                            return false;
                        }
                        self.routingData.deleteRoute(self.files[lid].name,
                            function(data){self.fillData(false);},
                            function(info){
                                avnav.util.Overlay.Toast("unable to delete route: "+info,5000);
                                self.fillData(false);
                            }
                        );
                    }
                    self.fillData(false);
                }
                return false;
            }).css('visibility','');
        }
        else {
            $('#' + this.idPrefix + id).find('.avn_download_btnDelete').css('visibility','hidden');
        }

        if (self.type == "track" || self.type == "route" || (infos[id].url && infos[id].url.match("^/gemf") && ! avnav.android) ) {
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
                        if (info.type == "route"){
                            self.routingData.fetchRoute(info.name,true,function(data){
                                    avnav.android.downloadRoute(data.toJsonString());
                            },
                            function(err){
                                avnav.util.Overlay.Toast("unable to get route "+info.name,5000);
                            });
                        }
                    }
                    else {
                        if (info.type == "track") self.download(info.url ? info.url : info.name);
                        else {
                            if (info.type == "route") {
                                if (info.server) self.download(info.name);
                                else{
                                    self.routingData.fetchRoute(info.name,true,function(data){
                                            self.download(info.name,undefined,data.toJsonString());
                                        },
                                        function(err){
                                            avnav.util.Overlay.Toast("unable to get route "+info.name,5000);
                                        });
                                }
                            }
                            else self.download(info.name + ".gemf", info.url);
                        }
                    }
                }

            });
        }
        else {
            $('#' + this.idPrefix + id).find('.avn_download_btnDownload').hide();
        }
        if (self.selectItemCallback){
            $('#' + this.idPrefix + id).on('click',null,{item:self.files[id]},function(ev){
                self.selectItemCallback(ev.data.item);
            });
        }
    }

};

avnav.gui.Downloadpage.prototype.fillData=function(initial){
    if (this.type != "route") return this.fillDataServer(initial);
    return this.fillDataRoutes(initial);
};
avnav.gui.Downloadpage.prototype.fillDataServer=function(initial){
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
                self._updateDisplay();
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
            self._updateDisplay();
        },
        error:function(err){
            alert("unable to load list of "+self.type+" from server: "+err.statusText);
            self.files=[];
            self._updateDisplay();
        }
    });

};
avnav.gui.Downloadpage.prototype.findFileInfo=function(info){
    var i;
    for (i=0;i<this.files.length;i++){
        if (this.files[i].name == info.name) return i;
    }
    return -1;
};

avnav.gui.Downloadpage.prototype.addRoutes = function (routeInfos) {
        var i, curid;
        var self = this;
        for (i = 0; i < routeInfos.length; i++) {
            curid = this.findFileInfo(routeInfos[i]);
            if (curid >= 0) {
                //a second one will always update...
                this.files[curid] = routeInfos[i];
                continue;
            }
            this.files.push(routeInfos[i]);
        }
};
avnav.gui.Downloadpage.prototype.fillDataRoutes=function(initial){
    this.files=[];
    var localRoutes=this.routingData.listRoutesLocal();
    this.addRoutes(localRoutes);
    this._updateDisplay();
    if (! this.gui.properties.getProperties().readOnlyServer) {
        this.routingData.listRoutesServer(
            function (routingInfos, param) {
                param.self.addRoutes(routingInfos);
                param.self._updateDisplay();
            },
            function (err, param) {
                alert("unable to load routes from server: " + err);
            },
            {self: this}
        );
    }
};


avnav.gui.Downloadpage.prototype.download=function(name,opt_url,opt_json) {
    avnav.log("download");
    if (!name || name == "") return;
    var filename=name;
    if (this.type == "route") filename+=".gpx";
    var f = $('#avi_download_downloadform')
        .attr('action', this.gui.properties.getProperties().navUrl + "/" + encodeURIComponent(filename));
    $(f).find('input[name="name"]').val(opt_json?"":name);
    $(f).find('input[name="url"]').val(opt_url || "");
    $(f).find('input[name="type"]').val(this.type);
    $(f).find('input[name="_json"]').val(opt_json?opt_json:"");
    $(f).submit();

};

avnav.gui.Downloadpage.prototype.directUpload=function(file) {
    var self=this;
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
    var rtop=$('#avi_download_progress').outerHeight();
    $('#avi_download_page_inner').css('bottom',rtop+"px");
};
/**
 * hide the progress bar
 * @private
 */
avnav.gui.Downloadpage.prototype.hideProgress=function() {
    $('#avi_download_progress').hide();
    $('#avi_download_page_inner').css('bottom','0px');
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
    avnav.log("upload clicked");
    var i=$("#avi_download_uploadfile");
    $(i).click();
    return false;

};

avnav.gui.Downloadpage.prototype.btnDownloadPageRoutes=function(button,ev){
    this.showPage({downloadtype:"route",skipHistory: true});
};
avnav.gui.Downloadpage.prototype.btnDownloadPageTracks=function(button,ev){
    this.showPage({downloadtype:"track",skipHistory: true});
};
avnav.gui.Downloadpage.prototype.btnDownloadPageCharts=function(button,ev){
    this.showPage({downloadtype:"chart",skipHistory: true});
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

