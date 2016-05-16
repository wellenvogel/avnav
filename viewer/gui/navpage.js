/**
 * Created by andreas on 02.05.14.
 */
avnav.provide('avnav.gui.Navpage');



/**
 *
 * @constructor
 * @extends {avnav.gui.Page}
 */
avnav.gui.Navpage=function(){
    avnav.gui.Page.call(this,'navpage');
    /** @private */
    this.options_=null;
    /**
     * the current visible overlay (jQuery object)
     * @type {null}
     */
    this.overlay=null;
    /**
     * the time (in ms) when the current overlay should be hidden
     * @type {number}
     */
    this.hidetime=0;
    /**
     * the dom id of the map
     * @private
     * @type {string}
     */
    this.mapdom='avi_map_navpage';
    var self=this;
    /**
     * @private
     * @type {boolean}
     */
    this.routingVisible=false;
    /**
     * keep the lock mode when showing routing
     * @private
     * @type {boolean}
     */
    this.lastGpsLock=false;

    /**
     * load chart when showing first
     * @type {boolean}
     */
    this.firstShow=true;


    /**
     * @private
     * @type {avnav.nav.Route}
     */
    this.lastRoute=new avnav.nav.Route("");
    /**
     * @private
     * @type {avnav.util.Formatter}
     */
    this.formatter=new avnav.util.Formatter();
    $(document).on(avnav.nav.NavEvent.EVENT_TYPE, function(ev,evdata){
       self.navEvent(evdata);
    });
    $(document).on(avnav.map.MapEvent.EVENT_TYPE, function(ev,evdata){
        self.mapEvent(evdata);
    });
    $(document).on(avnav.util.PropertyChangeEvent.EVENT_TYPE,function(){
        self.updateMainPanelSize('#'+self.mapdom);
    });
    $(window).on('resize',function(){
       self.updateLayout();
    });

};
avnav.inherits(avnav.gui.Navpage,avnav.gui.Page);

/**
 * get the mapholder
 * @private
 * @returns {avnav.map.MapHolder}
 */
avnav.gui.Navpage.prototype.getMap=function(){
    if (!this.gui) return null;
    return this.gui.map;
};


avnav.gui.Navpage.prototype.showPage=function(options){
    if (!this.gui) return;
    this.fillDisplayFromGps();
    var newMap=false;
    var brightness=1;
    if (this.gui.properties.getProperties().style.nightMode < 100) {
        brightness=this.gui.properties.getProperties().nightChartFade/100;
    }
    this.buttonUpdate();
    if (options && options.url) {
        newMap=true;
        if (this.options_){
            if (this.options_.url == options.url && this.options_.charturl == options.charturl) newMap=false;
        }
        this.options_=options;
    }
    else {
        if (! this.options_){
            alert("invalid navpage call - no chart selected");
            return;
        }
    }
    if (newMap|| this.firstShow) {
        //chartbase: optional url for charts
        //list: the base url
        var chartbase = this.options_.charturl;
        var list = this.options_.url;
        if (!chartbase) {
            chartbase = list;
        }
        if (!list.match(/^http:/)) {
            if (list.match(/^\//)) {
                list = window.location.href.replace(/^([^\/:]*:\/\/[^\/]*).*/, '$1') + list;
            }
            else {
                list = window.location.href.replace(/[?].*/, '').replace(/[^\/]*$/, '') + "/" + list;
            }
        }
        var url = list + "/avnav.xml";
        var self = this;
        $.ajax({
            url: url,
            dataType: 'xml',
            cache: false,
            success: function (data) {
                self.getMap().initMap(self.mapdom, data, chartbase);
                self.getMap().setBrightness(brightness);
            },
            error: function (ev) {
                alert("unable to load charts " + ev.responseText);
            }
        });
    }
    this.firstShow=false;
    this.getMap().setBrightness(brightness);
    this.updateMainPanelSize('#'+this.mapdom);
    this.getMap().updateSize();
    if (!this.gui.properties.getProperties().layers.ais){
        //hide the AIS panel if switched off
        //showing will be done by the AIS event
        if (this.showHideAdditionalPanel('#avi_aisInfo', false, '#' + this.mapdom))
            this.gui.map.updateSize();
    }
    this.gui.navobject.setAisCenterMode(avnav.nav.AisCenterMode.MAP);
    this.updateAisPanel();
    this.fillDisplayFromGps();
    if (!this.gui.properties.getProperties().layers.nav) this.hideRouting();
    this.handleRouteDisplay();
    this.updateRoutePoints(true);
    if (options && options.showRouting){
        this.showRouting();
    }
    else {
        if (! options || ! options.returning) this.hideRouting();
    }


};
/**
 * the periodic timer call
 * update buttons and handle hiding of overlay
 * @param startTimer
 */
avnav.gui.Navpage.prototype.buttonUpdate=function(){
    //TODO: make this more generic
    var markerLock=this.navobject.getRoutingHandler().getLock()||false;
    this.handleToggleButton('.avb_LockMarker',markerLock);
    if (markerLock) this.selectOnPage('.avb_LockMarker').hide();
    else this.selectOnPage('.avb_LockMarker').show();
    this.handleToggleButton('.avb_StopNav',markerLock);
    if (!markerLock || this.routingVisible) this.selectOnPage('.avb_StopNav').hide();
    else this.selectOnPage('.avb_StopNav').show();
    var gpsLock=this.gui.map.getGpsLock();
    this.handleToggleButton('.avb_LockPos',gpsLock);
    var courseUp=this.gui.map.getCourseUp();
    this.handleToggleButton('.avb_CourseUp',courseUp);
};

avnav.gui.Navpage.prototype.timerEvent=function(){
    if (this.hidetime >0 && this.hidetime <= new Date().getTime()|| this.gui.map.getGpsLock()){
        this.hideOverlay();
        this.hidetime=0;
    }
    this.buttonUpdate();
};
avnav.gui.Navpage.prototype.hidePage=function(){
    this.hideOverlay();
    this.hidetime=0;
};
/**
 *
 */
avnav.gui.Navpage.prototype.localInit=function(){
    var self=this;
    $('#leftBottomMarker').click({page:this},function(ev){
        var wp=self.navobject.getRoutingHandler().getCurrentLegTarget();
        var options={};
        if (wp){
            options.wp=wp;
        }
        self.gui.showPage('wpinfopage',options);
    });
    $('#leftBottomPosition').click({page:this},function(ev){
        ev.stopPropagation();
        self.gui.showPage('boatinfopage');
    });
    $('#avi_centerDisplay').click({page:this},function(ev){
       ev.data.page.hideOverlay();
    });
    $('#avi_aisInfo').click(function(ev){
        var mmsi=$(this).attr('data-aismmsi');
        if (mmsi===undefined || mmsi == "") return;
        self.gui.showPage('aisinfopage',{mmsi:mmsi});
    });
    var self=this;
    $('#avi_route_info_navpage_inner').click({page:this},function(ev){
        ev.data.page.gui.showPage('routepage');
    });
    $('#avi_routeDisplay').click({page:this},function(ev){
        self.gui.showPage("wpinfopage",{wp:self.navobject.getRoutingHandler().getCurrentLegTarget()});
    });

};



/**
 * @private
 * @param {Array.<string>} opt_names
 */
avnav.gui.Navpage.prototype.fillDisplayFromGps=function(opt_names){
    if (! this.navobject) return;
    if (this.navobject.getGpsHandler().getGpsData().valid){
        $('#boatPositionStatus').attr('src',this.gui.properties.getProperties().statusOkImage);
    }
    else {
        $('#boatPositionStatus').attr('src',this.gui.properties.getProperties().statusErrorImage);
    }
    if (this.navobject.getRoutingHandler().getApproaching()){
        $('#avi_routeDisplay').addClass('avn_route_display_approach');
        $('#avi_routeDisplay_next').show();
    }
    else {
        $('#avi_routeDisplay').removeClass('avn_route_display_approach');
        $('#avi_routeDisplay_next').hide();
    }
};

/**
 * update the AIS panel
 */
avnav.gui.Navpage.prototype.updateAisPanel=function() {
    if (!this.gui.properties.getProperties().layers.ais) return;
    var aisPanel = this.getDiv().find('.avn_aisInfo');
    if (aisPanel) {
        var nearestTarget = this.navobject.getAisHandler().getNearestAisTarget();
        if (nearestTarget.mmsi) {
            //should show the AIS panel
            if (this.showHideAdditionalPanel('#avi_aisInfo', true, '#' + this.mapdom))
                this.gui.map.updateSize();
            var displayClass = "avn_ais_info_first";
            var warningClass = "avn_ais_info_warning";
            var normalClass = 'avn_ais_info_normal';
            $('#avi_aisInfo').addClass(normalClass);
            $('#avi_aisInfo').attr('data-aismmsi',nearestTarget.mmsi);
            if (!nearestTarget.warning) {
                $('#avi_aisInfo').removeClass(warningClass);
                if (nearestTarget.nearest) {
                    $('#avi_aisInfo').addClass(displayClass);
                    $('#avi_aisInfo').removeClass(normalClass);
                }
                else $('#avi_aisInfo').removeClass(displayClass);
            }
            else {
                $('#avi_aisInfo').addClass(warningClass);
                $('#avi_aisInfo').removeClass(displayClass);
                $('#avi_aisInfo').removeClass(normalClass);
            }
        }
        else {
            if (this.showHideAdditionalPanel('#avi_aisInfo', false, '#' + this.mapdom))
                this.gui.map.updateSize();
        }
    }
};

/**
 *
 * @param {avnav.nav.NavEvent} evdata
 */
avnav.gui.Navpage.prototype.navEvent=function(evdata){
    if (! this.visible) return;
    if (evdata.type == avnav.nav.NavEventType.AIS){
        this.updateAisPanel();
    }
    if (evdata.type == avnav.nav.NavEventType.ROUTE){
        this.handleRouteDisplay();
        if (this.routingVisible)this.updateRoutePoints();
    }
    this.fillDisplayFromGps(evdata.changedNames);
};
/**
 *
 * @param {avnav.map.MapEvent} evdata
 */
avnav.gui.Navpage.prototype.mapEvent=function(evdata){
    if (! this.visible) return;
    if (evdata.type == avnav.map.EventType.MOVE) {
        //show the center display if not visible
        if (this.overlay != null) {
            this.hidetime = new Date().getTime() + this.gui.properties.getProperties().centerDisplayTimeout;
            return;
        }
        this.overlay = this.getDiv().find('#avi_centerDisplay');
        this.hidetime = new Date().getTime() + this.gui.properties.getProperties().centerDisplayTimeout;
        this.overlay.show();
        this.updateLayout();
    }
    if (evdata.type == avnav.map.EventType.SELECTAIS){
        var aisparam=evdata.parameter.aisparam;
        if (! aisparam) return;
        if (aisparam.mmsi){
            this.navobject.getAisHandler().setTrackedTarget(aisparam.mmsi);
            this.gui.showPage('aisinfopage',{mmsi: aisparam.mmsi});
        }
    }
    if (evdata.type == avnav.map.EventType.SELECTWP){
        var wp=evdata.parameter.wp;
        if (! wp) return;
        var currentEditing=this.navobject.getRoutingHandler().getEditingWp();
        if (this.routingVisible){
            if (currentEditing && currentEditing.compare(wp)){
                this.gui.showPage("wpinfopage",{wp:wp});
            }
            else {
                this.navobject.getRoutingHandler().setEditingWp(wp);
            }
        }
        else{
            this.gui.showPage("wpinfopage",{wp:wp});
        }
    }
};

/**
 * hide the center overlay
 */
avnav.gui.Navpage.prototype.hideOverlay=function(){
    if (this.overlay != null){
        this.overlay.hide();
        this.overlay=null;
        this.hidetime=0;
        this.updateLayout();
    }
};

avnav.gui.Navpage.prototype.showRouting=function() {
    if (this.routingVisible) return;
    if (!this.gui.properties.getProperties().layers.nav) return;
    var upd=false;
    //this.showHideAdditionalPanel('#avi_second_buttons_navpage', true, '#' + this.mapdom);
    var routeActive=this.navobject.getRoutingHandler().hasActiveRoute();
    this.selectOnPage('.avn_routeBtn').show();
    this.selectOnPage('.avn_noRouteBtn').hide();
    if (this.showHideAdditionalPanel('#avi_route_info_navpage', true, '#' + this.mapdom)) upd=true;
    if (upd)this.gui.map.updateSize();
    this.routingVisible=true;
    this.handleToggleButton('.avb_ShowRoutePanel',true);
    this.navobject.getRoutingHandler().stopEditingRoute(); //always reset to active route if any
                                                           //TODO: should we keep the last edited route?
    this.navobject.getRoutingHandler().startEditingRoute();
    this.gui.map.setRoutingActive(true);
    this.handleRouteDisplay();
    this.updateRoutePoints(true);
    //if (this.gui.isMobileBrowser()) this.showWpPopUp(this.navobject.getRoutingData().getActiveWpIdx());
    var nLock=this.gui.map.getGpsLock();
    this.lastGpsLock=nLock;
    if (nLock) {
        this.gui.map.setGpsLock(!nLock);
        this.handleToggleButton('.avb_LockPos', !nLock);
        this.gui.map.triggerRender();
    }
    this.updateLayout();

};

/**
 * @private
 */
avnav.gui.Navpage.prototype.hideRouting=function() {
    var upd=false;
    //this.showHideAdditionalPanel('#avi_second_buttons_navpage', false, '#' + this.mapdom);
    this.selectOnPage('.avn_routeBtn').hide();
    this.selectOnPage('.avn_noRouteBtn').show();
    if (this.showHideAdditionalPanel('#avi_route_info_navpage', false, '#' + this.mapdom)) upd=true;
    if (upd) this.gui.map.updateSize();
    this.routingVisible=false;
    this.handleToggleButton('.avb_ShowRoutePanel',false);
    this.gui.map.setRoutingActive(false);
    this.navobject.getRoutingHandler().stopEditingRoute();
    this.handleRouteDisplay();
    if (this.lastGpsLock) {
        this.gui.map.setGpsLock(true);
        this.lastGpsLock=false;
    }
    $('#avi_route_info_navpage_inner').removeClass("avn_activeRoute avn_otherRoute");
};

/**
 * control the route display
 * @private
 */
avnav.gui.Navpage.prototype.handleRouteDisplay=function() {
    if (! this.navobject) return;
    var routeActive=this.navobject.getRoutingHandler().hasActiveRoute();
    if (routeActive && (! this.routingVisible || this.gui.properties.getProperties().routeShowRteWhenEdit) ){
        $('#avi_routeDisplay').show();
    }
    else {
        $('#avi_routeDisplay').hide();
    }
    this.updateLayout();
};

avnav.gui.Navpage.prototype.updateLayout=function(){
    var rtop=$('#avi_nav_bottom').outerHeight();
    $('#avi_navLeftContainer').css('bottom',rtop+"px");
    $('#avi_route_info_navpage').css('bottom',rtop+"px");
};


avnav.gui.Navpage.prototype.updateRoutePoints=function(opt_force){
    var editingActiveRoute=this.navobject.getRoutingHandler().isEditingActiveRoute();
    $('#avi_route_info_navpage_inner').removeClass("avn_activeRoute avn_otherRoute");
    $('#avi_route_info_navpage_inner').addClass(editingActiveRoute?"avn_activeRoute":"avn_otherRoute");
    var html="";
    var route=this.navobject.getRoutingHandler().getRoute();
    if (route) {
        var rname = route.name.substr(0, 14);
        if (route.name.length > 14) rname += "..";
        $('#avi_route_info_name').text(rname);
    }
    else {
        $('#avi_route_info_list').html("");
        return;
    }
    var active=this.navobject.getRoutingHandler().getEditingWpIdx();
    var i;
    var self=this;
    var curlen=$('#avi_route_info_list').find('.avn_route_info_point').length;
    var rebuild=opt_force||false;
    if (! rebuild) rebuild=this.lastRoute.differsTo(route);
    this.lastRoute=route.clone();
    if (rebuild){
        //rebuild
        for (i=0;i<route.points.length;i++){
            html+='<div class="avn_route_info_point ';
            html+='">';
            html+='<div class="avn_route_info_name" />';
            if (this.gui.properties.getProperties().routeShowLL) {
                html += '<div class="avn_route_point_ll">';
            }
            else{
                html += '<div class="avn_route_point_course">';
            }
            html+='</div>';
            html+='</div>';
        }
        $('#avi_route_info_list').html(html);
        rebuild=true;
    }
    else {
        //update
    }
    $('#avi_route_info_list').find('.avn_route_info_point').each(function(i,el){
        var txt=route.points[i].name?route.points[i].name:i+"";
        if (i == active) {
            $(el).addClass('avn_route_info_active_point');
            if (rebuild){
                el.scrollIntoView();
            }
            else {
                //ensure element is visible
                var eltop = $(el).position().top;
                var ph = $('#avi_route_info_list').height();
                var eh = $(el).height();
                if (eltop < 0)el.scrollIntoView(true);
                if ((eltop + eh) > (ph)) el.scrollIntoView(false);
            }
        }
        else $(el).removeClass('avn_route_info_active_point');
        $(el).find('.avn_route_info_name').text(txt);
        $(el).find('.avn_route_point_ll').html(self.formatter.formatLonLats(route.points[i]));
        var courseLen="--- &#176;/ ---- nm";
        if (i>0) {
            var dst=avnav.nav.NavCompute.computeDistance(route.points[i-1],route.points[i]);
            courseLen=self.formatter.formatDecimal(dst.course,3,0)+" &#176;/ ";
            courseLen+=self.formatter.formatDecimal(dst.dtsnm,3,1)+" nm";
        }
        $(el).find('.avn_route_point_course').html(courseLen);
        var idx=i;
        if (rebuild) {
            $(el).click(function (ev) {
                var isActive=( $(this).hasClass('avn_route_info_active_point'));
                self.navobject.getRoutingHandler().setEditingWpIdx(idx);
                self.getMap().setCenter(self.navobject.getRoutingHandler().getEditingWp());
                if (isActive){
                    self.gui.showPage("wpinfopage",{wp:self.navobject.getRoutingHandler().getEditingWp()});
                }
                ev.preventDefault();
            });
        }
    });
};



avnav.gui.Navpage.prototype.checkRouteWritable=function(){
    if (this.navobject.getRoutingHandler().isRouteWritable()) return true;
    var ok=confirm("you cannot edit this route as you are disconnected. OK to select a new name");
    if (ok){
        this.gui.showPage('routepage');
    }
    return false;
};

avnav.gui.Navpage.prototype.goBack=function(){
    this.btnCancelNav();
};

//-------------------------- Buttons ----------------------------------------

avnav.gui.Navpage.prototype.btnZoomIn=function (button,ev){
    log("ZoomIn clicked");
    this.getMap().changeZoom(1);
};

avnav.gui.Navpage.prototype.btnZoomOut=function (button,ev){
    log("ZoomOut clicked");
    this.getMap().changeZoom(-1);
};
avnav.gui.Navpage.prototype.btnLockPos=function (button,ev){
    var nLock=! this.gui.map.getGpsLock();
    this.gui.map.setGpsLock(nLock);
    this.handleToggleButton(button,nLock);
    if (nLock) this.hideOverlay();
    this.gui.map.triggerRender();
    log("LockPos clicked");
};
avnav.gui.Navpage.prototype.btnLockMarker=function (button,ev) {
    log("LockMarker clicked");
    var options = {};
    var center = this.navobject.getMapCenter();
    var wp = new avnav.nav.navdata.WayPoint();
    center.assign(wp);
    wp.name = 'Marker';
    options.wp = wp;
    options.newWp = true;
    this.gui.showPage('wpinfopage', options);

};
avnav.gui.Navpage.prototype.btnStopNav=function (button,ev) {
    log("StopNav clicked");

    this.navobject.getRoutingHandler().routeOff();
    this.buttonUpdate();
    this.hideRouting();
    this.gui.map.triggerRender();

};
avnav.gui.Navpage.prototype.btnCourseUp=function (button,ev){
    var nLock=! this.gui.map.getCourseUp();
    nLock=this.gui.map.setCourseUp(nLock);
    this.handleToggleButton(button,nLock);
    this.gui.map.triggerRender();
    log("courseUp clicked");
};
avnav.gui.Navpage.prototype.btnShowRoutePanel=function (button,ev){
    log("showRoutePanel clicked");
    if (! this.routingVisible) this.showRouting();
    else this.hideRouting();
};
avnav.gui.Navpage.prototype.btnCancelNav=function (button,ev){
    log("CancelNav clicked");
    if (this.routingVisible){
        this.hideRouting();
        return;
    }
    this.gui.showPage('mainpage');
};


//-------------------------- Route ----------------------------------------
avnav.gui.Navpage.prototype.btnNavAdd=function (button,ev){
    log("navAdd clicked");
    if (!this.checkRouteWritable()) return false;
    var center=this.gui.map.getCenter();
    var current=this.navobject.getRoutingHandler().getEditingWp();
    if (current) {
        var dst = this.gui.map.pixelDistance(center, current);
        //TODO: make this configurable
        if (dst < 8) return; //avoid multiple wp at the same coordinate
    }
    this.navobject.getRoutingHandler().addWp(
        -1,center
    );
};

avnav.gui.Navpage.prototype.btnNavDelete=function (button,ev){
    log("navDelete clicked");this.checkRouteWritable();
    if (!this.checkRouteWritable()) return false;
    this.navobject.getRoutingHandler().deleteWp(-1);
};
avnav.gui.Navpage.prototype.btnNavToCenter=function (button,ev){
    log("navDelete clicked");
    if (!this.checkRouteWritable()) return false;
    var center=this.gui.map.getCenter();
    this.navobject.getRoutingHandler().changeWpByIdx(
        -1,center
    );
};
avnav.gui.Navpage.prototype.btnNavGoto=function(button,ev){
    log("navGoto clicked");
    this.navobject.getRoutingHandler().wpOn(this.navobject.getRoutingHandler().getEditingWp());
    this.hideRouting();
};

avnav.gui.Navpage.prototype.btnNavDeleteAll=function(button,ev){
    log("navDeletAll clicked");
    if (!this.checkRouteWritable()) return false;
    this.navobject.getRoutingHandler().emptyRoute();
};

avnav.gui.Navpage.prototype.btnNavInvert=function(button,ev){
    log("navInvert clicked");
    if (!this.checkRouteWritable()) return false;
    this.navobject.getRoutingHandler().invertRoute();
};
/**
 * create the page instance
 */
(function(){
    //create an instance of the status page handler
    var page=new avnav.gui.Navpage();
}());

