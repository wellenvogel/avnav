/**
 * Created by andreas on 04.05.14.
 */
var Overlay={};
/**
 *
 * @constructor
 */
Overlay=function(opt_options){
    this.isOpen=false;
    if (! opt_options) opt_options={};
    this.box=opt_options.box||'.avn_overlay_box';
    this.cover=opt_options.cover||'.avn_overlay_cover';
    var self=this;
    // if window is resized then reposition the overlay box
    this.updateOverlayCb=this.updateOverlay.bind(this);
    this._coverShown=false;
};

Overlay.prototype.showOverlayBox=function(){
    this.isOpen=true;
    var self=this;
    $(window).bind('resize',self.updateOverlayCb);
    this.updateOverlay();
};
Overlay.prototype.select=function(query){
  return $(this.box).find(query);
};

Overlay.prototype.updateOverlay=function() {
    if( this.isOpen == false ) return;
    this.isOpen=true;
    // set the properties of the overlay box, the left and top positions
    var self=this;
    $(this.box).css({
        display:'block',
        position:'absolute',
        opacity: 0,
        'max-width': $(self.cover).width()+"px",
        'max-height':$(self.cover).height()+"px"


    });
    window.setTimeout(function() {
        var left=( $(self.cover).width() - $(self.box).outerWidth() ) / 2;
        if (left < 0) left=0;
        var top=( $(self.cover).height() - $(self.box).outerHeight() ) / 2;
        if (top < 0) top=0;
        $(self.box).css({
            left: left,
            top: top,
            opacity: 1
        });
    },1);
    // set the window background for the overlay. i.e the body becomes darker
    if (! this._coverShown) {
        $(this.cover).append('<div class="avn_overlay_cover avn_overlay_cover_active"></div>');
        this._coverShown=true;
    }
};

Overlay.prototype.overlayClose=function() {
    if (! this.isOpen) return;
    var self=this;
    $(window).unbind('resize',self.updateOverlayCb);
    //set status to closed
    this.isOpen = false;
    $(this.box).css( 'display', 'none' );
    // now animate the background to fade out to opacity 0
    // and then hide it after the animation is complete.
    $(this.cover).find('.avn_overlay_cover_active').remove();
    this._coverShown=false;
};

Overlay.Toast=function(html,time){
    if (! time) time=5000;
    $('#avi_toast').finish();
    $('#avi_toast').unbind('click');
    $('#avi_toast').html(html);
    $('#avi_toast').bind('click', function(){
        $(this).stop();
        $(this).fadeOut(1);
    });
    $('#avi_toast').fadeIn(400).delay(time).fadeOut(400);
};
Overlay.hideToast=function(){
    $('#avi_toast').stop().fadeOut(1);
};

module.exports=Overlay;