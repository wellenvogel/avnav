/**
 * Created by andreas on 02.05.14.
 */

var routeobjects=require('../nav/routeobjects');
var RouteHandler=require('../nav/routedata');
var OverlayDialog=require('../components/OverlayDialog.jsx');
var ItemUpdater=require('../components/ItemUpdater.jsx');
var ItemList=require('../components/ItemList.jsx');
var React=require('react');



var FileInfo=function(name,type,time){
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

var keys={
    type: 'type', //{value}
    downloadList: 'list', //{itemList,selectors}]
    upload: 'upload', //{upload:true|false,total,loaded}
    uploadForm: 'uploadForm' //counter
};
var selectors={
    active:'avn_download_active_entry'
};

/**
 *
 * @constructor
 */
var Downloadpage=function(){
    avnav.gui.Page.call(this,'downloadpage');
    this.MAXUPLOADSIZE=100000; //for tracks and routes
    /**
     * the class that is assigned to visible routing entries
     * @type {string}
     */
    this.visibleListEntryClass="avn_download_visible_entry";
    this.activeListEntryClass="avn_download_active_entry";

    /**
     * @private
     * @type {avnav.util.Formatter}
     */
    this.formatter=new avnav.util.Formatter();
    /**
     *
     * @type {Array:FileInfo}
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
     * @type {RouteHandler}
     */
    this.routingHandler=undefined;
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
    var self=this;
    $(document).on(avnav.gui.AndroidEvent.EVENT_TYPE,function(ev,evdata){
        if (evdata.key && avnav.util.Helper.startsWith(evdata.key,"route")){
            self._updateDisplay();
        }
    });

};
avnav.inherits(Downloadpage,avnav.gui.Page);

Downloadpage.prototype.resetUpload=function(){
    $('#avi_download_downloadform')[0].reset();
    this.store.storeData(keys.uploadForm, {count:(new Date()).getTime()})
};

Downloadpage.prototype.uploadChart=function(fileObject){
    var self=this;
    if (fileObject.files && fileObject.files.length > 0) {
        var file = fileObject.files[0];
        if (! avnav.util.Helper.endsWith(file.name,".gemf")){
            self.toast("upload only for .gemf files");
            self.resetUpload();
            return;
        }
        var i;
        for (i=0;i<self.files.length;i++){
            var fname=self.files[i].name+".gemf";
            if (self.files[i].url && avnav.util.Helper.startsWith(self.files[i].url,"/gemf") && fname==file.name){
                self.toast("file "+file.name+" already exists");
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
Downloadpage.prototype.uploadRoute=function(fileObject){
    var self=this;
    if (fileObject.files && fileObject.files.length > 0) {
        var file = fileObject.files[0];
        self.resetUpload();
        if (file.name.indexOf(".gpx", file.name.length - 4) == -1) {
            self.toast("only .gpx routes");
            return false;
        }
        var rname = file.name.replace(".gpx", "");
        if (file.size) {
            if (file.size > self.MAXUPLOADSIZE) {
                self.toast("file is to big, max allowed: " + self.MAXUPLOADSIZE);
                return;
            }
        }
        if (!window.FileReader) {
            if (!self.fallbackUpload) {
                self.toast("your browser does not support FileReader, cannot upload");
                self.resetUpload();
                return;
            }
            self.directUpload(file);
            return;
        }
        var reader = new FileReader();
        reader.onloadend = function () {
            var xml = reader.result;
            self.resetUpload();
            if (!xml) {
                self.toast("unable to load file " + file.name);
                return;
            }
            var route = undefined;
            try {
                route = new routeobjects.Route("");
                route.fromXml(xml);
            } catch (e) {
                self.toast("unable to parse route from " + file.name + ", error: " + e);
                return;
            }
            if (!route.name || route.name == "") {
                self.toast("route from " + file.name + " has no route name");
                return;
            }
            if (self.findFileInfo(route) >= 0) {
                self.toast("route with name " + route.name + " in file " + rname + " already exists");
                return false;
            }
            if (self.gui.properties.getProperties().connectedMode) route.server = true;
            self.routingHandler.saveRoute(route, function () {
                self.fillData(false);
            });

        };
        reader.readAsText(file);
    }
};

Downloadpage.prototype.localInit=function(){
    if (! this.gui) return;
    this.routingHandler=this.gui.navobject.getRoutingHandler();
    var self=this;

    $('#avi_download_uploadform').submit(function(form){
       self.toast("upload file");
    });
};

Downloadpage.prototype.startUpload=function(ev){
    ev.preventDefault();
    if (this.type == "route"){
        this.uploadRoute(ev.target);
        return false;
    }
    if (this.type == "chart"){
        this.uploadChart(ev.target);
        return false;
    }
};

Downloadpage.prototype.getPageContent=function(){
    var self=this;
    var buttons=[
        {key:'DownloadPageCharts',chart:true},
        {key:'DownloadPageTracks',track: true},
        {key:'DownloadPageRoutes',route:true},
        {key:'DownloadPageUpload',upload:true},
        {key:'Cancel'}
    ];
    this.store.storeData(this.globalKeys.buttons,{itemList:buttons});
    var HeadLine=ItemUpdater(React.createClass({
        render: function(){
                return <div className="avn_left_top"><div>{this.props.value}</div></div>
        }
    }),this.store,keys.type);
    //TODO: handle if (this.gui.properties.getProperties().connectedMode || (this.type == "route" && ! infos[id].server)) {
    var DownloadItem=function(props){
        var dp={};
        if (props.type == "route"){
            dp.timeText=self.formatter.formatDateTime(new Date(props.time));
        }
        else{
            dp.timeText=self.formatter.formatDateTime(new Date(props.time*1000));
        }
        dp.infoText=props.name;
        var showRas=false;
        if (props.type == "route"){
            dp.infoText+=","+self.formatter.formatDecimal(props.length,4,2)+
                " nm, "+props.numpoints+" points";
            if (props.server) showRas=true;
        }
        var showDownload=false;
        if (self.type == "track" || self.type == "route" || (props.url && props.url.match("^/gemf") && ! avnav.android) ) {
            showDownload=true;
        }
        var cls="avn_download_list_entry";
        if (props.active){
            cls+=" avn_download_active_entry";
        }
        return(
        <div className={cls} onClick={function(ev){
            if (self.selectItemCallback){
               self.selectItemCallback(props);
            }
        }}>
            {! props.active &&<button className="avn_download_btnDelete avn_smallButton" onClick={function(ev){
                ev.preventDefault();
                ev.stopPropagation();
                self.deleteItem(props);
            }}/>}
            <div className="avn_download_listdate">{dp.timeText}</div>
            <div className="avn_download_listinfo">{dp.infoText}</div>
            {showRas && <div className="avn_download_listrasimage"></div>}
            { showDownload && <button className="avn_download_btnDownload avn_smallButton" onClick={
                function(ev){
                    ev.stopPropagation();
                    ev.preventDefault();
                    self.downloadItem(props);
                }
            }/>}
        </div>
        );
    };
    var List=ItemUpdater(ItemList,this.store,keys.downloadList);
    var listProperties={
        onItemClick:function(item,opt_data){

        },
        itemClass:DownloadItem
    };
    var UploadIndicator=ItemUpdater(function(props){
        var percentComplete = props.total?100*props.loaded / props.total:0;
        if (! props.upload) return null;
        var doneStyle={
            width:percentComplete+"%"
        };
        return(
            <div className="avn_download_progress">
                <div className="avn_download_progress_container">
                    <div className="avn_download_progress_info">{props.loaded+"/"+props.total}</div>
                    <div className="avn_download_progress_display" >
                        <div className="avn_progress_bar_done" style={doneStyle}></div>
                    </div>
                </div>
                <button  className="avb_DownloadPageUploadCancel avn_button" onClick={function(){self.abortUpload();}}/>
            </div>
        );
    },this.store,keys.upload);
    var UploadForm=ItemUpdater(function(props){
        return(
            <form id="avi_download_uploadform" className="avn_hidden" method="post">
                <input type="file" id="avi_download_uploadfile" name="file" key={props.count} onChange={function(ev){
                            self.startUpload(ev);
                        }}/>
            </form>
        )
    },this.store,keys.uploadForm);
    return React.createClass({
        render: function () {
            return(
                <div className="avn_panel_fill_flex">
                    <HeadLine/>
                    <div className="avn_left_inner">
                        <List {...listProperties}/>
                    </div>
                    <form id="avi_download_downloadform" className="avn_hidden" method="get" >
                        <input type="hidden" name="name"/>
                        <input type="hidden" name="url"/>
                        <input type="hidden" name="request" value="download"/>
                        <input type="hidden" name="type" value="track"/>
                        <input type="hidden" name="_json" value=""/>
                    </form>
                    <UploadForm/>
                    <UploadIndicator/>
                </div>
            );
        }
    });
};
Downloadpage.prototype.showPage=function(options) {
    if (!this.gui) return;
    if(options && options.downloadtype){
        this.type=options.downloadtype;
    }
    if(options && options.allowChange !== undefined){
        this.allowChange=options.allowChange;
    }
    else{
        this.allowChange=true;
    }
    if(options && options.selectItemCallback !== undefined){
        this.selectItemCallback=options.selectItemCallback;
    }
    this.store.storeData(keys.type,{value:this.headlines[this.type]});
    var onAndroid=avnav.android||this.gui.properties.getProperties().onAndroid;
    var visibility={
        track:this.type == 'track'|| this.allowChange,
        route:this.type == 'route'|| this.allowChange,
        chart:this.type == 'chart'|| this.allowChange,
        upload:this.type == 'route'|| (this.type == 'chart' && ! onAndroid && this.gui.properties.getProperties().connectedMode)
    };
    this.changeButtonVisibilityFlag(visibility);
    var toggles={
        DownloadPageTracks: this.type == 'track',
        DownloadPageCharts: this.type == 'chart',
        DownloadPageRoutes: this.type == 'route'
    };

    this.handleToggleButton(toggles);
    this.fillData(true);
    this.hideProgress();
};



Downloadpage.prototype.sort = function (a, b) {
    try {
        if (a.time == b.time) return 0;
        if (a.time < b.time) return 1;
        return -1;
    } catch (err) {
        return 0;
    }
};

Downloadpage.prototype.deleteItem=function(info){
    var self=this;
    var ok = OverlayDialog.confirm("delete " + info.type + " " + info.name + "?",self.getDialogContainer());
    ok.then(function() {
        if (info.type != "route") {
            self.sendDelete(info);
        }
        else{
            if (self._isActiveRoute(info)){
                self.toast("unable to delete active route",true);
                return false;
            }
            self.routingHandler.deleteRoute(info.name,
                function(data){self.fillData(false);},
                function(rinfo){
                    self.toast("unable to delete route: "+rinfo,true);
                    self.fillData(false);
                },
                !info.server //if we think this is a local route - just delete it local only
            );
        }
        self.fillData(false);
    });
    ok.catch(function(err){
        avnav.log("delete canceled");
    });
};

Downloadpage.prototype.downloadItem=function(info){
    var self=this;
    if (info) {
        if (avnav.android) {
            if (info.type == "track") avnav.android.downloadTrack(info.name);
            if (info.type == "route") {
                self.routingHandler.fetchRoute(info.name, !info.server, function (data) {
                        avnav.android.downloadRoute(data.toJsonString());
                    },
                    function (err) {
                        self.toast("unable to get route " + info.name, true);
                    });
            }
        }
        else {
            if (info.type == "track") self.download(info.url ? info.url : info.name);
            else {
                if (info.type == "route") {
                    if (info.server) self.download(info.name);
                    else {
                        self.routingHandler.fetchRoute(info.name, true, function (data) {
                                self.download(info.name, undefined, data.toJsonString());
                            },
                            function (err) {
                                self.toast("unable to get route " + info.name, true);
                            });
                    }
                }
                else self.download(info.name + ".gemf", info.url);
            }
        }
    }
};

Downloadpage.prototype._isActiveRoute=function(info){
    if (! info.type || info.type != "route") return false;
    var activeRoute=this.routingHandler.getRoute();
    if (!activeRoute) return false;
    return activeRoute.name == info.name;
};
Downloadpage.prototype._updateDisplay=function(){
    var self=this;
    var id;
    var infos=this.files;
    infos.sort(this.sort);
    var itemList=[];
    for (id=0;id<infos.length;id++){
        var isActive=this._isActiveRoute(infos[id]);
        var item=avnav.assign({},infos[id],{active:isActive,key:infos[id].name});
        itemList.push(item);
    }
    self.store.replaceSubKey(keys.downloadList,itemList,'itemList');
};

Downloadpage.prototype.fillData=function(initial){
    if (this.type != "route") return this.fillDataServer(initial);
    return this.fillDataRoutes(initial);
};
Downloadpage.prototype.fillDataServer=function(initial){
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
                self.toast("unable to load list of "+self.type+" from server: "+data.status);
                self.files=[];
                self._updateDisplay();
                return;
            }
            self.files=[];
            var i;
            for (i=0;i<data.items.length;i++){
                var fi=new FileInfo();
                avnav.assign(fi,data.items[i]);
                fi.type=self.type;
                self.files.push(fi);
            }
            self._updateDisplay();
        },
        error:function(err){
            self.toast("unable to load list of "+self.type+" from server: "+err.statusText);
            self.files=[];
            self._updateDisplay();
        }
    });

};
Downloadpage.prototype.findFileInfo=function(info){
    var i;
    for (i=0;i<this.files.length;i++){
        if (this.files[i].name == info.name) return i;
    }
    return -1;
};

Downloadpage.prototype.addRoutes = function (routeInfos) {
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
Downloadpage.prototype.fillDataRoutes=function(initial){
    var self=this;
    this.files=[];
    var localRoutes=this.routingHandler.listRoutesLocal();
    this.addRoutes(localRoutes);
    this._updateDisplay();
    if (! this.gui.properties.getProperties().readOnlyServer) {
        this.routingHandler.listRoutesServer(
            function (routingInfos, param) {
                param.self.addRoutes(routingInfos);
                param.self._updateDisplay();
            },
            function (err, param) {
                self.toast("unable to load routes from server: " + err);
            },
            {self: this}
        );
    }
};


Downloadpage.prototype.download=function(name,opt_url,opt_json) {
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

Downloadpage.prototype.directUpload=function(file) {
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
            self.toast("upload failed: " + err.statusText);
        },
        progresshandler: function (param, ev) {
            if (ev.lengthComputable) {
                self.store.storeData(keys.upload,avnav.assign({},self.store.getData(keys.upload),{
                    upload:true,
                    total:ev.total,
                    loaded: ev.loaded
                }));
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
Downloadpage.prototype.showProgress=function(size){
    this.store.storeData(keys.upload,{upload:true,total:size,loaded:0});
};
/**
 * hide the progress bar
 * @private
 */
Downloadpage.prototype.hideProgress=function() {
   this.store.storeData(keys.upload,{upload:false});
};


Downloadpage.prototype.sendDelete=function(info){
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
            self.toast("unable to delete "+rname+": "+err.statusText);
            self.fillData();
        }
    });
};

Downloadpage.prototype.hidePage=function(){
    this.abortUpload();
};

Downloadpage.prototype.abortUpload=function(){
    if (this.xhdr){
        this.xhdr.abort();
    }
    this.hideProgress();
};


//-------------------------- Buttons ----------------------------------------


Downloadpage.prototype.btnDownloadPageUpload=function(button,ev){
    avnav.log("upload clicked");
    if (this.type == 'route'){
        if (avnav.android){
            avnav.android.uploadRoute();
            return false;
        }
    }
    var i=$("#avi_download_uploadfile");
    $(i).click();
    return false;

};

Downloadpage.prototype.btnDownloadPageRoutes=function(button,ev){
    if (this.type == 'route') return;
    this.showPage({downloadtype:"route",skipHistory: true});
};
Downloadpage.prototype.btnDownloadPageTracks=function(button,ev){
    if (this.type == 'track') return;
    this.showPage({downloadtype:"track",skipHistory: true});
};
Downloadpage.prototype.btnDownloadPageCharts=function(button,ev){
    if (this.type == 'chart') return;
    this.showPage({downloadtype:"chart",skipHistory: true});
};


/**
 * create the page instance
 */
(function(){
    //create an instance of the status page handler
    var page=new Downloadpage();
}());

