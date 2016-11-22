/**
 * Created by Andreas on 27.04.2014.
 */

avnav.provide('avnav.gui.Handler');
avnav.provide('avnav.gui.PageEvent');
avnav.provide('avnav.gui.AndroidEvent');
var NavObject=require('../nav/navobject');
/**
 * the page change event
 * @param {avnav.gui.Handler} gui
 * @param {NavObject} navobject
 * @param {string} oldpage
 * @param {string} newpage
 * @param {object} opt_options
 * @constructor
 * @extends {
 */
avnav.gui.PageEvent = function (gui, navobject, oldpage, newpage, opt_options) {
    this.gui = gui;
    this.navobject = navobject;
    this.oldpage = oldpage;
    this.newpage = newpage;
    this.options = opt_options;
};
/**
 * the type for the page event
 * @type {string}
 * @const
 */
avnav.gui.PageEvent.EVENT_TYPE = 'changepage';

/**
 * an event triggered by the android integration
 * @param {string} key - the event key
 * @param {number} id - an id
 * @constructor
 */
avnav.gui.AndroidEvent = function (key, id) {
    this.key = key;
    this.id = id;
};
avnav.gui.AndroidEvent.EVENT_TYPE = 'android';

/**
 * an event for a generic back handling
 * @param name - the name of the page that should handle the event
 * @constructor
 */
avnav.gui.BackEvent = function (name) {
    this.name = name;
};

avnav.gui.BackEvent.EVENT_TYPE = "avnback";

/**
 *
 * @param {avnav.util.PropertyHandler} properties
 * @param {NavObject} navobject
 * @param {ol.Map} map
 * @constructor
 */
avnav.gui.Handler = function (properties, navobject, map) {
    /** {avnav.util.PropertyHandler} */
    this.properties = properties;
    /** {NavObject} */
    this.navobject = navobject;
    /** {avnav.map.MapHolder} */
    this.map = map;
    /**
     * the curent page
     * @type {String}
     */
    this.page = undefined;
    var self = this;
    /**
     * if any entry is set, do not resize the layout
     * (but potentially trigger a resize later)
     * @type {{}}
     */
    this.activeInputs = {};
    this.history=[];
    this.lasth = $(window).height();
    this.lastw = $(window).width();
    $(window).on('resize', function () {
        try {
            if (Object.keys(self.activeInputs).length > 0) {
                avnav.log("resize skipped due to active input");
                return;
            }
        } catch (e) {
        }
        setTimeout(function () {
            self.lasth = $(window).height();
            self.lastw = $(window).width();
            self.properties.updateLayout();
            $(document).trigger(avnav.util.PropertyChangeEvent.EVENT_TYPE, new avnav.util.PropertyChangeEvent(self.properties));
        }, 10);
    });
    $(document).on(avnav.gui.AndroidEvent.EVENT_TYPE, function (ev, evdata) {
        if (evdata.key && evdata.key == "backPressed") {
            $(document).trigger(avnav.gui.BackEvent.EVENT_TYPE, new avnav.gui.BackEvent(self.page));
        }
        if (evdata.key && evdata.key == "propertyChange") {
            $(document).trigger(avnav.util.PropertyChangeEvent.EVENT_TYPE, new avnav.util.PropertyChangeEvent(self.properties));
        }
    });

};
/**
 * sets an active input field (will disable resize events)
 * @param id
 */
avnav.gui.Handler.prototype.addActiveInput = function (id) {
    this.activeInputs[id] = true;
};

avnav.gui.Handler.prototype.removeActiveInput = function (id) {
    var trigger = (Object.keys(this.activeInputs).length > 0);
    delete this.activeInputs[id];
    if (!trigger) return;
    var self = this;
    //if we now removed focus from any input, we could resize
    //if the window size has changed
    //we delay a bit to give the on screen keyboard a chance to disappear
    setTimeout(function () {
        if (Object.keys(self.activeInputs).length == 0) {
            var ch = $(window).height();
            var cw = $(window).width();
            if (ch != self.lasth || cw != self.lastw) {
                self.lasth = ch;
                self.lastw = cw;
                self.properties.updateLayout();
                $(document).trigger(avnav.util.PropertyChangeEvent.EVENT_TYPE, new avnav.util.PropertyChangeEvent(self.properties));
            }
        }
    }, 1000);

};

avnav.gui.Handler.prototype.removeAllActiveInputs = function () {
    var trigger = (Object.keys(this.activeInputs).length > 0);
    this.activeInputs = {};
    if (trigger) this.removeActiveInput('dummy'); //trigger a resize if necessary
};


/**
 * return to a page
 * set the returning flag in options if we return
 * @param opt_options
 * @returns {boolean|*}
 */
avnav.gui.Handler.prototype.returnToLast = function (page, opt_options) {
    var spage;
    if (this.history.length == 0){
        if (page) spage=page;
        else spage="mainpage";
    }
    else{
        spage=this.history.pop();
    }
    if (!opt_options) opt_options = {};
    opt_options.returning = true;
    return this.showPage(spage, opt_options);
};
/**
 * show a certain page
 * @param {String} name
 * @param {Object} options options to be send as options with the event
 *        if skipHistory is set or returning is set - do not push to history
 * @returns {boolean}
 */

avnav.gui.Handler.prototype.showPage = function (name, options) {
    if (!name) return false;
    if (name == this.page) return false;
    if (name == "mainpage") this.history=[]; //empty history if we reach the mainpage
    else  if (! options || (! options.skipHistory && ! options.returning) ) {
            this.history.push(this.page);
    }
    this.removeAllActiveInputs();
    $('.avn_page').hide();
    $('#avi_' + name).show();
    var oldname = this.page;
    this.page = name;
    avnav.log("trigger page event");
    $(document).trigger(avnav.gui.PageEvent.EVENT_TYPE, new avnav.gui.PageEvent(
        this,
        this.navobject,
        oldname,
        name,
        options
    ));

};

avnav.gui.sendAndroidEvent = function (key, id) {
    avnav.log("android event key=" + key + ", id=" + id);
    try {
        //inform the android part that we noticed the event
        avnav.android.acceptEvent(key, id);
    } catch (e) {
    }
    $(document).trigger(avnav.gui.AndroidEvent.EVENT_TYPE, new avnav.gui.AndroidEvent(key, id));
};



