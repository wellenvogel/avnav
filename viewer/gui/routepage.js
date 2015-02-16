/**
 * Created by andreas on 02.05.14.
 */
avnav.provide('avnav.gui.Routepage');




/**
 *
 * @constructor
 */
avnav.gui.Routepage=function(){
    avnav.gui.Page.call(this,'routepage');
    this.MAXUPLOADSIZE=100000;
    /**
     * the class that is assigned to visible routing entries
     * @type {string}
     */
    this.visibleListEntryClass="avn_route_visible_entry";
    /**
     * @private
     * @type {avnav.nav.RouteData}
     */
    this.routingData=undefined;
    /**
     * @private
     * @type {avnav.util.Formatter}
     */
    this.formatter=new avnav.util.Formatter();
    /**
     *
     * @type {Array:avnav.nav.RouteInfo}
     */
    this.routes=[];

    /**
     * the name of the current route (when the page is loaded)
     * @type {undefined}
     */
    this.currentName=undefined;
    /**
     * if we loaded a route we will keep it here and set this as editing
     * when we leave
     * @type {avnav.nav.Route}
     */
    this.loadedRoute=undefined;
    /**
     * count the number of local routes
     * @type {number}
     */
    this.numLocalRoutes=0;
    /**
     * set this to directly upload (only if we are connected)
     * this will be used if we do not have the FileReader (e.g. safari on windows)
     * @type {boolean}
     */
    this.fallbackUpload=false;
    /**
     * set true if called from download page
     * @type {boolean}
     */
    this.fromdownload=false;
    var self=this;
    $(document).on(avnav.nav.NavEvent.EVENT_TYPE, function(ev,evdata){
        self.navEvent(evdata);
    });
};
avnav.inherits(avnav.gui.Routepage,avnav.gui.Page);

avnav.gui.Routepage.prototype.resetUpload=function(){
    $('#avi_route_uploadfile').replaceWith($('#avi_route_uploadfile').clone(true));
};
avnav.gui.Routepage.prototype.localInit=function(){
    if (! this.gui) return;
    this.routingData=this.gui.navobject.getRoutingData();
    var self=this;
    $('#avi_route_name').keypress(function( event ) {
        if (event.which == 13) {
            event.preventDefault();
            self.btnRoutePageOk();
        }
    });

    $('#avi_route_uploadform').submit(function(form){
       alert("upload file");
    });
    $('#avi_route_uploadfile').on('change',function(ev){
        ev.preventDefault();
        if (this.files && this.files.length > 0){
            var file=this.files[0];
            self.resetUpload();
            if (file.name.indexOf(".gpx",file.name.length-4) == -1){
                alert("only .gpx routes");
                return false;
            }
            var rname=file.name.replace(".gpx","");
            if (file.size){
               if (file.size > self.MAXUPLOADSIZE){
                   alert("file is to big, max allowed: "+self.MAXUPLOADSIZE);
                   return;
               }
            }
            if (! window.FileReader){
                if (! self.fallbackUpload) {
                    alert("your browser does not support FileReader, cannot upload")
                    return;
                }
                self.directUpload(file);
                return;
            }
            var reader=new FileReader();
            reader.onloadend=function() {
                var xml=reader.result;
                if (! xml){
                    alert("unable to load file "+file.name);
                    return;
                }
                var route=undefined;
                try {
                    route=new avnav.nav.Route("");
                    route.fromXml(xml);
                } catch(e){
                    alert("unable to parse route from "+file.name+", error: "+ e);
                    return;
                }
                if (! route.name || route.name == ""){
                    alert("route from "+file.name+" has no route name");
                    return;
                }
                var i;
                for (i = 0; i < self.routes.length; i++) {
                    if (self.routes[i].name == route.name) {
                        alert("route with name " + route.name +" in file "+rname + " already exists");
                        return false;
                    }
                }
                if (self.gui.properties.getProperties().connectedMode) route.server=true;
                self.routingData.saveRoute(route,true);
                self.fillData(false);
            };
            reader.readAsText(file);
        }
        return false;
    });
};
avnav.gui.Routepage.prototype.showPage=function(options) {
    if (!this.gui) return;
    this.fallbackUpload=false;
    if (! window.FileReader){
        if (!this.gui.properties.getProperties().connectedMode){
            $('#avb_RoutePageUpload').hide();
        }
        else {
            this.fallbackUpload=true;
            $('#avb_RoutePageUpload').show();
        }
    }
    if (options && options.fromdownload){
        this.fromdownload=true;
        this.getDiv().find(".avn_routepage_optional").show();
        this.getDiv().find("#avb_RoutePageOk").hide();
        this.handleToggleButton("#avb_RoutePageRoutes",true);
    }
    else {
        this.fromdownload=false;
        this.getDiv().find(".avn_routepage_optional").hide();
        this.getDiv().find("#avb_RoutePageOk").show();
    }
    this.fillData(true);
};
/**
 * find a route info in the list and return the index
 * @param routeInfo
 * @returns -1 if not found
 */
avnav.gui.Routepage.prototype.findRouteInfo=function(routeInfo){
    var i;
    for (i=0;i<this.routes.length;i++){
        if (this.routes[i].name == routeInfo.name) return i;
    }
    return -1;
};

avnav.gui.Routepage.prototype.displayInfo=function(id,routeInfo){
    $('#routeInfo-'+id).find('.avn_route_listdate').text(this.formatter.formatDateTime(new Date(routeInfo.time)));
    $('#routeInfo-'+id).find('.avn_route_listinfo').text(routeInfo.name+", "+this.formatter.formatDecimal(routeInfo.length,4,2)+
        " nm, "+routeInfo.numpoints+" points");
    if (routeInfo.server) {
        $('#routeInfo-' + id).find('.avn_route_listrasimage').show();
    }
    else {
        $('#routeInfo-' + id).find('.avn_route_listrasimage').hide();
    }
};

avnav.gui.Routepage.prototype.sort=function(a,b) {
    try {
        if (a.time == b.time) return 0;
        if (a.time < b.time) return 1;
        return -1;
    } catch (err) {
        return 0;
    }
};
/**
 * add routes to the list
 * @param routeInfos
 */
avnav.gui.Routepage.prototype.addRoutes=function(routeInfos){
    var i,curid;
    var self=this;
    for (i=0;i<routeInfos.length;i++) {
        curid = this.findRouteInfo(routeInfos[i]);
        if (curid >= 0) {
            //a second one will always update...
            this.routes[curid] = routeInfos[i];
            continue;
        }
        this.routes.push(routeInfos[i]);
    }
    this.routes.sort(this.sort);
};
avnav.gui.Routepage.prototype.updateDisplay=function(){
    var self=this;
    this.numLocalRoutes=0;
    $('#avi_route_name').val(this.currentName);
    $("."+this.visibleListEntryClass).remove();
    var activeName=undefined;
    if (this.routingData.hasActiveRoute()){
        activeName=this.routingData.getRouteData().name;
    }
    var id;
    var routeInfos=this.routes;
    for (id=0;id<this.routes.length;id++){
        $('#avi_route_list_template').clone()
            .attr("routeId",id)
            .attr("id","routeInfo-"+id)
            .attr("routeidx",id)
            .addClass(this.visibleListEntryClass)
            .show()
            .insertAfter('.avn_route_list_entry:last');
        this.displayInfo(id,routeInfos[id]);
        if (!this.routes[id].server) this.numLocalRoutes++;
        if (this.currentName && routeInfos[id].name == this.currentName){
            $('#routeInfo-'+id).find('.avn_route_liststatimage').addClass("avn_route_current");
        }
        if ((activeName && activeName == routeInfos[id].name) || (!this.gui.properties.getProperties().connectedMode && routeInfos[id].server)){
            if (activeName && activeName == routeInfos[id].name) {
                $('#routeInfo-' + id).find('.avn_route_liststatimage').addClass("avn_route_active").removeClass("avn_route_current");
            }
            $('#routeInfo-' + id).find('.avn_route_btnDelete').hide();
        }
        else {
            $('#routeInfo-' + id).find('.avn_route_btnDelete').on('click', null, {id: id}, function (ev) {
                ev.preventDefault();
                var lid = ev.data.id;
                var name = self.routes[lid].name;
                //the current route could have changed...
                if (self.routingData.hasActiveRoute() && self.routingData.getRouteData().name == name){
                    alert("cannot delete active route");
                    self.fillData(false);
                    return false;
                }
                var ok = confirm("delete route " + name + "?");
                if (ok) {
                    self.routingData.deleteRoute(name, function (info) {
                        alert("failed to delete route " + name + " on server: " + info);
                    });
                    if (name == self.currentName) {
                        self.currentName = undefined;
                    }
                    if (self.loadedRoute && name == self.loadedRoute.name) self.loadedRoute=undefined;
                    self.fillData(false);

                }
                return false;
            });
        }
        $('#routeInfo-'+id).on('click',null,{id:id},function(ev){
            ev.preventDefault();
            var lid=ev.data.id;
            var rtinfo=undefined;
            try {
                rtinfo=self.routes[lid];
            }catch(e){}
            if (rtinfo){
                var name=rtinfo.name;
                self.routingData.fetchRoute(name,!rtinfo.server,
                    function(route){
                        self.loadedRoute=route;
                        self.fillData(false);
                        //self.gui.showPageOrReturn(this.returnpage,'navpage',{showRouting:true});
                    },
                    function(err){
                        alert("unable to load route "+name+": "+err);
                    }
                );

            }

        });
    }
    if (this.numLocalRoutes && this.gui.properties.getProperties().connectedMode){
        $('#avb_RoutePageDelete').show();
    }
    else {
        $('#avb_RoutePageDelete').hide();
    }
};

avnav.gui.Routepage.prototype.fillData=function(initial){
    this.currentName=undefined;
    if (initial) this.loadedRoute=undefined;
    if (this.loadedRoute){
        this.currentName=this.loadedRoute.name;
    }
    else {
        if (this.routingData.getEditingRoute()) this.currentName = this.routingData.getEditingRoute().name;
    }
    this.routes=[];
    var localRoutes=this.routingData.listRoutesLocal();
    this.addRoutes(localRoutes);
    this.updateDisplay();
    this.routingData.listRoutesServer(
        function(routingInfos,param){
            param.self.addRoutes(routingInfos);
            param.self.updateDisplay();
        },
        function(err,param){
            alert("unable to load routes from server: "+err);
        },
        { self:this}
    );
};

avnav.gui.Routepage.prototype.directUpload=function(file) {
    self=this;
    var url = self.gui.properties.getProperties().navUrl + "?request=upload&type=route&filename=" + encodeURIComponent(file.name);
    avnav.util.Helper.uploadFile(url, file, {
        self: self,
        errorhandler: function (param, err) {
            alert("route upload failed: " + err.statusText);
        },
        progresshandler: function (param, ev) {
            if (ev.lengthComputable) {
                log("progress called");
            }
        },
        okhandler: function (param, data) {
            param.self.fillData(false);
        }
    });
};


avnav.gui.Routepage.prototype.hidePage=function(){

};
/**
 *
 * @param {avnav.nav.NavEvent} ev
 */
avnav.gui.Routepage.prototype.navEvent=function(ev){
    if (! this.visible) return;

};
//-------------------------- Buttons ----------------------------------------

avnav.gui.Routepage.prototype.btnRoutePageOk=function (button,ev){
    var name=$('#avi_route_name').val();
    var i;
    //if the name has been changed in the edit box
    //it must be different from any loaded route
    if (name != this.currentName) {
        for (i = 0; i < this.routes.length; i++) {
            if (name == this.routes[i].name) {
                alert("route with name " + name + " already exists");
                return;
            }
        }
    }
    if (this.loadedRoute){
        this.routingData.setNewEditingRoute(this.loadedRoute);
        if (name && name != "" && name != this.loadedRoute.name){
            this.routingData.changeRouteName(name,!this.gui.properties.getProperties().connectedMode);
        }
    }
    else {
        if (name && name != "") {
            this.routingData.changeRouteName(name,!this.gui.properties.getProperties().connectedMode);
        }
    }
    this.gui.showPageOrReturn(this.returnpage,'navpage',{showRouting:true});
    log("Route OK clicked");
};

avnav.gui.Routepage.prototype.btnRoutePageCancel=function (button,ev){
    log("Cancel clicked");
    this.gui.showPageOrReturn(this.returnpage,'navpage',{showRouting:true});
};

avnav.gui.Routepage.prototype.btnRoutePageDownload=function(button,ev){
    log("route download clicked");
    var route;
    if (this.loadedRoute){
        route=this.loadedRoute.clone();
    }
    else {
        route=this.routingData.getEditingRoute().clone();
    }
    if (! route) return;
    var name=$('#avi_route_name').val();
    if (! name || name == "") return;
    if (name != route.name) {
        //if we apply a new name this route is not any longer a server route...
        route.name = name;
        route.server=false;
    }
    if (route.server){
        //nice simple case:
        //we can ask the server directly to send us the route
        //we assume that the route is always up to date at the server
        //and we can use a simple get request
        var f = $('#avi_route_downloadform')
            .attr('action', this.gui.properties.getProperties().navUrl + "/" + encodeURIComponent(name + ".gpx"));
        $(f).attr('method','get');
        $(f).find('input[name="name"]').val(name);
        $(f).find('input[name="_json"]').val("");
        $(f).submit();
        return false;
    }
    if (this.gui.properties.getProperties().connectedMode) {
        //in connected mode we upload the route and ask the server to send it back
        //this will work in all browsers
        var f = $('#avi_route_downloadform')
            .attr('action', this.gui.properties.getProperties().navUrl + "/" + encodeURIComponent(name + ".gpx"));
        $(f).attr('method','post');
        $(f).find('input[name="_json"]').val(route.toJsonString());
        $(f).find('input[name="name"]').val("");
        //$(f).find('input[name="filename"]').val(route.name+".gpx");
        $(f).submit();

    }
    else {
        //this local download is the last resort if it is neither a server route nbor we are connected
        var xmlroute=route.toXml();
        var datauri="data:application/octet-stream;base64,"+btoa(xmlroute);
        $('#avi_route_localdownload').attr('href',datauri);
        $('#avi_route_localdownload').attr('download',unescape(encodeURIComponent(route.name+".gpx")));
        $('#avi_route_localdownload span').click();
    }
    return false;
};

avnav.gui.Routepage.prototype.btnRoutePageUpload=function(button,ev){
    log("route upload clicked");
    var i=$("#avi_route_uploadfile");
    $(i).click();
    return false;

};

avnav.gui.Routepage.prototype.btnRoutePageDelete=function(button,ev){
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

avnav.gui.Routepage.prototype.btnRoutePageTracks=function(button,ev) {
    log("route tracks clicked");
    this.gui.showPage("downloadpage",{downloadtype:"track"});
};

avnav.gui.Routepage.prototype.btnRoutePageCharts=function(button,ev) {
    log("route tracks clicked");
    this.gui.showPage("downloadpage",{downloadtype:"chart"});
};
/**
 * create the page instance
 */
(function(){
    //create an instance of the status page handler
    var page=new avnav.gui.Routepage();
}());

