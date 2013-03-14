/*
# vim: ts=2 sw=2 et
###############################################################################
# Copyright (c) 2012, Andreas Vogel andreas@wellenvogel.net
# parts of the software are taken from tiler_tools
# http://code.google.com/p/tilers-tools/
# the license below applies also to this complete software
#
###############################################################################
# Copyright (c) 2011, Vadim Shlyakhov
#
#  Permission is hereby granted, free of charge, to any person obtaining a
#  copy of this software and associated documentation files (the "Software"),
#  to deal in the Software without restriction, including without limitation
#  the rights to use, copy, modify, merge, publish, distribute, sublicense,
#  and/or sell copies of the Software, and to permit persons to whom the
#  Software is furnished to do so, subject to the following conditions:
#
#  The above copyright notice and this permission notice shall be included
#  in all copies or substantial portions of the Software.
#
#  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
#  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
#  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
#  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
#  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
#  DEALINGS IN THE SOFTWARE.
###############################################################################
*/

var properties={
		maxUpscale:8, //3 levels upscale (otherwise we need too much mem)
		minGridLedvel: 10,
		showOSM: true,
		rightPanelWidth: 60,
		loggingEnabled: true,
		positionQueryTimeout: 1000, //1000ms
};
var zoomOffset=0;
var maxZoom=0;
var map=null;
var rightWidth=60; //the control button panel
var markerFeature=null;
var boatFeature=null;
var timer=null;
var handleBoat=true;
var currentAngle=0;
OpenLayers.Control.ClickBar = OpenLayers.Class(OpenLayers.Control, {

    clickBarDiv: null,
    divEvents: null,
    title : 'Click to set opacity of the overlay',
    
    /**
     * Constructor: OpenLayers.Control.ClickBar
     *
     * Parameters:
     * options - {Object}
     */
    initialize: function(options) {
        OpenLayers.Control.prototype.initialize.apply(this, arguments);
    },

    /**
     * APIMethod: destroy
     */
    destroy: function() {

        this._removeClickBar();
        OpenLayers.Control.prototype.destroy.apply(this, arguments);
    },

    /** 
     * Method: redraw
     * clear the div and start over.
     */
    redraw: function() {
        if (this.div != null) {
            this._removeClickBar();
        }  
        this.draw();
    },
    
    /**
    * Method: draw 
    *
    * Parameters:
    * px - {<OpenLayers.Pixel>} 
    */
    draw: function(px) {
        // initialize our internal div
        OpenLayers.Control.prototype.draw.apply(this, arguments);

        this._addClickBar();
        return this.div;
    },

    /** 
    * Method: _addClickBar
    * 
    * Parameters:
    * location - {<OpenLayers.Pixel>} where ClickBar drawing is to start.
    */
    _addClickBar:function() {
        var id = this.id + "_" + this.map.id;
        var div = OpenLayers.Util.createDiv(
                    id,//'OpenLayers_Control_ClickBar' + this.map.id,
                    null,//location,
                    null,
                    null,
                    "relative");

        this.clickBarDiv = div;
        this.divEvents = new OpenLayers.Events(this, div, null, true, 
                                                {includeXY: true});
        this.divEvents.on({
            "click": this.click
        });
        
        this.div.appendChild(div);

        this.ratioDisplay();                
        return this.div; 
    },
    
    /**
     * Method: _removeClickBar
     */
    _removeClickBar: function() {
        this.divEvents.un({
            "click": this.click
        });
        this.divEvents.destroy();
        
        this.div.removeChild(this.clickBarDiv);
        this.clickBarDiv = null;
    },

    click: function (event) {
        this.clickToRatio(event);
    },
    
    ratio: 0.5,
    
    clickMargin: 7,
    
    clickToRatio: function(event) {
        var rect=this.clickBarDiv.getBoundingClientRect();
        var w=rect.width-this.clickMargin*2;
        var offx=Math.round(event.layerX-this.clickMargin);

        var ratio=offx/w;
        if (ratio < 0) ratio=0;
        if (ratio > 1) ratio=1;
        this.ratio=ratio;
        this.ratioDisplay();                
        },

    reportRatio: null, // function(ratio){log(ratio)},
    
    ratioDisplay: function (){
        var s = OpenLayers.Number.format(this.ratio,1);
        this.clickBarDiv.innerHTML = '<- ' + s + ' ->';
        this.reportRatio(this.ratio);    
        },

    CLASS_NAME: "OpenLayers.Control.ClickBar"
});


OpenLayers.Layer.TilerToolsXYZ=OpenLayers.Class(OpenLayers.Layer.XYZ,{
  initialize: function(options){
    OpenLayers.Layer.XYZ.prototype.initialize.apply(this,arguments);
  },
  getServerResolution: function(resolution) {
      var distance = Number.POSITIVE_INFINITY;
      resolution = resolution || this.map.getResolution();
      if(this.serverResolutions &&
         OpenLayers.Util.indexOf(this.serverResolutions, resolution) === -1) {
          var i, newDistance, newResolution, serverResolution;
          for(i=this.serverResolutions.length-1; i>= 0; i--) {
              newResolution = this.serverResolutions[i];
              newDistance = Math.abs(newResolution - resolution);
              if (newDistance > distance) {
                  break;
              }
              distance = newDistance;
              serverResolution = newResolution;
          }
          resolution = serverResolution;
      }
      return resolution;
  },
  getXYZ: function(bounds) {
    var origin = this.getTileOrigin();
    var res = this.getServerResolution();
    var x = Math.round((bounds.left - origin.lon) /
        (res * this.tileSize.w));
    var y = Math.round((origin.lat - bounds.top) /
        (res * this.tileSize.h));
    var z = this.map.getZoomForResolution(res,true) + this.zoomOffset;
    var limit = Math.pow(2, z);
    if (this.wrapDateLine)
    {
       x = ((x % limit) + limit) % limit;
    }
    
    if (this.profile == 'global-mercator')
        y= -y - 1;

    return {'x': x, 'y': y, 'z': z};
  },
  //handle our list of bounding boxes - return null if the tile is not within
  getURL: function (bounds) {
	  var fits=false;
	  if (this.boundings != null){
		  for (var i in this.boundings){
			  if (this.boundings[i].intersectsBounds(bounds)){
				  fits=true;
				  break;
			  }
		  }
	  }
	  if (! fits){
		  return null;
	  }
      var xyz = this.getXYZ(bounds);
      var url = this.url;
      if (OpenLayers.Util.isArray(url)) {
          var s = '' + xyz.x + xyz.y + xyz.z;
          url = this.selectUrl(s, url);
      }
      
      return OpenLayers.String.format(url, xyz);
  },
  
            // openlayers 2.11 and below do not take into account TileOrigin
  getTileBounds: function(viewPortPx) { 
    var origin = this.getTileOrigin();
    var resolution = this.getResolution();
    var tileMapWidth = resolution * this.tileSize.w;
    var tileMapHeight = resolution * this.tileSize.h;
    var mapLocation = this.getLonLatFromViewPortPx(viewPortPx);
    var tileLeft = origin.lon + 
        (tileMapWidth * Math.floor((mapLocation.lon - origin.lon) / tileMapWidth));
    var tileBottom = origin.lat + 
        (tileMapHeight * Math.floor((mapLocation.lat - origin.lat) / tileMapHeight));
        
    //log(tileLeft,tileBottom);
    return new OpenLayers.Bounds(tileLeft, tileBottom,
                                 tileLeft + tileMapWidth,
                                 tileBottom + tileMapHeight);
  },
  CLASS_NAME: "OpenLayers.Layer.TilerToolsXYZ"

});


function log(msg) {
	if (! properties.loggingEnabled) return;
  try { console.log.apply(console,arguments); } 
  catch (e) {
      setTimeout(function() {
          throw new Error(msg);
      }, 0);
  }
}

function logMapPos(txt,lonlat){
	log("pos: "+txt+" lon="+lonlat.lon+" , lat="+lonlat.lat);
}

function error(msg) {
  throw new Error(msg);
}

/*
   Provide the XMLHttpRequest constructor for Internet Explorer 5.x-6.x:
   Other browsers (including Internet Explorer 7.x-9.x) do not redefine
   XMLHttpRequest if it already exists.
 
   This example is based on findings at:
   http://blogs.msdn.com/xmlteam/archive/2006/10/23/using-the-right-version-of-msxml-in-internet-explorer.aspx
*/
if (typeof XMLHttpRequest == "undefined")
  XMLHttpRequest = function () {
    try { return new ActiveXObject("Msxml2.XMLHTTP.6.0"); }
      catch (e) {}
    try { return new ActiveXObject("Msxml2.XMLHTTP.3.0"); }
      catch (e) {}
    try { return new ActiveXObject("Microsoft.XMLHTTP"); }
      catch (e) {}
    //Microsoft.XMLHTTP points to Msxml2.XMLHTTP and is redundant
    throw new Error("This browser does not support XMLHttpRequest.");
  };

//read the TMS spec for a layer
function read_xml(url) {
    var request = new XMLHttpRequest();
    request.open('GET', url, false);
    request.overrideMimeType("text/xml");
    try {
        request.send(null);
        if (request.status != 0) {
            log(request.status);
          log(request.responseText);
        }
    } catch (e) {
        log(e);
        if (e.code == 101) {
            alert('Google Chrome requires to run with "--allow-file-access-from-files" switch to load XML from local files');
        }
    }
    //log(request);
    return request.responseXML;
}

function e2f(elem,attr_idx) {
    return parseFloat(elem.getAttribute(attr_idx));
}
//        Proj4js.defs["EPSG:3857"]="+title=GoogleMercator +proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +no_defs"; 

//        var mapProjection = "EPSG:3857";





 
function read_map_parameters(url) {    
	var rt={};
    var tilemap=read_xml(url);
    if (tilemap == null) {
      error('Cannot read '+url);
        return null;
    }
    rt.layer_profile=tilemap.getElementsByTagName("TileSets")[0].getAttribute('profile');
    if (rt.layer_profile != 'global-mercator' && rt.layer_profile != 'zxy-mercator') {
      error('unsupported profile in tilemap.xml '+rt.layer_profile);
        return null;
    }
    rt.layer_srs = tilemap.getElementsByTagName("SRS")[0].textContent;
    if (rt.layer_srs != 'OSGEO:41001') {
      error('tilemap.xml: unsupported SRS');
        return null;
    }
    rt.title = tilemap.getElementsByTagName("Abstract")[0].textContent;
    if (rt.title == null){
    	rt.title = tilemap.getElementsByTagName("Title")[0].textContent;
    }
    document.title = rt.title;

    var box_el = tilemap.getElementsByTagName("BoundingBox")[0];
    rt.layer_extent = new OpenLayers.Bounds(e2f(box_el,'minx'),e2f(box_el,'miny'),e2f(box_el,'maxx'),e2f(box_el,'maxy'));

    var origin_el = tilemap.getElementsByTagName("Origin")[0];
    rt.tile_origin = new OpenLayers.LonLat(e2f(origin_el,'x'),e2f(origin_el,'y'));
    //log(tile_origin);
    
    var tile_format_el=tilemap.getElementsByTagName("TileFormat")[0];
    rt.tile_size= new OpenLayers.Size(
        parseInt(tile_format_el.getAttribute('width')),
        parseInt(tile_format_el.getAttribute('height')));
    rt.tile_ext=tile_format_el.getAttribute('extension');

    var tileset_el_lst=tilemap.getElementsByTagName("TileSet");
    rt.layer_resolutions=[];
    rt.tileset_lst=[];
    rt.min_res = Number.MAX_VALUE;
    rt.max_res = 0;
    for (var i=0; i<tileset_el_lst.length; i++) {
        var zoom = parseInt(tileset_el_lst[i].getAttribute('order'));
        var res = parseFloat(tileset_el_lst[i].getAttribute('units-per-pixel'));
        rt.layer_resolutions[i]=res;
        rt.min_res=Math.min(rt.min_res,res);
        rt.max_res=Math.max(rt.max_res,res);
        rt.tileset_lst[zoom] = {
            prefix: tileset_el_lst[i].getAttribute('href'),
            units_per_pixel: res,
        };
    }
    return rt;
}
function read_layerboundings(url) {    
	var rt=[];
    var boundings=read_xml(url);
    if (boundings == null) {
      error('Cannot read '+url);
        return null;
    }
    var box_list = boundings.getElementsByTagName("BoundingBox");
    if (box_list == null){
    	error("cannot read boundings");
    	return null;
    }
    for (var i=0;i<box_list.length;i++){
    	var box=box_list[i];
    	var bounds=new OpenLayers.Bounds(e2f(box,'minx'),e2f(box,'miny'),e2f(box,'maxx'),e2f(box,'maxy'));
    	rt.push(bounds);
    }
    return rt;
}
function read_tile_list(url) {    
	var rt={};
	var urllist=[];
	if (typeof url === 'object' && url !== null && typeof url.length === 'number'){
		urllist=url;
	}
	else {
		urllist.concat(url);
	}
	for (urli in urllist) {
		var url=urllist[urli];
		var tilemap = read_xml(url);
		var baseurl = url.replace(/[^\/]*$/, '');
		if (tilemap == null) {
			error('Cannot read ' + url);
			return null;
		}
		rt.title = tilemap.getElementsByTagName("Title")[0].textContent;
		document.title = rt.title;

		var tilemap_el_lst = tilemap.getElementsByTagName("TileMap");
		rt.tile_list = [];
		for ( var i = 0; i < tilemap_el_lst.length; i++) {
			var url = tilemap_el_lst[i].getAttribute('href');
			rt.tile_list[i] = baseurl + url;
		}
	}
    return rt;
}

function mapPosToLonLat(pos){
	return pos.clone().transform(map.getProjectionObject(), map.displayProjection);
}

function lonLatToMap(lonlat){
	return lonlat.clone().transform( map.displayProjection,map.getProjectionObject());
}

function formatDecimal(number,fix,fract){
	var rt=number.toFixed(fract);
	var v=10;
	fix-=1;
	while (fix > 0){
		if (number < v){
			rt="0"+rt;
		}
		v=v*10;
		fix-=1;
	}
	return rt;
}
function formatLonLats(lonLat) {
  var lat = lonLat.lat;
  var long = lonLat.lon;
  var ns=formatLonLatsDecimal(lat, 'lat');
  var ew=formatLonLatsDecimal(long, 'lon');
  return ns + ', ' + ew;
}

//copied from OpenLayers.Util.getFormattedLonLat
function formatLonLatsDecimal(coordinate,axis){
	coordinate = (coordinate+540)%360 - 180; // normalize for sphere being round

    var abscoordinate = Math.abs(coordinate);
    var coordinatedegrees = Math.floor(abscoordinate);

    var coordinateminutes = (abscoordinate - coordinatedegrees)/(1/60);
        
    if( coordinatedegrees < 10 ) {
        coordinatedegrees = "0" + coordinatedegrees;
    }
    if (coordinatedegrees < 100 && axis == 'lon'){
    	coordinatedegrees = "0" + coordinatedegrees;
    }
    var str = coordinatedegrees + "\u00B0";

    if( coordinateminutes < 10 ) {
        str +="0";
    }
    str += coordinateminutes.toFixed(2) + "'";
    if (axis == "lon") {
        str += coordinate < 0 ? OpenLayers.i18n("W") : OpenLayers.i18n("E");
    } else {
        str += coordinate < 0 ? OpenLayers.i18n("S") : OpenLayers.i18n("N");
    }
    return str;
}

var tile_list=['tilemap.xml'];
var tiler_overlays=[];

var urlpar=OpenLayers.Util.getParameters();
if (urlpar.charts!= null){
	tile_list=[].concat(urlpar.charts);
}

OpenLayers.Util.extend( OpenLayers.INCHES_PER_UNIT, {
    "NM": OpenLayers.INCHES_PER_UNIT["nmi"],
    "cbl": OpenLayers.INCHES_PER_UNIT["nmi"]/10,
});

//a bit a hack to determine the best zoom for a resolution
function getZoomForResolution(res){
	var resolutions=OpenLayers.Layer.Bing.prototype.serverResolutions;
	var rt=0;
	for (;rt<resolutions.length;rt++){
		//we allow for 10% being below...
		if ((resolutions[rt] * 0.9)<=res){ 
			return rt;
		}
	}
	return rt-1;
}
       
log('OpenLayers.VERSION_NUMBER',OpenLayers.VERSION_NUMBER);

//------------------ center map to feature ------------------

function moveMapToFeature(feature,force){
	var f=force || false;
	if (! feature.layer.getVisibility() && ! f) return;
	if (feature.attributes.validPosition != null && ! feature.attributes.validPosition) return;
	var lonlat=new OpenLayers.LonLat(feature.geometry.x,feature.geometry.y);
	map.moveTo(lonlat,map.zoom);
}

//------------------ boat position ----------------------
//lonlat in wgs84,course in degree,speed in ??
function setBoatPosition(lon,lat,course,speed){
	boatFeature.geometry.calculateBounds(); //not sure - but seems to be necessary
	boatFeature.attributes.validPosition=true;
	var lonlat=new OpenLayers.LonLat(lon,lat);
	$('#boatPosition').text(formatLonLats(lonlat));
	$('#boatCourse').text(formatDecimal(course,3,0));
	$('#boatSpeed').text(formatDecimal(speed,2,1));
	if (boatFeature.layer.getVisibility()){
		var mlonlat = lonLatToMap(lonlat);
		boatFeature.style.rotation = course;
		boatFeature.move(mlonlat);
		//boatFeature.layer.redraw();
		// boatFeature.geometry.rotate(course);
		boatFeature.geometry.calculateBounds();
		logMapPos("boat", boatFeature.geometry.bounds.getCenterLonLat());
		if (boatFeature.attributes.isLocked ) {
			moveMapToFeature(boatFeature);
		}
	}
	
	
}

//button functions
function btnZoomIn(){
	if (map.zoom < maxZoom)	map.zoomIn();
}
function btnZoomOut(){
	map.zoomOut();
}

function showLayerDialog(){
	var dhtml='<div><ol id="selectLayerList" class="avn_selectList">';
	var layers=map.layers;
	for (var i in layers){
		var layer=layers[i];
		dhtml+='<ul id="'+layer.name+'" ';
		if (layer.getVisibility() && layer.calculateInRange()) dhtml+='class="ui-selected" ';
		if (! layer.calculateInRange()) dhtml+='class="avn_disabled ui-disabled"';
		dhtml+='>'+layer.name+'</ul>';
	}
	dhtml+="</ol></div>";
	//$(dhtml).find('ol').selectable();
	var w=$('body').width();
	var h=$('body').height();
	var dialog=$(dhtml).dialog({
		title: 'Layer',
		autoOpen: false,
		modal:true,
		dialogClass: 'avn_dialog',
		maxWidth: Math.ceil(w*0.8),
		maxHeight:Math.ceil(h*0.8),
		buttons: [
			{ 	text: "Cancel", 
				click: function(){ 
					$(this).dialog("close");
					
					}
			},
			{
				text: "Ok",
				click: function(){
					$( "ul", this ).each(function(idx,el){
						  if ($(el).hasClass('avn_disabled')) return;
				          if ($(el).hasClass('ui-selected')){
				        	  map.layers[idx].setVisibility(true);
				          }
				          else {
				        	  map.layers[idx].setVisibility(false);
				          }
				          if (map.layers[idx]==boatFeature.layer){
				        	  moveMapToFeature(boatFeature);
				        	  handleToggleButton('#btnLockPos',boatFeature.attributes.isLocked
				        			  && map.layers[idx].getVisibility());
				          }
				        });
					$(this).dialog("close");
					
				}
			}
		],
		close: function(){
			$('.avn_btLayerSwitch').show();
			$(this).dialog("destroy");
			moveEndEvent(); //update displays or markers
		}
			
	});
	$(dialog).dialog('open');
	//allow for toggle behavior
	$('#selectLayerList').bind( "mousedown", function ( e ) {
	    e.metaKey = true;
	} ).selectable({filter: ':not(.avn_disabled)'});
	$('.ui-dialog-content').niceScroll();
}

function btnLayerSwitch(){
	$('.avn_btLayerSwitch').hide();
	showLayerDialog();
	
	
}
function handleToggleButton(id,onoff,onClass){
	var oc=onClass || "avn_buttonActive";
	if (onoff){
		$(id).addClass(oc);
		$(id).removeClass("avn_buttonInactive");
	}
	else {
		$(id).removeClass("avn_buttonActive");
		$(id).removeClass("avn_buttonActiveError");
		$(id).addClass("avn_buttonInactive");
	}
}
function btnLockMarker(){
	if (markerFeature.attributes.isLocked){
		markerFeature.geometry.calculateBounds();
		markerFeature.move(map.getCenter());
		logMapPos("unlock-marker",markerFeature.geometry.bounds.getCenterLonLat());
		logMapPos("unlock-map",map.getCenter());
		$('#markerPosition').text(formatLonLats(mapPosToLonLat(markerFeature.geometry.bounds.getCenterLonLat())));
		markerFeature.attributes.isLocked=false;
		
	}else {		
		$('#markerPosition').text(formatLonLats(mapPosToLonLat(map.getCenter())));
		markerFeature.attributes.isLocked=true;
		markerFeature.geometry.calculateBounds();
		logMapPos("lock-marker",markerFeature.geometry.bounds.getCenterLonLat());
		logMapPos("lock-map",map.getCenter());
	}
	handleToggleButton('#btnLockMarker',markerFeature.attributes.isLocked);
}
function btnLockPos(){
	if (! boatFeature.layer.getVisibility()){
		//just to be sure
		handleToggleButton('#btnLockPos',false);
		return;
	}
	boatFeature.attributes.isLocked=!boatFeature.attributes.isLocked;
	if (boatFeature.attributes.isLocked){
		moveMapToFeature(boatFeature);
	}
	handleToggleButton('#btnLockPos',boatFeature.attributes.isLocked);
}

//event handlers

function mouseEvent(e){
		if (e.xy == null) return;
	    //$('#markerPosition').text(formatLonLats(mapPosToLonLat(this.getLonLatFromViewPortPx(e.xy))));
}

function moveEvent(){
	if (! markerFeature.attributes.isLocked){
		markerFeature.move(map.getCenter());
		markerFeature.geometry.calculateBounds();
		$('#markerPosition').text(formatLonLats(mapPosToLonLat(map.getCenter())));
		logMapPos("move-marker",markerFeature.geometry.bounds.getCenterLonLat());
		logMapPos("move-map",map.getCenter());
	}
	else {
		/*
		markerFeature.geometry.calculateBounds();
		logMapPos("move-marker",markerFeature.geometry.bounds.getCenterLonLat());
		$('#markerPosition').text(formatLonLats(mapPosToLonLat(markerFeature.geometry.bounds.getCenterLonLat())));
		*/
	}
}
function moveEndEvent(){
	if (! markerFeature.attributes.isLocked){
		markerFeature.move(map.getCenter());
		markerFeature.geometry.calculateBounds();
		$('#markerPosition').text(formatLonLats(mapPosToLonLat(map.getCenter())));
		logMapPos("marker",markerFeature.geometry.bounds.getCenterLonLat());
		logMapPos("map",map.getCenter());
	}
	else {
		markerFeature.geometry.calculateBounds();
		$('#markerPosition').text(formatLonLats(mapPosToLonLat(markerFeature.geometry.bounds.getCenterLonLat())));
	}
	
}

//test positioning the booat

function testpos(){
	var centerPoint=new OpenLayers.Geometry.Point(1510540.0564605 ,7209284.513336);
	var rot=5;
	currentAngle+=rot;
	if (currentAngle > 360) currentAngle-=360;
	boatFeature.geometry.calculateBounds();
	var radius=boatFeature.geometry.distanceTo(centerPoint);
	var w=currentAngle*Math.PI/180;
	var newBoatPos=new OpenLayers.Geometry.Point(centerPoint.x+radius*Math.sin(w),centerPoint.y+radius*Math.cos(w));
	var course=currentAngle+90;
	if(course>360){course -= 360;}
	var speed=5.5;
	var latlonb=mapPosToLonLat(newBoatPos);
	if (handleBoat) setBoatPosition(latlonb.x,latlonb.y, course, speed);
	timer=window.setTimeout(testpos,properties.positionQueryTimeout);
}

//do the layout
function adjustSizes(){
	return;
	//currently we try to do everything in css...
	var w=$('body').width();
	var rw=properties.rightPanelWidth;
	//if (w < 640) rw=60;
	rightWidth=rw;
	var rightWidthOffset=rightWidth+1;
	$('.avn_leftPanel').css('right',rightWidthOffset+"px");
	$('.avn_rightPanel').css('width',rightWidth+"px");
	
}

function initialize_openlayers() {
	adjustSizes();
	var tile_list=[];
	var entry_list=["avnav.xml"];
	var urlpar=OpenLayers.Util.getParameters();
	if (urlpar.charts!= null){
		entry_list=[].concat(urlpar.charts);
	}
	tiles=read_tile_list(entry_list);
	tile_list=tiles.tile_list;
	tile_parameters=[];
	var minRes=99999999; //strange default...
	var maxRes=0;
	
	var firstLayer=null;
	for (var i in tile_list){
		tile_parameters[i]=read_map_parameters(tile_list[i]);
		if (tile_parameters[i].min_res < minRes) minRes=tile_parameters[i].min_res;
		if (tile_parameters[i].max_res > maxRes) maxRes=tile_parameters[i].max_res;
		var boundingsurl=tile_list[i].replace(/[^\/]*$/,'')+"boundings.xml";
		tile_parameters[i].boundings=read_layerboundings(boundingsurl);
	}
	
    map = new OpenLayers.Map('map', {
          projection: new OpenLayers.Projection("EPSG:900913"), //mapProjection,
          displayProjection: new OpenLayers.Projection("EPSG:4326"),
          units: "m",
          //maxResolution: 156543.0339,
          maxExtent: new OpenLayers.Bounds(-20037508.342789, -20037508.342789, 20037508.342789, 20037508.342789),
            controls: [
                
                //new OpenLayers.Control.MousePosition( {div: $('#markerPosition'), formatOutput: formatLonlats} ),
                new OpenLayers.Control.Navigation(),
                new OpenLayers.Control.KeyboardDefaults(),
                new OpenLayers.Control.ScaleLine({
                    maxWidth: 50,
                    bottomOutUnits: 'NM',
                    bottomInUnits: 'm'                            
                }),
            ]
    });
    var osm = null;
    
    //tricky handling of min and max zoom layers...
    //we set for all layers minRes/maxRes except for the base layer, weher we set maxRes and maxZoomLevel
    //with setting maxRes, we have zoom level 0 at maxRes - so we have to set zoomOffset for all layers...
    zoomOffset=getZoomForResolution(maxRes);
    maxZoom=getZoomForResolution(minRes)-zoomOffset; //zoom of map
    if (properties.showOSM) {
    	osm=new OpenLayers.Layer.OSM(
            "Open Street Map",'http://tile.openstreetmap.org/${z}/${x}/${y}.png',
            {
                displayOutsideMaxExtent: false, 
                maxZoomLevel: getZoomForResolution(minRes)-zoomOffset,
                maxResolution: maxRes,
        		zoomOffset: zoomOffset
                
            });
    }
    else {
    	osm=new OpenLayers.Layer("Blank",{
    		isBaseLayer: true,
    		maxZoomLevel: getZoomForResolution(minRes)-zoomOffset,
    		maxResolution: maxRes,
    		zoomOffset: zoomOffset
    		});
    }
    for (var layeridx =tile_parameters.length-1 ; layeridx>= 0;layeridx--){
    	var layer=tile_parameters[layeridx];
    	var isBaseLayer=false;
    	if (firstLayer==null){
    		firstLayer=layer;
    		if (osm == null) isBaseLayer=true;
    	}
    	var baseurl="";
    	var dir=tile_list[layeridx].replace(/\/[^\/]*$/,'');
    	if (dir != tile_list[layeridx]){
    		baseurl=dir+"/";
    	}
    	var layerminRes=minRes;
    	if (layerminRes < layer.min_res/properties.maxUpscale) layerminRes=layer.min_res/properties.maxUpscale;
    	var tiler_overlay = new OpenLayers.Layer.TilerToolsXYZ( layer.title, baseurl+"${z}/${x}/${y}."+layer.tile_ext,
        {
            //wrapDateLine: true,
            maxExtent: layer.layer_extent,
            tileOrigin: layer.tile_origin,
            tileSize: layer.tile_size,
            maxResolution: layer.max_res,
            minResolution: 0.999*layerminRes, //we lower minres by 1%% to allow for correct computation of zoom levels
            serverResolutions: layer.layer_resolutions,
            isBaseLayer: isBaseLayer,
            profile: layer.layer_profile,
            displayOutsideMaxExtent: false,
            boundings: layer.boundings,
            zoomOffset: zoomOffset

        });
    	tiler_overlays.push(tiler_overlay);
    }   
    
    if (properties.showAlphaSwitch != null){
    map.addControl(
          new OpenLayers.Control.ClickBar({
              displayClass: "clickbar",
              ratio: 1.0,
              reportRatio: function(ratio){
                  log(ratio);
              if (OpenLayers.Util.alphaHack() == false)
            	  for (var ov in tiler_overlays){
            		  tiler_overlays[ov].setOpacity(ratio);
            	  }
              },
          })
        );
	}
    //the vector layers
    var markerLayer=new OpenLayers.Layer.Vector("Marker");
    var boatLayer=new OpenLayers.Layer.Vector("Boat");
    //test style
    
    var style_mark = OpenLayers.Util.extend({}, OpenLayers.Feature.Vector.style['default']);
    style_mark.graphicWidth = 40;
    style_mark.graphicHeight = 40;
    
    style_mark.externalGraphic = "images/Marker1.png";
    // title only works in Firefox and Internet Explorer
    style_mark.title = "Marker";
    style_mark.rotation=0;
    style_mark.fillOpacity=1;
    
    var style_boat = OpenLayers.Util.extend({}, OpenLayers.Feature.Vector.style['default']);
    //must fit to the dimensions of the boat: 100x400, offset 50,241
    style_boat.graphicWidth = 20;
    style_boat.graphicHeight = 80;
    style_boat.graphicXOffset=-10;
    style_boat.graphicYOffset=-48;
    
    style_boat.externalGraphic = "images/Boat2.png";
    // title only works in Firefox and Internet Explorer
    style_boat.title = "Boat";
    style_boat.rotation=20;
    style_boat.fillOpacity=1;
    
    map.addLayers([osm].concat(tiler_overlays).concat([markerLayer,boatLayer]));
    //map.maxZoomLevel=osm.getZoomForResolution(minRes);
    map.zoomToExtent(firstLayer.layer_extent,true);
    var initialZoom=map.getZoomForResolution(maxRes)+1;
    
    map.zoomTo(initialZoom);
    var center=map.getCenter();
    var point=new OpenLayers.Geometry.Point(center.lon,center.lat);
    markerFeature=new OpenLayers.Feature.Vector(point,{isLocked:false},style_mark);
    var boatPoint=new OpenLayers.Geometry.Point(1509813.9046919 ,7220215.0083809); //put the boat at a nice pos
    boatFeature=new OpenLayers.Feature.Vector(boatPoint,{isLocked:false,angle:0,validPosition:false},style_boat);
    markerLayer.addFeatures([markerFeature]);
    boatLayer.addFeatures([boatFeature]);
    
    map.addControl(new OpenLayers.Control.Graticule({layerName: 'Grid', id: 'grid',intervals: [0.16666666666666666666666666666667,0.083333333333333333333333333333333],
    		autoActivate: false}));
    map.events.register("zoomend",map,function(e){
    	if ((map.zoom +zoomOffset) < properties.minGridLedvel) map.getControl('grid').deactivate();
    	else map.getControl('grid').activate();
    });
    map.events.register("mousemove", map, mouseEvent);
    map.events.register("moveend", map, moveEndEvent);
    map.events.register("move", map, moveEvent);
    $('.avn_btZoomIn').button({
    	icons: {
      		 primary: "ui-icon-plus"
      	 },
      	 text: false,
      	 label: 'Zoom In'
    });
	$('.avn_btZoomOut').button({
	icons: {
  		 primary: "ui-icon-minus"
  	 },
  	 text: false,
  	 label: 'Zoom Out'
   	});
	$('.avn_btLayerSwitch').button({
		icons: {
	  		 primary: "ui-icon-grip-solid-horizontal"
	  	 },
	  	 text: false,
	  	label: 'Layer'
	   	});
	$('.avn_btLockMarker').button({
		icons: {
	  		 primary: "ui-icon-unlocked"
	  	 },
	  	 text: false,
	  	label: 'Marker'
	   	});
	$('.avn_btLockPos').button({
		icons: {
	  		 primary: "ui-icon-unlocked"
	  	 },
		text: false,
	  	label: 'Position'
	   	});
	$('#markerPosition').text(formatLonLats(mapPosToLonLat(map.getCenter())));
	
	$('.avn_toggleButton').addClass("avn_buttonInactive");
	
	$('#leftBottom').click(function(e){
		if (markerFeature.attributes.isLocked && ! boatFeature.attributes.isLocked){
			moveMapToFeature(markerFeature,true);
		}
	});
	$('#leftTop').click(function(e){
		moveMapToFeature(boatFeature,true);
	});
	
    $(window).resize(adjustSizes);
    timer=window.setTimeout(testpos,properties.positionQueryTimeout);

}
