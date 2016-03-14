/**
 * Created by andreas on 04.05.14.
 */
avnav.provide('avnav.util.Overlay');


/**
 *
 * @constructor
 */
avnav.util.Overlay=function(opt_options){
    this.isOpen=false;
    if (! opt_options) opt_options={};
    this.box=opt_options.box||'.avn_overlay_box';
    this.cover=opt_options.cover||'.avn_overlay_cover';
    var self=this;
    // if window is resized then reposition the overlay box
    $(window).bind('resize',function(){self.updateOverlay();});
};

avnav.util.Overlay.prototype.showOverlayBox=function(){
    this.isOpen=true;
    this.updateOverlay();
};

avnav.util.Overlay.prototype.updateOverlay=function() {
    if( this.isOpen == false ) return;
    this.isOpen=true;
    // set the properties of the overlay box, the left and top positions
    $(this.box).css({
        display:'block',
        position:'absolute',
        opacity: 0
    });
    var self=this;
    window.setTimeout(function() {
        var left=( $(self.cover).width() - $(self.box).width() ) / 2;
        if (left < 0) left=0;
        var top=( $(self.cover).height() - $(self.box).height() ) / 2;
        if (top < 0) top=0;
        $(self.box).css({
            left: left,
            top: top,
            opacity: 1
        });
    },1);
    // set the window background for the overlay. i.e the body becomes darker
    $(this.cover).addClass('avn_overlay_cover_active');
};

avnav.util.Overlay.prototype.overlayClose=function() {
    if (! this.isOpen) return;
    //set status to closed
    this.isOpen = false;
    $(this.box).css( 'display', 'none' );
    // now animate the background to fade out to opacity 0
    // and then hide it after the animation is complete.
    $(this.cover).removeClass('avn_overlay_cover_active');
};
