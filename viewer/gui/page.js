/**
 * Created by andreas on 02.05.14.
 */

avnav.provide('avnav.gui.Page');
var navobjects=require('../nav/navobjects');
var NavData=require('../nav/navdata');
var Overlay=require('../util/overlay');
var OverlayDialog=require('../components/OverlayDialog.jsx');


/**
 * a base class for all GUI pages
 * @param name the dom id (without leading avp_)
 * @options {object} options for the page
 *          eventlist: if not empty, register for those events and call fillData(false)
 *          returnOnClick: if set to true return on click on leftPanel
 * @constructor
 */
avnav.gui.Page=function(name,options){
    this.isInitialized=false;
    /** @type{avnav.gui.Handler} */
    this.gui=null;
    /** @type{NavData} */
    this.navobject=null;
    this.name=name;
    this.visible=false;
    this.options=options;
    /**
     * should we hide the toast when leaving?
     * @type {boolean}
     * @private
     */
    this._hideToast=false;
    var myself=this;
    /**
     * a list of items with class avd_ - key are the names, values the jQuery dom objects
     * will be filled when page is initially displayed
     * @private
     * @type {{}}
     */
    this.displayItems={};
    $(document).on(avnav.gui.PageEvent.EVENT_TYPE, function(ev,evdata){

        if (evdata.oldpage != myself.name && evdata.newpage != myself.name){
            return;
        }
        myself.handlePage(evdata);
    });
    $(document).on(navobjects.NavEvent.EVENT_TYPE, function(ev,evdata){
        myself.updateDisplayObjects();
    });
    if (this.options) {
        if (this.options.eventlist) {
            $.each(this.options.eventlist, function (index, item) {
                $(document).on(item, function (ev, evdata) {
                    if (!myself.visible) return;
                    myself.fillData(false);
                });
            });
        }

    }
    this.intervalTimer=-1;
};

/**
 * get the page div (jQuery object)
 */
avnav.gui.Page.prototype.getDiv=function(){
    var div=$('#avi_'+this.name);
    return div;
};
/**
 * select elements on page
 * @param selector the jquery selector, will be prepended by #avi_pagename
 * @returns {*|jQuery|HTMLElement}
 */
avnav.gui.Page.prototype.selectOnPage=function(selector){
    return this.getDiv().find(selector);
};

avnav.gui.Page.prototype.getSelectOnPageString=function(selector){
    return '#avi_'+this.name+" "+selector;
};

/**
 * show an element on the page
 * @param selector
 * @param cssclass ndefaults to inline-block
 * @returns {*}
 */
avnav.gui.Page.prototype.show=function(selector,cssclass){
    return this.selectOnPage(selector).css('display',cssclass?cssclass:"inline-block");
};
/**
 * show an element on the page, css block
 * @param selector
 * @returns {*}
 */
avnav.gui.Page.prototype.showBlock=function(selector){
    return this.selectOnPage(selector).css('display','block');
};

/**
 * hide an element on the page
 * @param selector
 * @returns {*}
 */
avnav.gui.Page.prototype.hide=function(selector){
    return this.selectOnPage(selector).hide();
};


/**
 * check if the page is visible
 */
avnav.gui.Page.prototype.isVisible=function(){
    var rt=this.getDiv().is(':visible');
    return rt;
};

/**
 * event handler that is called by the page event
 * @param {avnav.gui.PageEvent} evdata
 * @private
 */
avnav.gui.Page.prototype.handlePage=function(evdata){
    var self=this;
    if (! this.isInitialized){
        this.gui=evdata.gui;
        /**
         *
         * @type {NavData}
         */
        this.navobject=evdata.navobject;
        this.isInitialized=true;
        this.initButtons();
        this.localInit();
        this.initDisplayObjects();
        this.initFocusHandler();
        this.initExternalLinks();
        if (this.options && this.options.returnOnClick){
            var test=this.selectOnPage('.avn_left_panel');
            this.selectOnPage('.avn_left_panel').on('click',function(){
                self.goBack();
            });
        }
        $(document).on(avnav.gui.BackEvent.EVENT_TYPE,function(ev,evdata){
           if (evdata.name && evdata.name==self.name){
               self.goBack();
           }
        });
    }
    if (this.visible != this.isVisible()){
        //visibility changed
        this.visible=this.isVisible();
        if (this.visible){
            this._showPage();
            this.showPage(evdata.options);
            this.updateDisplayObjects();
        }
        else {
            this._hidePage();
            this.hidePage();
        }
    }
};
avnav.gui.Page.prototype._showPage=function(){
    var self=this;
    if (this.intervalTimer <=0 ){
       this.intervalTimer=window.setInterval(function(){ self._timerEvent();},
           self.gui.properties.getProperties().buttonUpdateTime);
    }
    this._hideToast=false;
};
avnav.gui.Page.prototype._hidePage=function(){
    if (this.intervalTimer >= 0){
        window.clearInterval(this.intervalTimer);
        this.intervalTimer=-1;
    }
    if (this._hideToast) Overlay.hideToast();
    OverlayDialog.hide();

};
/**
 *
 * @private
 */
avnav.gui.Page.prototype._timerEvent=function(){
  if (this.isVisible()) {
      this.timerEvent();
  }
  else{
    if (this.intervalTimer >= 0){
        window.clearInterval(this.intervalTimer);
        this.intervalTimer=-1;
    }
  }
};
/**
 * to be overloaded
 */
avnav.gui.Page.prototype.timerEvent=function(){

};
/**
 * initially fill the list of items that will be update on nav events
 */
avnav.gui.Page.prototype.initDisplayObjects=function(){
    var names=this.navobject.getValueNames();
    var self=this;
    for (var i=0;i< names.length;i++){
        this.getDiv().find('.avd_'+names[i]).each(function(idx,el){
            if (self.displayItems[names[i]] === undefined){
                self.displayItems[names[i]]=[];
            }
            self.displayItems[names[i]].push(el);
        });
    }
};

/**
 * update all display items from navobject
 */
avnav.gui.Page.prototype.updateDisplayObjects=function(){
    var name;
    for (name in this.displayItems){
        var ellist=this.displayItems[name];
        var el;
        for (el in ellist) {
            var val = this.navobject.getValue(name);
            $(ellist[el]).text(val);
        }
    }
};

/**
 * init function called after receiving the first event
 * intended to be overloaded by subclasses
 */
avnav.gui.Page.prototype.localInit=function(){

};

/**
 * function to handle back-keys
 * intended to be overloaded by subclasses
 */
avnav.gui.Page.prototype.goBack=function(){
    this.returnToLast();
};

/**
 * return to the last page in the history stack
 */
avnav.gui.Page.prototype.returnToLast=function(){
    if (! this.gui) return;
    this.gui.returnToLast();
};

/**
 * to be overloaded by pages
 * @param initial
 */
avnav.gui.Page.prototype.fillData=function(initial){

};

/**
 * init the buttons (i.e. assign listeners and add the icons)
 * each button click will call a btn<ButtonName> method at this gui object
 * ButtonName is the id of the button minus the leading avb_
 * @private
 *
 */
avnav.gui.Page.prototype.initButtons=function(){
    var page=this;
    var div=this.getDiv();
    this.selectOnPage('.avn_button').each(function (i, e) {
        var classList = $(e).attr('class').split(/\s+/);
        $.each(classList, function(index, item) {
            if (! item.match(/^avb_/)) return;
            //$(e).html('<span class="avn_button_icon"></span>');
            if (item) {
                var id = item.replace(/^avb_/, '');
                var proto = Object.getPrototypeOf(page);
                var f = proto['btn' + id];
                if (f) {
                    $(e).click(function (b) {
                        f.call(page, this, b);
                        avnav.log("clicked " + id + "at " + b);
                        return false;
                    });
                }
            }
        });
        if ($(e).hasClass("avn_android") && avnav.android){
            $(e).show();
        }
        if ($(e).hasClass("avn_no_android") && avnav.android){
            $(e).hide();
        }
    });

};

avnav.gui.Page.prototype.initFocusHandler=function() {
    var page = this;
    var div = this.getDiv();
    var num=0;
    $(div).find('input').each(function(id,el){
        var id=page.name+num;
        $(el).on('focus', function () {
            page.gui.addActiveInput(id);
        });
        $(el).on('blur', function () {
            page.gui.removeActiveInput(id);
        });
        num++;
    });
};
/**
 * @private
 */
avnav.gui.Page.prototype.initExternalLinks=function(){
    if (! avnav.android) return;
    var self=this;
    $('.avn_extlink').on('click',function(ev){
        var url=$(this).attr('href');
        avnav.android.externalLink(url);
        ev.preventDefault();
        return false;
    });
};

/**
 * function to be overloaded by pages
 */
avnav.gui.Page.prototype.showPage=function(){

};
/**
 * function to be overloaded by pages
 */
avnav.gui.Page.prototype.hidePage=function(){

};

/**
 * handle the status display of a toggle button
 * @param id
 * @param onoff
 * @param onClass
 */
avnav.gui.Page.prototype.handleToggleButton=function(id,onoff,onClass){
    var oc=onClass || "avn_buttonActive";
    if (onoff){
        this.selectOnPage(id).removeClass("avn_buttonActive");
        this.selectOnPage(id).removeClass("avn_buttonActiveError");
        this.selectOnPage(id).addClass(oc);
        this.selectOnPage(id).removeClass("avn_buttonInactive");
    }
    else {
        this.selectOnPage(id).removeClass("avn_buttonActive");
        this.selectOnPage(id).removeClass("avn_buttonActiveError");
        this.selectOnPage(id).addClass("avn_buttonInactive");
    }
};

/**
 * show or hide an panel and resize some related
 * @param id - #id or .class of the panel
 * @param show - true for show, fals for hide
 * @param mainid #id or .class for a panel - if the panel to show has one of the classes
 *               anv_left|right|top|bottom it is resized...
 * @returns {boolean} - true when mainid something changed
 */
avnav.gui.Page.prototype.showHideAdditionalPanel=function(id,show,mainid){
    var updateSize=false;
    if (show){
        if (!$(id).is(':visible')) {
            $(id).show();
            updateSize=true;
        }
    }
    else {
        if ($(id).is(':visible')) {

            updateSize = true;
        }
        $(id).hide();

    }
    if (updateSize) {
        this.updateMainPanelSize(mainid);
        //additional top/bottom panels should only fill the same width as main
        $('.avn_top:visible').css('left', $(mainid).css('left'));
        $('.avn_bottom:visible').css('left', $(mainid).css('left'));
        $('.avn_top:visible').css('right', $(mainid).css('right'));
        $('.avn_bottom:visible').css('right', $(mainid).css('right'));
        return true;
    }
    return false;
};

avnav.gui.Page.prototype.updateMainPanelSize=function(mainid){
    var main=$(mainid);
    if (! main) return;
    var args=[
        {cl:'.avn_top',main:'top',el:'height',neg:false},
        {cl:'.avn_left',main:'left',el:'width',neg:false},
        {cl:'.avn_bottom',main:'bottom',el:'height',neg:false},
        {cl:'.avn_right',main:'right',el:'width',neg:false}
    ];
    var nval, k,arg,last;
    for (var k in args){
        arg=args[k];
        last=arg.neg?99999:0;
        nval=last;
        main.parent().find(arg.cl).each(function(id,el){
            if ($(el).is(':visible')){
                var v=parseInt($(el).css(arg.el).replace(/px/,""));
                if (( arg.neg && v < last) || (! arg.neg && v>last)) {
                    last=v;
                    nval=v;
                }
            }
        });
        main.css(arg.main,nval);
    }
};

avnav.gui.Page.prototype.goBack=function(){
    this.returnToLast();
};

avnav.gui.Page.prototype.toast=function(html,opt_hide){
    Overlay.Toast(html);
    this._hideToast=opt_hide||false;
};
avnav.gui.Page.prototype.hideToast=function(){
    Overlay.hideToast();
}
avnav.gui.Page.prototype.getDialogContainer=function(){
    return this.selectOnPage('.avn_left_panel')[0];
};

/*-------------------------------------------------------
   default button
 */
avnav.gui.Page.prototype.btnCancel=function(){
  this.returnToLast();
};