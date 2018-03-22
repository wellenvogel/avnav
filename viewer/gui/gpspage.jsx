/**
 * Created by Andreas on 27.04.2014.
 */

var Page=require('./page.jsx');
var React=require('react');
var ItemUpdater=require('../components/ItemUpdater.jsx');
var navobjects=require('../nav/navobjects');
var Formatter=require('../util/formatter');

const keys={
  anchorWatch:'anchorWatch', //TODO: should become global
  secondPage: 'second'
};

/**
 *
 * @constructor
 */
var Gpspage=function(){
    Page.call(this,'gpspage');
    /**
     * @private
     * @type {Formatter}
     */
    this.formatter=new Formatter();
};
avnav.inherits(Gpspage,Page);



Gpspage.prototype.showPage=function(options){
    if (!this.gui) return;
    this.gui.navobject.setAisCenterMode(navobjects.AisCenterMode.GPS);
    this.gui.navobject.getAisHandler().setTrackedTarget(0);
    this.store.storeData(keys.secondPage,false);
    this.handleToggleButton('Gps2',false);
    this.computeLayout();
};


Gpspage.prototype.hidePage=function(){

};

Gpspage.prototype.createElememt=function(key,unit,rel){
    var self=this;
    var Element=function(props){
        return(
            
                <div>
                    <span className='avn_gpsp_value' data-avnrel={rel}>{props[key]}</span>
                    <span className='avn_gpsp_unit'>{unit}</span>
                </div>
        );
    };
    return React.createElement(ItemUpdater(Element,self.gui.navobject,key));
};

Gpspage.prototype.getPageContent=function(){
    var self=this;
    var buttons=[
        {key:'GpsCenter'},
        {key: "Gps2",toggle:true},
        {key: "AnchorWatch",toggle:true},
        {key:'Cancel'}
    ];
    this.setButtons(buttons);
    $(window).on('resize',function(){
        self.computeLayout();
    });
    
    
    $(document).on(navobjects.NavEvent.EVENT_TYPE, function(ev,evdata){
        self.navEvent(evdata);
    });
    var Main=React.createClass({
        goBack: function(){
            self.returnToLast();
        },
        render: function(){
            return (
                <div className="avn_panel_fill" onClick={this.goBack}>
                    {!this.props.anchorWatch ?
                        <div id='avi_gps_page_left' className="avn_gpsp_hfield">
                            <div className='avn_gpsp_vfield avn_gpsp_cunit' data-avnfs="28">
                                <div className='avn_gpsp_field_label'>WP-BRG</div>
                                {self.createElememt('markerCourse', "\u00b0", 4)}
                            </div>

                            <div id='avi_gpsp_xte_field' className='avn_gpsp_vfield' data-avnfs="28">
                                <div id='avi_gpsp_xte_label' className='avn_gpsp_field_label'>WP - XTE</div>
                                <canvas id="avi_gpsp_xte"></canvas>
                            </div>
                            <div className='avn_gpsp_vfield' data-avnfs="15">
                                <div className='avn_gpsp_field_label'>WP-DST</div>
                                {self.createElememt('markerDistance', 'nm', 5)}
                            </div>
                            <div className='avn_gpsp_vfield' data-avnfs="15">
                                <div className='avn_gpsp_field_label'>WP - ETA</div>
                                {self.createElememt('markerEta', '', 8)}
                            </div>
                            <div className='avn_gpsp_vfield' data-avnfs="15">
                                <div id="avi_gpsp_route_dist">
                                    <div className='avn_gpsp_field_label'>RTE dist</div>
                                    {self.createElememt('routeRemain', 'nm', 5)}
                                </div><div id="avi_gpsp_route_dist">
                                    <div className='avn_gpsp_field_label'>RTE dist</div>
                                    {self.createElememt('routeRemain', 'nm', 5)}
                                </div>
                                <div id="avi_gpsp_route_eta">
                                    <div className='avn_gpsp_field_label'>RTE ETA</div>
                                    {self.createElememt('routeEta', '', 8)}
                                </div>
                                <div id="avi_gpsp_route_eta">
                                    <div className='avn_gpsp_field_label'>RTE ETA</div>
                                    {self.createElememt('routeEta', '', 8)}
                                </div>
                            </div>

                        </div>
                        :
                        <div id='avi_gps_page_left' className="avn_gpsp_hfield">
                            <div className='avn_gpsp_vfield avn_gpsp_cunit' data-avnfs="28">
                                <div className='avn_gpsp_field_label'>ACHR-BRG</div>
                                {self.createElememt('anchorDirection', "\u00b0", 4)}
                            </div>

                            <div className='avn_gpsp_vfield' data-avnfs="28">
                                <div className='avn_gpsp_field_label'>ACHR-DST</div>
                                {self.createElememt('anchorDistance', 'm', 8)}
                            </div>
                            <div className='avn_gpsp_vfield' data-avnfs="15">
                                <div className='avn_gpsp_field_label'>ACHR-WATCH</div>
                                {self.createElememt('anchorWatchDistance', 'm', 8)}
                            </div>
                            <div className='avn_gpsp_vfield' data-avnfs="30">
                            </div>


                        </div>

                    }
                    {!this.props[keys.secondPage] ?
                        <div id='avi_gps_page_right' className="avn_gpsp_hfield">
                            <div id='avi_gpsp_course' className='avn_gpsp_vfield avn_gpsp_cunit' data-avnfs="28">
                                <div className='avn_gpsp_field_label'>COG</div>
                                {self.createElememt('gpsCourse', "\u00b0", 4)}
                            </div>
                            <div id='avi_gpsp_speed' className='avn_gpsp_vfield' data-avnfs="28">
                                <div className='avn_gpsp_field_label'>SOG</div>
                                {self.createElememt('gpsSpeed', 'kn', 5)}
                            </div>
                            < div className='avn_gpsp_vfield' data-avnfs="15">
                                <div className='avn_gpsp_field_label'>Local Time</div>
                                {self.createElememt('gpsTime', '', 8)}
                            </div>
                            <div className='avn_gpsp_vfield' data-avnfs="15">
                                <div className='avn_gpsp_field_label'>Pos</div>
                                {self.createElememt('gpsPosition', '', 15)}
                            </div>
                            <div className='avn_gpsp_vfield' data-avnfs="15">
                                <div className='avn_gpsp_field_label'>AIS</div>
                                <div id="avi_gpsp_aisframe" className="avn_gpsp_value" data-avnrel="22" onClick={
                                    function (ev) {
                                        ev.stopPropagation();
                                        self.gui.showPage('aisinfopage');
                                    }
                                }>
                                    <div id="avi_gpsp_ais_status"></div>
                                    <div id='avi_gpsp_ais'></div>
                                    <span id="avi_aisStatusText"></span>
                                </div>
                            </div>
                        </div>
                        :
                        <div id='avi_gps_page_right' className="avn_gpsp_hfield">
                            <div id='avi_gpsp_course' className='avn_gpsp_vfield avn_gpsp_cunit' data-avnfs="28">
                                <div className='avn_gpsp_field_label'>COG</div>
                                {self.createElememt('gpsCourse', "\u00b0", 4)}
                            </div>
                            <div id='avi_gpsp_speed' className='avn_gpsp_vfield' data-avnfs="28">
                                <div className='avn_gpsp_field_label'>SOG</div>
                                {self.createElememt('gpsSpeed', 'kn', 5)}
                            </div>

                            < div className='avn_gpsp_vfield' data-avnfs="15">
                                <div className='avn_gpsp_field_label'>Wind Angle</div>
                                {self.createElememt('windAngle', "\u00b0", 5)}
                            </div>
                            <div className='avn_gpsp_vfield' data-avnfs="15">
                                <div className='avn_gpsp_field_label'>WindSpeed</div>
                                {self.createElememt('windSpeed', 'm/s', 4)}
                            </div>
                            <div className='avn_gpsp_vfield' data-avnfs="15">
                                <div className='avn_gpsp_field_label'>AIS</div>
                                <div id="avi_gpsp_aisframe" className="avn_gpsp_value" data-avnrel="22" onClick={
                                    function (ev) {
                                        ev.stopPropagation();
                                        self.gui.showPage('aisinfopage');
                                    }
                                }>
                                    <div id="avi_gpsp_ais_status"></div>
                                    <div id='avi_gpsp_ais'></div>
                                    <span id="avi_aisStatusText"></span>
                                </div>
                            </div>


                        </div>
                    }
                    {self.getAlarmWidget()}
                </div>
            );
        },
        componentDidMount: function(){
            self.computeLayout();
        },
        componentDidUpdate: function(){
            self.computeLayout();
        }
    });
    return ItemUpdater(Main,this.store,[keys.anchorWatch,keys.secondPage]);
};

/**
 * compute the layout for the page
 * we assum n columns of class avn_gpsp_vfield
 * within each solumn we have n boxes of class avn_gpsp_hfield each having
 *   an attr avnfs given the height weight of this field
 * within eacho of such boxes we assume n avn_gpsp_value floating left each
 * having an attr avnrel given a relative with (nearly character units)
 * @private
 */
Gpspage.prototype.computeLayout=function(){
    var numhfields=0;
    this.getDiv().find('.avn_gpsp_hfield').each(function(i,el){
        numhfields++;
    });
    if (numhfields == 0) return;
    var hfieldw=100/numhfields;
    this.getDiv().find('.avn_gpsp_hfield').each(function(i,el){
        $(el).css('width',hfieldw+"%");
        var vwidth=$(el).width();
        var vheight=$(el).height();
        var numhfields=0;
        var weigthsum=0;
        var vfieldweights=[];
        var vfieldlengths=[];
        $(el).find('.avn_gpsp_vfield').each(function(idx,hel){
            numhfields++;
            vfieldweights[idx]=parseFloat($(hel).attr('data-avnfs'));
            weigthsum+=vfieldweights[idx];
            var len=0;
            $(hel).find('.avn_gpsp_value').each(function(vidx,vel){
                len+=parseFloat($(vel).attr('data-avnrel'));
            });
            vfieldlengths[idx]=len;
        });
        $(el).find('.avn_gpsp_vfield').each(function(idx,hel){
            var relheight=vfieldweights[idx]/weigthsum*100;
            $(hel).css('height',relheight+"%");
            var fontbase=relheight*vheight*0.7/100;
            var labelbase=fontbase;
            var padding=0;
            if ((fontbase * vfieldlengths[idx]) > vwidth ){
                var nfontbase = vwidth/(vfieldlengths[idx]);
                padding=(fontbase-nfontbase)/2;
                fontbase=nfontbase;
            }
            $(hel).find('.avn_gpsp_value').each(function(vidx,vel){
                $(vel).css('font-size',fontbase+"px");
                $(vel).css('padding-top',padding+"px");
            });
            $(hel).find('.avn_gpsp_unit').each(function(vidx,vel){
                $(vel).css('font-size',fontbase*0.3+"px");
            });
            $(hel).find('.avn_gpsp_field_label').each(function(vidx,vel){
                $(vel).css('font-size',labelbase*0.2+"px");
            });
        });

    });
    var xh=$('#avi_gpsp_xte_field').height()-$('#avi_gpsp_xte_label').height();
    try {
        var canvas=document.getElementById('avi_gpsp_xte');
        canvas.height = xh;
        canvas.style.height=xh+"px";
        canvas.width=$('#avi_gpsp_xte').width();
    }catch(e){}

};

/**
 *
 * @param {CanvasRenderingContext2D} context
 */
Gpspage.prototype.drawXte=function(context){
    if (! this.isVisible()) return;
    var xteMax=this.gui.properties.getProperties().gpsXteMax;
    var xteText=this.formatter.formatDecimal(xteMax,1,1)+"nm";
    var color=$('#avi_gpsp_xte').css('color');
    context.fillStyle =color;
    context.strokeStyle=color;
    var w=context.canvas.width;
    var h=context.canvas.height;
    context.clearRect(0,0,w,h);
    //fix for duplicate canvas in Android 4.x stock browser and webview
    //https://medium.com/@dhashvir/android-4-1-x-stock-browser-canvas-solution-ffcb939af758
    context.canvas.style.visibility ='hidden'; // Force a change in DOM
    context.canvas.offsetHeight; // Cause a repaint to take play
    context.canvas.style.visibility = 'inherit'; // Make visible again
    var textBase=h*0.9;
    var textSize=h*0.2;
    var left=w*0.1;
    var right=w*0.9;
    var linebase=h*0.4;
    var sideHeight=h*0.3;
    var middleHeight=h*0.6;
    var shipUpper=h*0.45;
    var shipH=h*0.3;
    var shipw=w*0.03;
    var mText="0";
    context.font="normal "+Math.ceil(textSize)+"px Arial";
    context.textAlign="center";
    context.fillText(xteText,left,textBase);
    context.fillText(xteText,right,textBase);
    context.fillText("0",0.5*w,textBase);
    context.lineWidth=3;
    context.beginPath();
    context.moveTo(left,linebase-0.5*sideHeight);
    context.lineTo(left,linebase+0.5*sideHeight);
    context.moveTo(left,linebase);
    context.lineTo(right,linebase);
    context.moveTo(right,linebase-0.5*sideHeight);
    context.lineTo(right,linebase+0.5*sideHeight);
    context.moveTo(0.5*w,linebase-0.5*middleHeight);
    context.lineTo(0.5*w,linebase+0.5*middleHeight);
    context.stroke();
    context.closePath();
    var curXte=this.navobject.getComputedValues();
    if (curXte === undefined) return;
    var xtepos=curXte.markerXte/xteMax;
    if (xtepos < -1.1) xtepos=-1.1;
    if (xtepos > 1.1) xtepos=1.1;
    xtepos=xtepos*(right-left)/2+left+(right-left)/2;
    context.beginPath();
    context.moveTo(xtepos,shipUpper);
    context.lineTo(xtepos-shipw,shipUpper+shipH);
    context.lineTo(xtepos+shipw,shipUpper+shipH);
    context.lineTo(xtepos,shipUpper);
    context.fill();
    context.closePath();
};

Gpspage.prototype.navEvent=function(evt){
    var canvas=$('#avi_gpsp_xte')[0];
    if (canvas) this.drawXte(canvas.getContext("2d"));
    var nearestTarget = this.navobject.getAisHandler().getNearestAisTarget();
    var color="";
    if (this.gui.properties.getProperties().layers.ais && nearestTarget.cpa ){
        var txt="CPA: "+this.navobject.getValue('aisCpa')+"nm&nbsp;TCPA: "+this.navobject.getValue('aisTcpa');
        $('#avi_gpsp_ais').html(txt);
        color=this.gui.properties.getAisColor({
            nearest: true,
            warning: nearestTarget.warning
        });
    }
    else {
        $('#avi_gpsp_ais').text("");
        color="";
    }
    $('#avi_gpsp_ais_status').css('background-color',color);
    this.store.updateData(keys.anchorWatch,{anchorWatch:!!this.gui.navobject.getRoutingHandler().getAnchorWatch()});

};

//-------------------------- Buttons ----------------------------------------
Gpspage.prototype.btnGpsCenter=function (button,ev){
    avnav.log("Center clicked");
    var pos=this.gui.navobject.getGpsHandler().getGpsData();
    if (pos.valid){
        this.gui.map.setCenter(pos);
    }
    this.returnToLast();
};
Gpspage.prototype.btnGps2=function (button,ev){
    let old=this.store.getData(keys.secondPage,false);
    this.store.storeData(keys.secondPage,!old);
    this.handleToggleButton('Gps2',!old);
};


(function(){
    //create an instance of the status page handler
    var page=new Gpspage();
}());


