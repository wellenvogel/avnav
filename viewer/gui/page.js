/**
 * Created by andreas on 02.05.14.
 */

avnav.provide('avnav.gui.Page');



/**
 * a base class for all GUI pages
 * @constructor
 */
avnav.gui.Page=function(name){
    this.isInitialized=false;
    /** @type{avnav.gui.Handler} */
    this.gui=null;
    /** @type{avnav.nav.NavObject} */
    this.navobject=null;
    this.name=name;
    this.visible=false;
    this.returnpage=undefined;
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
    $(document).on(avnav.nav.NavEvent.EVENT_TYPE, function(ev,evdata){
        myself.updateDisplayObjects();
    });
};

/**
 * get the page div (jQuery object)
 */
avnav.gui.Page.prototype.getDiv=function(){
    var div=$('#avi_'+this.name);
    return div;
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
        this.navobject=evdata.navobject;
        this.isInitialized=true;
        this.initButtons();
        this.localInit();
        this.initDisplayObjects();
        this.initFocusHandler();
        this.initExternalLinks();
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
            if (evdata.options && evdata.options.returnpage){
                this.returnpage=evdata.options.returnpage;
            }
            else {
                if (!evdata.options || !evdata.options.returning)this.returnpage=undefined;
                //keep returnpage unchanged if we return
            }
            this.showPage(evdata.options);
            this.updateDisplayObjects();
        }
        else {
            this.hidePage();
        }
    }
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
    $(div).find('.avn_button').each(function (i, e) {
        //$(e).html('<span class="avn_button_icon"></span>');
        var id = $(e).attr('id');
        if (id) {
            id = id.replace(/^avb_/, '');
            var proto=Object.getPrototypeOf(page);
            var f=proto['btn'+id];
            if (f) {
                $(e).click(function (b) {
                    f.call(page, this, b);
                    log("clicked " + id + "at " + b);
                    return false;
                });
            }
        }
        if ($(e).hasClass("avn_android") && avnav.android){
            $(e).show();
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
        $(id).removeClass("avn_buttonActive");
        $(id).removeClass("avn_buttonActiveError");
        $(id).addClass(oc);
        $(id).removeClass("avn_buttonInactive");
    }
    else {
        $(id).removeClass("avn_buttonActive");
        $(id).removeClass("avn_buttonActiveError");
        $(id).addClass("avn_buttonInactive");
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
