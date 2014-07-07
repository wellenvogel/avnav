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
    this.serverLeg={};

    this.currentLeg={
        from: new avnav.nav.navdata.WayPoint(0,0),
        to: new avnav.nav.navdata.WayPoint(0,0),
        name: undefined,
        active: false
    };
    try {
        var raw=localStorage.getItem(this.propertyHandler.getProperties().routingDataName);
        if (raw){
            var nleg=JSON.parse(raw);
            if (nleg.from) this.currentLeg.from=avnav.nav.navdata.WayPoint.fromPlain(nleg.from);
            if (nleg.to) this.currentLeg.to=avnav.nav.navdata.WayPoint.fromPlain(nleg.to);
            if (nleg.name) this.currentLeg.name=nleg.name;
            if (nleg.active !== undefined) this.currentLeg.active=nleg.active;
        }
    }catch(e){
        log("Exception reading currentLeg "+e);
    }

    this.connectMode=false;

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
 * compare 2 legs
 * @param leg1
 * @param leg2
 * @returns {boolean}
 */
avnav.nav.RouteData.prototype.compareLegs=function(leg1,leg2){
    if (! leg1 && ! leg2) return false;
    if (! leg1 && leg2) return true;
    if ( leg1 && ! leg2) return true;
    var changed = false;
    var i;
    var wps = ['from', 'to'];
    for (i in wps) {
        var wp=wps[i];
        if (leg1[wp]) {
            if (!leg2[wp]) changed = true;
            else {
                if (leg1[wp].lat != leg2[wp].lat ||
                    leg1[wp].lon != leg2[wp].lon ||
                    leg1[wp].name != leg2[wp].name) changed = true
            }
        }
        else if (leg2[wp]) changed = true;
    }
    if (leg1.name != leg2.name) changed=true;
    return changed;
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
        return true;
    }
    if (this.compareLegs(data,this.serverLeg)){
        this.serverLeg=data;
        return true;
    }
    return false;
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
            var change=self.convertResponse(data);
            log("routing data");
            self.handleRouteStatus(true,change);
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
    //if we are in connected mode - set our own data
    if (this.connectMode && change && success){
        this.currentLeg=this.serverLeg;
        this.saveLeg()
    }
    //inform the navobject on any change
    if (change || (oldConnect != this.serverConnected))this.navobject.routeEvent();
};

/**
 * return the current trackData
 * @returns {}
 */
avnav.nav.RouteData.prototype.getRouteData=function(){
    return this.currentLeg;
};

/**
 * save the current leg info
 * @private
 */
avnav.nav.RouteData.prototype.saveLeg=function(){
    var raw=JSON.stringify(this.currentLeg);
    localStorage.setItem(this.propertyHandler.getProperties().routingDataName,raw);
};

/**
 * set the new leg
 * @param newLeg
 * @returns true if changed
 */
avnav.nav.RouteData.prototype.setLeg=function(newLeg) {
    if (this.compareLegs(newLeg,this.currentLeg)){
        this.currentLeg=newLeg;
        this.legChanged();
        return true;
    }
    return false;
};

/**
 * leg has changed
 * @returns {boolean}
 * @private
 */
avnav.nav.RouteData.prototype.legChanged=function(){
    this.saveLeg();
    this.navobject.routeEvent();
    //TODO: write to server
    return true;
};

/**
 * set the route active state
 * @param active
 * @returns {boolean} true if changed - fires route event
 */
avnav.nav.RouteData.prototype.setLock=function(active){
    if (active != this.currentLeg.active){
        this.currentLeg.active=active;
        this.legChanged();
        return true;
    }
    return false;
};

/**
 * get the current lock state
 * @returns {boolean}
 */
avnav.nav.RouteData.prototype.getLock=function(){
    return this.currentLeg.active;
};

/**
 *
 * @param evdata
 */
avnav.nav.RouteData.prototype.propertyChange=function(evdata) {

};

