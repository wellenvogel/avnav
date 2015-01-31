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
     * @private
     * @type {number}
     */
    this.timer=0;
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

    this.waypointPopUp='#avi_waypoint_popup';

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
    })

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
    this.buttonUpdate(true);
    if (!this.gui.properties.getProperties().layers.ais){
        //hide the AIS panel if switched off
        //showing will be done by the AIS event
        if (this.showHideAdditionalPanel('#aisInfo', false, '#' + this.mapdom))
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
        this.hideRouting();
    }
    if (! this.routingVisible) this.navobject.getRoutingData().setActiveWpFromRoute();

};
/**
 * the periodic timer call
 * update buttons and handle hiding of overlay
 * @param startTimer
 */
avnav.gui.Navpage.prototype.buttonUpdate=function(startTimer){
    //TODO: make this more generic
    var markerLock=this.navobject.getRoutingData().getLock();
    this.handleToggleButton('#avb_LockMarker',markerLock);
    var gpsLock=this.gui.map.getGpsLock();
    this.handleToggleButton('#avb_LockPos',gpsLock);
    var courseUp=this.gui.map.getCourseUp();
    this.handleToggleButton('#avb_CourseUp',courseUp);
    var self=this;
    if (this.hidetime >0 && this.hidetime <= new Date().getTime()|| gpsLock){
        this.hideOverlay();
        this.hidetime=0;
    }
    if (startTimer) this.timer=window.setTimeout(function(){
        self.buttonUpdate(true);
        },
        self.gui.properties.getProperties().buttonUpdateTime
    );
};

avnav.gui.Navpage.prototype.hidePage=function(){
    if (this.timer) window.clearTimeout(this.timer);
    this.hideOverlay();
    this.hidetime=0;
    //this.hideRouting();
};
/**
 *
 */
avnav.gui.Navpage.prototype.localInit=function(){
    var self=this;
    $('#leftBottomMarker').click({page:this},function(ev){
        var navobject=ev.data.page.navobject;
        var leg=navobject.getRawData(avnav.nav.NavEventType.ROUTE);
        var marker=navobject.getRawData(avnav.nav.NavEventType.NAV).markerLatlon;
        ev.data.page.gui.map.setCenter(marker);
        //make the current WP the active again...
        var routingTarget=navobject.getRoutingData().getCurrentLegTargetIdx();
        if (routingTarget >= 0 && navobject.getRoutingData().isActiveRoute()){
            navobject.getRoutingData().setEditingWp(routingTarget);
        }
    });
    $('#leftBottomPositionCourse').click({page:this},function(ev){
        ev.stopPropagation();
        var gps=ev.data.page.navobject.getRawData(avnav.nav.NavEventType.GPS);
        if (gps.valid) ev.data.page.gui.map.setCenter(gps);
    });
    $('#leftBottomPosition').click({page:this},function(ev){
        ev.stopPropagation();
        ev.data.page.gui.showPage('gpspage',{returnpage:'navpage'});
    });

    $('#centerDisplay').click({page:this},function(ev){
       ev.data.page.hideOverlay();
    });
    $('#aisInfo').click({page:this},function(ev){
        ev.data.page.gui.showPage('aispage',{returnpage:'navpage'});
    });
    var self=this;
    $(this.waypointPopUp).find('input').on('change',function(ev){
        var wpid=$(self.waypointPopUp).attr('wpid');
        if (wpid !== undefined) {
            wpid=parseInt(wpid);
            var point = self.navobject.getRoutingData().getWp(wpid);
            if (point) point.name = $(this).val();
            self.navobject.getRoutingData().changeWp(wpid, point);
        }
    });
    $('#avi_route_info_navpage_inner').click({page:this},function(ev){
        ev.data.page.gui.showPage('routepage',{returnpage:'navpage'});
    });

};



/**
 * @private
 * @param {Array.<string>} opt_names
 */
avnav.gui.Navpage.prototype.fillDisplayFromGps=function(opt_names){
    if (! this.navobject) return;
    if (this.navobject.getRawData(avnav.nav.NavEventType.GPS).valid){
        $('#boatPositionStatus').attr('src',this.gui.properties.getProperties().statusOkImage);
    }
    else {
        $('#boatPositionStatus').attr('src',this.gui.properties.getProperties().statusErrorImage);
    }
    if (this.navobject.getRoutingData().getApproaching()){
        $('#avi_route_display').addClass('avn_route_display_approach');
        $('#avi_route_display_next').show();
    }
    else {
        $('#avi_route_display').removeClass('avn_route_display_approach');
        $('#avi_route_display_next').hide();
    }
    var route=this.navobject.getRoutingData().getCurrentRoute();
    var routeTarget=this.navobject.getRoutingData().getCurrentLegTarget();
    var txt="Marker";
    if (routeTarget){
        txt=routeTarget.name;
        if (! txt) txt=this.navobject.getRoutingData().getCurrentLegTargetIdx()+"";
    }
    $('#markerLabel').text(txt);
};

/**
 * update the AIS panel
 */
avnav.gui.Navpage.prototype.updateAisPanel=function() {
    if (!this.gui.properties.getProperties().layers.ais) return;
    var aisPanel = this.getDiv().find('.avn_aisInfo');
    if (aisPanel) {
        var nearestTarget = this.navobject.getAisData().getNearestAisTarget();
        if (nearestTarget.mmsi) {
            //should show the AIS panel
            if (this.showHideAdditionalPanel('#aisInfo', true, '#' + this.mapdom))
                this.gui.map.updateSize();
            var displayClass = "avn_ais_info_first";
            var warningClass = "avn_ais_info_warning";
            if (!nearestTarget.warning) {
                $('#aisInfo').removeClass(warningClass);
                if (nearestTarget.nearest) $('#aisInfo').addClass(displayClass);
                else $('#aisInfo').removeClass(displayClass);
            }
            else {
                $('#aisInfo').addClass(warningClass);
                $('#aisInfo').removeClass(displayClass);
            }
        }
        else {
            if (this.showHideAdditionalPanel('#aisInfo', false, '#' + this.mapdom))
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
        else{
            //if the route info is not visible
            //we always set the active wp to the routing target if we have one...
            this.navobject.getRoutingData().setActiveWpFromRoute();
        }
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
        this.overlay = this.getDiv().find('#centerDisplay');
        this.hidetime = new Date().getTime() + this.gui.properties.getProperties().centerDisplayTimeout;
        this.overlay.show();
        this.handleRouteDisplay();
    }
    if (evdata.type == avnav.map.EventType.SELECTAIS){
        var aisparam=evdata.parameter.aisparam;
        if (! aisparam) return;
        if (aisparam.mmsi){
            this.navobject.getAisData().setTrackedTarget(aisparam.mmsi);
            this.gui.showPage('aispage',{returnpage:'navpage'});
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
        this.handleRouteDisplay();
    }
};

avnav.gui.Navpage.prototype.showRouting=function() {
    if (this.routingVisible) return;
    if (!this.gui.properties.getProperties().layers.nav) return;
    var upd=this.showHideAdditionalPanel('#avi_second_buttons_navpage', true, '#' + this.mapdom);
    if (this.showHideAdditionalPanel('#avi_route_info_navpage', true, '#' + this.mapdom)) upd=true;
    if (upd)this.gui.map.updateSize();
    this.routingVisible=true;
    this.handleToggleButton('#avb_ShowRoutePanel',true);
    this.gui.map.setRoutingActive(true);
    this.handleRouteDisplay();
    this.updateRoutePoints(true);
    if (this.gui.isMobileBrowser()) this.showWpPopUp(this.navobject.getRoutingData().getActiveWpIdx());
    var nLock=this.gui.map.getGpsLock();
    this.lastGpsLock=nLock;
    if (nLock) {
        this.gui.map.setGpsLock(!nLock);
        this.handleToggleButton(button, !nLock);
        this.gui.map.triggerRender();
    }

};

/**
 * @private
 */
avnav.gui.Navpage.prototype.hideRouting=function() {
    var upd=this.showHideAdditionalPanel('#avi_second_buttons_navpage', false, '#' + this.mapdom);
    if (this.showHideAdditionalPanel('#avi_route_info_navpage', false, '#' + this.mapdom)) upd=true;
    if (upd) this.gui.map.updateSize();
    this.routingVisible=false;
    this.handleToggleButton('#avb_ShowRoutePanel',false);
    this.gui.map.setRoutingActive(false);
    this.navobject.getRoutingData().resetToActive();
    this.navobject.getRoutingData().setActiveWpFromRoute();
    this.handleRouteDisplay();
    $(this.waypointPopUp).hide();
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
    var routeActive=this.navobject.getRoutingData().hasActiveRoute();
    if (routeActive  ){
        $('#avi_route_display').show();
        if (this.overlay){
            var h=this.overlay.height();
            $('#avi_route_display').css('bottom',h);
        }
        else{
            $('#avi_route_display').css('bottom',0);
        }
    }
    else {
        $('#avi_route_display').hide();
    }
};

avnav.gui.Navpage.prototype.updateRoutePoints=function(opt_force){
    $('#avi_route_info_navpage_inner').removeClass("avn_activeRoute avn_otherRoute");
    $('#avi_route_info_navpage_inner').addClass(this.navobject.getRoutingData().isActiveRoute()?"avn_activeRoute":"avn_otherRoute");
    var html="";
    var route=this.navobject.getRoutingData().getCurrentRoute();
    if (route) {
        var rname = route.name.substr(0, 14);
        if (route.name.length > 14) rname += "..";
        $('#avi_route_info_name').text(rname);
    }
    else {
        $('#avi_route_info_list').html("");
        return;
    }
    var active=this.navobject.getRoutingData().getActiveWpIdx();
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
            html+='<input type="text" id="avi_route_point_'+i+'"/>';
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
    self.updateWpPopUp(active);
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
        $(el).find('input').val(txt);
        $(el).find('.avn_route_point_ll').html(self.formatter.formatLonLats(route.points[i]));
        var courseLen="--- &#176;<br>---- nm";
        if (i>0) {
            var dst=avnav.nav.NavCompute.computeDistance(route.points[i-1],route.points[i]);
            courseLen=self.formatter.formatDecimal(dst.course,3,0)+" &#176;<br>";
            courseLen+=self.formatter.formatDecimal(dst.dtsnm,3,1)+" nm";
        }
        $(el).find('.avn_route_point_course').html(courseLen);
        var idx=i;
        if (rebuild) {
            if (self.gui.isMobileBrowser()){
                $(el).find('input').attr('readonly','true');
            }
            else {
                $(el).find('input').on('change', function (ev) {
                    var point = self.navobject.getRoutingData().getWp(idx);
                    if (point) point.name = $(this).val();
                    self.navobject.getRoutingData().changeWp(idx, point);
                });
            }
            $(el).click(function (ev) {
                self.navobject.getRoutingData().setEditingWp(idx);
                self.getMap().setCenter(self.navobject.getRoutingData().getEditingWp());
                if (self.gui.isMobileBrowser()){
                    self.showWpPopUp(idx);
                }
                ev.preventDefault();
            });
        }
    });
};

/**
 * show the waypoint popup
 * @param idx
 * @private
 */
avnav.gui.Navpage.prototype.showWpPopUp=function(idx){
    var elid=this.waypointPopUp;
    $(elid).attr('wpid',idx);
    this.updateWpPopUp(idx);
    $(elid).show();
};
/**
 * @private
 * @param idx
 */
avnav.gui.Navpage.prototype.updateWpPopUp=function(idx){
    $(this.waypointPopUp).attr('wpid',idx);
    var wp=this.navobject.getRoutingData().getWp(idx);
    var pwp=this.navobject.getRoutingData().getWp(idx-1);
    if (wp){
        var txt=wp.name||idx+"";
        $(this.waypointPopUp).find('input').val(txt);
        $(this.waypointPopUp).find('.avn_route_point_ll').text(this.formatter.formatLonLats(wp));
        if (pwp){
            var dst=avnav.nav.NavCompute.computeDistance(pwp,wp);
            var courseLen=this.formatter.formatDecimal(dst.course,3,0)+" °, ";
            courseLen+=this.formatter.formatDecimal(dst.dtsnm,3,1)+" nm";
            $(this.waypointPopUp).find('.avn_route_point_course').html(courseLen);
        }
        else{
            $(this.waypointPopUp).find('.avn_route_point_course').html("");
        }
    }
    else{
        $(this.waypointPopUp).find('input').val("");
        $(this.waypointPopUp).find('.avn_route_point_ll').text('');
        $(this.waypointPopUp).find('.avn_route_point_course').html("");
    }
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
avnav.gui.Navpage.prototype.btnLockMarker=function (button,ev){
    var nLock=! this.navobject.getRoutingData().getLock();
    if (! nLock) this.navobject.getRoutingData().routeOff();
    else this.navobject.getRoutingData().routeOn(avnav.nav.RoutingMode.CENTER);
    this.handleToggleButton(button,nLock);
    if (nLock) this.hideRouting();
    this.gui.map.triggerRender();
    log("LockMarker clicked");
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
    this.gui.showPage('mainpage');
};
//-------------------------- Wp PopUp ------------------------------------
avnav.gui.Navpage.prototype.btnWpDone=function(button,ev){
    $(this.waypointPopUp).hide();
};
avnav.gui.Navpage.prototype.btnWpPrevious=function(button,ev){
    this.navobject.getRoutingData().setEditingWp(this.navobject.getRoutingData().getActiveWpIdx()-1);
    this.getMap().setCenter(this.navobject.getRoutingData().getEditingWp());
};
avnav.gui.Navpage.prototype.btnWpNext=function(button,ev){
    this.navobject.getRoutingData().setEditingWp(this.navobject.getRoutingData().getActiveWpIdx()+1);
    this.getMap().setCenter(this.navobject.getRoutingData().getEditingWp());
};

//-------------------------- Route ----------------------------------------
avnav.gui.Navpage.prototype.btnNavAdd=function (button,ev){
    log("navAdd clicked");
    var center=this.gui.map.getCenter();
    var current=this.navobject.getRoutingData().getEditingWp();
    if (current) {
        var dst = this.gui.map.pixelDistance(center, current);
        //TODO: make this configurable
        if (dst < 8) return; //avoid multiple wp at the same coordinate
    }
    this.navobject.getRoutingData().addWp(
        -1,center
    );
};

avnav.gui.Navpage.prototype.btnNavDelete=function (button,ev){
    log("navDelete clicked");
    this.navobject.getRoutingData().deleteWp(-1);
};
avnav.gui.Navpage.prototype.btnNavToCenter=function (button,ev){
    log("navDelete clicked");
    var center=this.gui.map.getCenter();
    this.navobject.getRoutingData().changeWp(
        -1,center
    );
};
avnav.gui.Navpage.prototype.btnNavGoto=function(button,ev){
    log("navGoto clicked");
    this.navobject.getRoutingData().routeOn(avnav.nav.RoutingMode.ROUTE);
    this.hideRouting();
};
avnav.gui.Navpage.prototype.btnNavDeleteAll=function(button,ev){
    log("navDeletAll clicked");
    this.navobject.getRoutingData().deleteRoute();
};

avnav.gui.Navpage.prototype.btnNavInvert=function(button,ev){
    log("navInvert clicked");
    this.navobject.getRoutingData().invertRoute();
};
/**
 * create the page instance
 */
(function(){
    //create an instance of the status page handler
    var page=new avnav.gui.Navpage();
}());

