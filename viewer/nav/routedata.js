/**
 * Created by andreas on 04.05.14.
 */
avnav.provide('avnav.nav.RouteData');



/**
 * the handler for the routing data
 * query the server...
 * @param {avnav.util.PropertyHandler} propertyHandler
 * @param {avnav.nav.NavObject} navobject
 * @constructor
 */
avnav.nav.RouteData=function(propertyHandler,navobject){
    /** @private */
    this.propertyHandler=propertyHandler;
    /** @private */
    this.navobject=navobject;
    /** @private
     * @type {}
     * */
    this.currentLeg={};

    /**
     * @private
     * @type {null}
     */
    this.timer=null;
    /**
     * @private
     * @type {number}
     */
    this.routeErrors=0;
    this.serverConnected=false;
    this.startQuery();
    var self=this;
    $(document).on(avnav.util.PropertyChangeEvent.EVENT_TYPE, function(ev,evdata){
        self.propertyChange(evdata);
    });
};

/**
 *
 * @param data
 * @private
 * @return {Boolean} - true if data has changed
 */
avnav.nav.RouteData.prototype.convertResponse=function(data) {
    if (!data) {
        this.serverConnected = false;
        return;
    }
    if (!this.currentLeg) {
        this.currentLeg = data;
        return true;
    }
    var changed = false;
    var i;
    var wps = ['from', 'to'];
    for (i in wps) {
        var wp=wps[i];
        if (data[wp]) {
            if (!this.currentLeg[wp]) changed = true;
            else {
                if (data[wp].lat != this.currentLeg[wp].lat ||
                    data[wp].lon != this.currentLeg[wp].lon ||
                    data[wp].name != this.currentLeg[wp].name) changed = true
            }
        }
        else if (this.currentLeg[wp]) changed = true;
    }
    if (data.name != this.currentLeg.name) changed=true;
    if (changed) this.currentLeg=data;
    return changed;
};

/**
 * @private
 */
avnav.nav.RouteData.prototype.startQuery=function() {
    var url = this.propertyHandler.getProperties().navUrl+"?request=routing&command=getleg";
    var timeout = this.propertyHandler.getProperties().routeQueryTimeout; //in ms!
    var self = this;
    $.ajax({
        url: url,
        dataType: 'json',
        cache:	false,
        success: function(data,status){
            change=self.convertResponse(data);
            log("routing data");
            self.handleRoutetatus(true,change);
            self.timer=window.setTimeout(function(){
                self.startQuery();
            },timeout);
        },
        error: function(status,data,error){
            log("query route error");
            self.handleRouteStatus(false);
            self.timer=window.setTimeout(function(){
                self.startQuery();
            },timeout);
        },
        timeout: 10000
    });

};

/**
 * handle the status and trigger the FPS event
 * @param success
 */
avnav.nav.RouteData.prototype.handleRouteStatus=function(success,change){
    var oldConnect=this.serverConnected;
    if (! success){
        this.routeErrors++;
        if (this.routeErrors > 10){
            log("lost route");
            this.serverConnected=false;
        }
        else{
            return;
        }
    }
    else {
        this.routeErrors=0;
        this.serverConnected=true;
    }
    //inform the navobject on any change
    if (change || (oldConnect != this.serverConnected))this.navobject.routeEvent();
};

/**
 * return the current trackData
 * @returns {Array.<avnav.nav.navdata.TrackPoint>}
 */
avnav.nav.RouteData.prototype.getRouteData=function(){
    return this.currentTrack;
};

/**
 * delete the current track and re-query
 * @param evdata
 */
avnav.nav.RouteData.prototype.propertyChange=function(evdata) {
    this.currentTrack=[];
};

