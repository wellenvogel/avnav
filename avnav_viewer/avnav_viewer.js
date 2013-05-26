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
		maxUpscale:3, //3 levels upscale (otherwise we need too much mem)
		minGridLedvel: 10,
		showOSM: true,
		rightPanelWidth: 60, //currently not used
		loggingEnabled: true,
		positionQueryTimeout: 1000, //1000ms
		trackQueryTimeout: 10000, //10s
		bearingColor: "#DDA01F",
		bearingWidth: 3,
		trackColor: "#D71038",
		trackWidth: 3,
		trackInterval: 30, //seconds
		initialTrackLength: 24*120, //multiplies with trackInterval - so this gives 24h
		navUrl: "avnav_navi.php",
		maxGpsErrors: 3, //after that much invalid responses/timeouts the GPS is dead
		cookieName: "avnav",
		statusErrorImage: "images/RedBubble40.png",
		statusOkImage: "images/GreenBubble40.png",
		pages: ["main","nav"]
};

var userData={
		
};
var zoomOffset=0;
var maxZoom=0;
var map=null;
var timer=null;
var trackTimer=null;
var currentAngle=0;
var NM=1852;
var gpsErrors=0;
var validPosition=false;
var lastTrackQuery=0;

$.cookie.json = true;


/**
 * (re) initialize
 * if a map is already there - just destroy it (this will also destroy all layers and features)
 */
function init(){
	if (map ) map.destroy();
	map=null;
	validPosition=false;
}

/* an own map class
 * we add our features here
 */

OpenLayers.AvNavMap=OpenLayers.Class(OpenLayers.Map,{
	initialize: function(options){
		OpenLayers.Map.prototype.initialize.apply(this,arguments);
		this.boatFeature=null;
		this.maerkerFeature=null;
		this.headingFeature=null;
		this.handleBoat=true;
		this.track_layer=null;
		this.track_points=[];
		this.track_string;
		this.track_line=null;
	},
	
	//------------------ drawing of the track data ---------
	//input is a list of track points we get (ts,time,lon,lat)
	//we check which of them we have and afterwards add the new points to the line string
	//the index is the ts (microseconds) (we rely of the time being sorted)
	addTrackData:function(darray,redraw){
		var doRedraw=false;
		if (redraw && this.track_layer.features){
			this.track_layer.removeFeatures(this.track_layer.features);
			this.track_points=[];
			this.track_line=null;
			doRedraw=true;
		}
		//only add points with greater timestamp
		var startIdx=0;
		if (this.track_points.length > 0){
			var lts=this.track_points[this.track_points.length - 1].ts;
			for (;startIdx<darray.length;startIdx++){
				if (darray[startIdx].ts>lts) break;
			}
		}
		if ((this.track_points.length+(darray.length-startIdx))<2) {
			if (doRedraw) this.track_layer.redraw();
			return;
		}
		if (! this.track_line){
			var points=[];
			//seems that we create a new line string right now
			for (;startIdx<darray.length;startIdx++){
				this.track_points.push(darray[startIdx]);
			}
			for (var i=0;i<this.track_points.length;i++){
				points.push(this.lonLatToPoint(this.track_points[i].lon,this.track_points[i].lat));
			}
			this.track_line=new OpenLayers.Geometry.LineString(points);
			this.track_layer.addFeatures([new OpenLayers.Feature.Vector(this.track_line, null, this.style_track)]);
			this.track_layer.redraw();
		}
		else {
			for (;startIdx<darray.length;startIdx++){
				doRedraw=true;
				this.track_line.addPoint(this.lonLatToPoint(darray[startIdx].lon, darray[startIdx].lat));
				this.track_points.push(darray[startIdx]);
			}
			if (doRedraw) this.track_layer.redraw();
		}
	},
	
	//------------------ convert a pos in lon/lat to an openLayers point in map projection -----
	lonLatToPoint:function(lon,lat){
		var ll=new OpenLayers.LonLat(lon,lat).transform( this.displayProjection,this.getProjectionObject());
		return new OpenLayers.Geometry.Point(ll.lon,ll.lat);
	},
	
	  
	//------------------ boat position ----------------------
	//lonlat in wgs84,course in degree,speed in m/s, time as date object
	setBoatPosition:function (lon,lat,course,speed,time){
		this.boatFeature.geometry.calculateBounds(); //not sure - but seems to be necessary
		this.boatFeature.attributes.validPosition=true;
		this.boatFeature.attributes.oldPosition=true;
		this.boatFeature.attributes.course=course||0;
		this.boatFeature.attributes.speed=(speed||0)*3600/NM;
		var lastlon=this.boatFeature.attributes.lon||0;
		var lastlat=this.boatFeature.attributes.lat||0;
		this.boatFeature.attributes.lon=lon||0;
		this.boatFeature.attributes.lat=lat||0;
		var lonlat=new OpenLayers.LonLat(lon||0,lat||0);
		var curDate=time|| new Date();
		if (course == null || speed == null){
			//compute by our own
			dst=computeDistances(new OpenLayers.LonLat(lastlon,lastlat),lonlat);
			if (course == null) this.boatFeature.attributes.course=dst.course;
			if (speed == null && dst.dts != 0 && this.boatFeature.attributes.date != null) 
				var tdiff=curDate.getTime()-this.boatFeature.attributes.date.getTime();
				if (tdiff > 0) this.boatFeature.attributes.speed=dst.dtsnm*3600*1000/tdiff;
		}
		
		this.boatFeature.attributes.date=curDate;
		var datestr=formatTime(curDate);
		
		if (this.boatFeature.layer.getVisibility()){
			var mlonlat = this.lonLatToMap(lonlat);
			this.boatFeature.style.rotation = this.boatFeature.attributes.course;
			this.boatFeature.move(mlonlat);
			//boatFeature.layer.redraw();
			// boatFeature.geometry.rotate(course);
			this.boatFeature.geometry.calculateBounds();
			logMapPos("boat", this.boatFeature.geometry.bounds.getCenterLonLat());
			if (this.boatFeature.attributes.isLocked ) {
				this.moveMapToFeature(this.boatFeature);
			}
		}
		this.headingFeature.layer.drawFeature(this.headingFeature);
		//TODO: move this out of the map using an event handler
		updateCourseDisplay();
		
	},
	//------------------ center map to feature ------------------
	moveMapToFeature: function (feature,force){
	  	var f=force || false;
	  	if (! feature.layer.getVisibility() && ! f) return;
	  	if (feature.attributes.validPosition != null && ! feature.attributes.validPosition) {
	  		if (feature.attributes.oldPosition != null && ! feature.attributes.oldPosition) return;
	  	}
	  	var lonlat=new OpenLayers.LonLat(feature.geometry.x,feature.geometry.y);
	  	this.moveTo(lonlat,this.zoom);
	  },
	mapPosToLonLat:function (pos){
			var po=pos.clone().transform(this.getProjectionObject(), this.displayProjection);
			if (po instanceof OpenLayers.LonLat) return po;
			return new OpenLayers.LonLat(po.x,po.y);
		},

	lonLatToMap:function(lonlat){
			return lonlat.clone().transform( this.displayProjection,this.getProjectionObject());
	},
	CLASS_NAME: "OpenLayers.AvNavMap"
	
});
/* an own layer class
 * basically it is an TMS layer with the ability to have a list of boundings
 * if a tile is requested out of the bounds it will not be loaded from the server
 */
OpenLayers.Layer.AvNavXYZ=OpenLayers.Class(OpenLayers.Layer.XYZ,{
  initialize: function(options){
    OpenLayers.Layer.XYZ.prototype.initialize.apply(this,arguments);
  },
  getServerResolution: function(resolution) {
      var distance = Number.POSITIVE_INFINITY;
      resolution = resolution || this.map.getResolution();
      var serverResolution=resolution;
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

  CLASS_NAME: "OpenLayers.Layer.AvNavXYZ"

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





function e2f(elem,attr_idx) {
    return parseFloat($(elem).attr(attr_idx));
}


 


/*
 * read the avnav.xml
 */
function read_layer_list(description) {    
	var ll=[];
	
	$(description).find('TileMap').each(function(ln,tm){
		var rt={};
		//complete tile map entry here
		rt.layer_profile=$(tm).attr('profile');
	    if (rt.layer_profile != 'global-mercator' && rt.layer_profile != 'zxy-mercator') {
	      alert('unsupported profile in tilemap.xml '+rt.layer_profile);
	        return null;
	    }
	    rt.url=$(tm).attr('href');
	    rt.layer_srs = $(tm).attr("srs");
	    if (rt.layer_srs != 'OSGEO:41001') {
	      alert('avnav.xml: unsupported SRS'+rt.layer_srs);
	        return null;
	    }
	    rt.title = $(tm).attr('title');
	    rt.minZoom=parseInt($(tm).attr('minzoom'));
	    rt.maxZoom=parseInt($(tm).attr('maxzoom'));
	    $(tm).find(">BoundingBox").each(function(nr,bb){
	    	rt.layer_extent = new OpenLayers.Bounds(e2f(bb,'minx'),e2f(bb,'miny'),e2f(bb,'maxx'),e2f(bb,'maxy'));
	    });
	    
	    $(tm).find(">Origin").each(function(nr,or){
	    	rt.tile_origin = new OpenLayers.LonLat(e2f(or,'x'),e2f(or,'y'));
	    });
	    
	    $(tm).find(">TileFormat").each(function(nr,tf){
	    	rt.tile_size= new OpenLayers.Size(
	    	        parseInt($(tf).attr('width')),
	    	        parseInt($(tf).attr('height')));
	    	rt.tile_ext=$(tf).attr('extension');
	    });
	    if (!rt.tile_size) rt.tile_size=new OpenLayers.Size(256,256);
	    if (!rt.tile_ext)rt.tile_ext="png";
	    var boundings=[];
	    $(tm).find(">LayerBoundings >BoundingBox").each(function(nr,bb){
	    	var bounds=new OpenLayers.Bounds(e2f(bb,'minx'),e2f(bb,'miny'),e2f(bb,'maxx'),e2f(bb,'maxy'));
	    	boundings.push(bounds);
	    });
	    rt.boundings=boundings;
	    ll.push(rt);
	});
    return ll;
}



//add space if set
function formatDecimal(number,fix,fract,addSpace){
	var sign="";
	if (addSpace != null && addSpace) sign=" ";
	if (number < 0) {
		number=-number;
		sign="-";
	}
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
	return sign+rt;
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

function formatTime(curDate){
	var datestr=formatDecimal(curDate.getHours(),2,0)+":"+formatDecimal(curDate.getMinutes(),2,0)+":"+formatDecimal(curDate.getSeconds(),2,0);
	return datestr;
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
function getResolutionForZoom(zoom){
	var resolutions=OpenLayers.Layer.Bing.prototype.serverResolutions;
	if (zoom < 0) zoom=0;
	if (zoom >= resolutions.length) zoom=resolutions.length-1;
	return resolutions[zoom];
}
       
log('OpenLayers.VERSION_NUMBER',OpenLayers.VERSION_NUMBER);



//------------------ position requests -------------------

function queryPosition(){
	var url=properties.navUrl;
	var urlparam=OpenLayers.Util.getParameters();
	if (urlparam.demo != null){
		url+="?demo="+urlparam.demo;
	}
	$.ajax({
		url: url,
		dataType: 'json',
		cache:	false,
		success: function(data,status){
			if (data.class != null && data.class == "TPV" && 
					data.tag != null && data.lon != null && data.lat != null &&
					data.mode != null && data.mode >=1){
				var rtime=null;
				if (data.time != null) rtime=OpenLayers.Date.parse(data.time);
				handleGpsStatus(true);
				if (map) map.setBoatPosition(data.lon, data.lat, data.track, data.speed, rtime);
				var course=data.course;
				if (course === undefined) course=data.track;
				var speed=data.speed*3600/NM;
				$('#boatPosition').text(formatLonLats(data));
				$('#boatCourse').text(formatDecimal(course||0,3,0));
				$('#boatSpeed').text(formatDecimal(speed||0,2,1));
				var datestr=formatTime(rtime||new Date());
				$('#boatLocalTime').text(datestr);
			}
			else{
				handleGpsStatus(false);
			}
			timer=window.setTimeout(queryPosition,properties.positionQueryTimeout);
		},
		error: function(status,data,error){
			log("query position error");
			handleGpsStatus(false);
			timer=window.setTimeout(queryPosition,properties.positionQueryTimeout);
		},
		timeout: 10000
	});
}


function handleGpsStatus(ok,force){
	var hasChanged=false;
	var doForce=force||false;
	if (! ok){
		gpsErrors++;
		if (gpsErrors >= properties.maxGpsErrors){
			if (validPosition){
				hasChanged=true;
				validPosition=false;
			}
			
		}
	}
	else{
		gpsErrors=0;
		if (!validPosition){
			hasChanged=true;
			validPosition=true;
		}
	}
	if (hasChanged|| doForce){
		if (!ok){
			if (map && ! map.boatFeature.attributes.oldPosition)map.headingFeature.style.display="none";
			if (map && ! map.boatFeature.attributes.oldPosition) map.boatFeature.style.display="none";
			$('#boatPositionStatus').attr('src',properties.statusErrorImage);
		}
		else {
			if (map && map.markerFeature.attributes.isLocked) map.headingFeature.style.display=null;
			if (map) map.boatFeature.style.display=null;
			$('#boatPositionStatus').attr('src',properties.statusOkImage);
		}
		if (map){
			map.headingFeature.layer.drawFeature(map.headingFeature);
			map.boatFeature.layer.drawFeature(map.boatFeature);
			handleToggleButton('#btnLockPos',map.boatFeature.attributes.isLocked,(map.boatFeature.attributes.validPosition?'avn_buttonActive':'avn_buttonActiveError'));
		}
		updateCourseDisplay();
		
	}

}
//--------------- distances ------------------------------
//compute the set of distance parameters between 2 geometries
function computeDistances(src,dst,convert){
	var srcll=src;
	var dstll=dst;
	if (convert != null && convert){
		srcll=map.mapPosToLonLat(src);
		dstll=map.mapPosToLonLat(dst);
	}
	var dts=OpenLayers.Spherical.computeDistanceBetween(srcll,dstll);
	var rt={
	};
	rt.dts=dts;
	rt.dtsnm=dts/NM;
	var course=-OpenLayers.Spherical.computeHeading(srcll,dstll);
	if (course < 0) course+=360;
	if (course > 360) course-=360;
	rt.course=course;
	return rt;
}

//update the display of brg,dst,eta
function updateCourseDisplay(){
	if (! map) return;
	$('#markerPosition').text(formatLonLats(map.mapPosToLonLat(map.markerFeature.geometry)));
	var etastr="--:--:--";
	if (! map.boatFeature.attributes.validPosition) {
		$('#eta').text(etastr);
		$('#bearing').text("---");
		$('#distance').text("---");
		return;
	}
	var dst=computeDistances(map.boatFeature.geometry,map.markerFeature.geometry,true);
	$('#bearing').text(formatDecimal(dst.course,3,0));
	$('#distance').text(formatDecimal(dst.dtsnm,3,1));
	var speed=map.boatFeature.attributes.speed||0;
	var course=map.boatFeature.attributes.course||0;
	var etastr="--:--:--";
	var curDate=map.boatFeature.attributes.date;
	var vmgapp=0;
	if (Math.abs(course-dst.course) <= 85 &&  curDate != null){
		//TODO: is this really correct for VMG?
		vmgapp=speed*Math.cos(Math.PI/180*(course-dst.course));
		log("vmg - course="+course+", brg="+dst.course+", speed="+speed+", vmg="+vmgapp);
	}
	if (vmgapp > 0){
		var targettime=curDate.getTime();
		targettime+=dst.dts/(vmgapp*NM/3600)*1000; //time in ms
		var targetDate=new Date(targettime);
		etastr=formatTime(targetDate);
	}
	$('#eta').text(etastr);
	
}

//------------------ track data requests -------------------

function queryTrackData(){
	if (! map){
		window.clearTimeout(trackTimer);
		trackTimer=window.setTimeout(queryTrackData,properties.trackQueryTimeout);
		return;
	}
	var url=properties.navUrl+"?request=track";
	var urlparam=OpenLayers.Util.getParameters();
	if (urlparam.demo != null){
		url+="&demo="+urlparam.demo;
	}
	var maxItems=0;
	var now=new Date().getTime();
	if ((now - lastTrackQuery) > (properties.trackQueryTimeout *10)){
		//seems that we missed a lot of queries - reinitialize track
		if (map && map.track_line){
			//reset the trackData
			map.addTrackData([],true);
		}
	}
	if (!map.track_line){
		// initialize the track
		maxItems=properties.initialTrackLength;
	}
	else{
		var tdiff=now-lastTrackQuery+2*properties.trackQueryTimeout;
		tdiff=tdiff/1000; //tdiff in seconds
		maxItems=tdiff/properties.trackInterval;
		if (maxItems < 10) maxItems=10;
	}
	if (maxItems == 0) maxItems=1;
	url+="&maxnum="+maxItems+"&interval="+properties.trackInterval;
	$.ajax({
		url: url,
		dataType: 'json',
		cache:	false,
		success: function(data,status){
			lastTrackQuery=new Date().getTime();
			if (map) map.addTrackData(data);
			window.clearTimeout(trackTimer);
			trackTimer=window.setTimeout(queryTrackData,properties.trackQueryTimeout);
		},
		error: function(status,data,error){
			log("query track error");
			window.clearTimeout(trackTimer);
			trackTimer=window.setTimeout(queryTrackData,properties.trackQueryTimeout);
		},
		timeout: 10000
	});
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
				          if (map.layers[idx]==map.boatFeature.layer){
				        	  if (map.boatFeature.attributes.isLocked) map.moveMapToFeature(map.boatFeature);
				        	  handleToggleButton('#btnLockPos',map.boatFeature.attributes.isLocked
				        			  && map.layers[idx].getVisibility());
				        	  updateCourseDisplay();
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
}
function btnLockMarker(){
	if (map.markerFeature.attributes.isLocked){
		map.markerFeature.geometry.calculateBounds();
		map.markerFeature.move(map.getCenter());
		logMapPos("unlock-marker",map.markerFeature.geometry.bounds.getCenterLonLat());
		logMapPos("unlock-map",map.getCenter());
		map.markerFeature.attributes.isLocked=false;
		map.headingFeature.style.display="none";
		
	}else {		
		map.markerFeature.attributes.isLocked=true;
		map.markerFeature.geometry.calculateBounds();
		logMapPos("lock-marker",map.markerFeature.geometry.bounds.getCenterLonLat());
		logMapPos("lock-map",map.getCenter());
		if (map.boatFeature.attributes.validPosition) map.headingFeature.style.display=null;
	}
	map.headingFeature.layer.drawFeature(map.headingFeature);
	handleToggleButton('#btnLockMarker',map.markerFeature.attributes.isLocked);
	updateCourseDisplay();
	userData.markerLocked=map.markerFeature.attributes.isLocked;
	$.cookie(properties.cookieName,userData);
}
function btnLockPos(){
	if (! map.boatFeature.layer.getVisibility() ){
		//just to be sure
		handleToggleButton('#btnLockPos',false);
		return;
	}
	map.boatFeature.attributes.isLocked=!map.boatFeature.attributes.isLocked;
	if (map.boatFeature.attributes.isLocked && map.boatFeature.attributes.validPosition){
		map.moveMapToFeature(map.boatFeature);
	}
	handleToggleButton('#btnLockPos',map.boatFeature.attributes.isLocked,(map.boatFeature.attributes.validPosition?'avn_buttonActive':'avn_buttonActiveError'));
}
function btnNavCancel(){
	handleMainPage();
}

//event handlers

function mouseEvent(e){
		if (e.xy == null) return;
}

function moveEvent(){
	moveMarkerFeature(map.getCenter());
	
}
function moveEndEvent(){
	moveMarkerFeature(map.getCenter(),true);
	userData.mapPosition=map.getCenter();
	userData.mapZoom=map.zoom;
	$.cookie(properties.cookieName,userData);
	
}

function moveMarkerFeature(pos,force,noCookie){
	if (! map.markerFeature.attributes.isLocked){
		map.markerFeature.move(pos);
		map.markerFeature.geometry.calculateBounds();
		logMapPos("marker",map.markerFeature.geometry.bounds.getCenterLonLat());
		logMapPos("map",pos);
		updateCourseDisplay();
	}
	else {
		if (force){
			map.markerFeature.geometry.calculateBounds();
			updateCourseDisplay();
			
		}
	}
	if (force && ! noCookie){
		userData.markerLocked=map.markerFeature.attributes.isLocked;
		userData.markerPos=map.markerFeature.geometry.bounds.getCenterLonLat();
		$.cookie(properties.cookieName,userData);
	}
}

/*
 * try to read the user data from the cookie and set parameters accordingly
 */
function readUserData(){
	var ndata=$.cookie(properties.cookieName);
	if (ndata){
		userData=ndata;
	}
	if (userData.markerPos){
		//TODO: should prevent writing back cookie...
		if (userData.markerPos.lat && userData.markerPos.lon){
			moveMarkerFeature(new OpenLayers.LonLat(userData.markerPos.lon,userData.markerPos.lat), true,true);
		}
	}
	if (userData.markerLocked){
		map.markerFeature.attributes.isLocked=true;
	}
	if (userData.mapPosition && userData.mapPosition.lon && userData.mapPosition.lat && userData.mapZoom){
		map.moveTo(new OpenLayers.LonLat(userData.mapPosition.lon,userData.mapPosition.lat),userData.mapZoom);
	}
	handleToggleButton('#btnLockMarker',map.markerFeature.attributes.isLocked);
	updateCourseDisplay();
}


/*
 * initialize the map from the description
 * url is the base url where the avnav has been found
 */
function initMap(mapdescr,url) {
	init();
	var tiler_overlays=[];
	var minRes=99999999; //strange default...
	var maxRes=0;
	
	var firstLayer=null;	
	var tile_parameters=read_layer_list(mapdescr);
	
    var tmap = new OpenLayers.AvNavMap('map', {
          projection: new OpenLayers.Projection("EPSG:900913"), //mapProjection,
          displayProjection: new OpenLayers.Projection("EPSG:4326"),
          units: "m",
          //maxResolution: 156543.0339,
          maxExtent: new OpenLayers.Bounds(-20037508.342789, -20037508.342789, 20037508.342789, 20037508.342789),
            controls: [
                
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
    var minZoom=99;
    for (l in tile_parameters){
    	var tp=tile_parameters[l];
    	if (tp.minZoom < minZoom) minZoom=tp.minZoom;
    	if (tp.maxZoom > maxZoom) maxZoom=tp.maxZoom;
    }
    //tricky handling of min and max zoom layers...
    //old:
    //we set for all layers minRes/maxRes except for the base layer, where we set maxRes and maxZoomLevel
    //with setting maxRes, we have zoom level 0 at maxRes - so we have to set zoomOffset for all layers...
    zoomOffset=minZoom;
    maxZoom=maxZoom-zoomOffset; //zoom of map
    osm=new OpenLayers.Layer("Blank",{
    		isBaseLayer: true,
    		maxZoomLevel: maxZoom,
    		maxResolution: getResolutionForZoom(zoomOffset),
    		zoomOffset: zoomOffset
    		});
    for (var layeridx =tile_parameters.length-1 ; layeridx>= 0;layeridx--){
    	var layer=tile_parameters[layeridx];
    	var isBaseLayer=false;
    	if (firstLayer==null){
    		firstLayer=layer;
    		if (osm == null) isBaseLayer=true;
    	}
    	var baseurl="";
    	if (! layer.url){
    		error("missing href in layer");
    	}
    	if (! layer.url.match(/^http:/)){
    		baseurl=url+"/"+layer.url;
    	}
    	else baseurl=layer.url;
    	
    	var layermaxzoom=maxZoom+zoomOffset;
    	if ((layer.maxZoom+properties.maxUpscale) < maxZoom) layermaxzoom=layer.maxZoom+properties.maxUpscale;
    	var serverResolutions=[];
    	for (var i=layer.minZoom;i<=layer.maxZoom;i++){
    		serverResolutions.push(getResolutionForZoom(i));
    	}
    	var tiler_overlay = new OpenLayers.Layer.AvNavXYZ( layer.title, baseurl+"/${z}/${x}/${y}."+layer.tile_ext,
        {
            //wrapDateLine: true,
            maxExtent: layer.layer_extent,
            tileOrigin: layer.tile_origin,
            tileSize: layer.tile_size,
            minResolution:getResolutionForZoom(layermaxzoom)*0.999,
            maxResolution:getResolutionForZoom(layer.minZoom),
            serverResolutions: serverResolutions,
            isBaseLayer: isBaseLayer,
            profile: layer.layer_profile,
            displayOutsideMaxExtent: false,
            boundings: layer.boundings,
            zoomOffset: zoomOffset

        });
    	tiler_overlays.push(tiler_overlay);
    }  
    
    //the vector layers
    var markerLayer=new OpenLayers.Layer.Vector("Marker");
    var boatLayer=new OpenLayers.Layer.Vector("Boat");
    var headingLayer=new OpenLayers.Layer.Vector("Heading");
    //the track layer is a member of the map as we can only draw the feature as soon as we hav at least 2 points...
    tmap.track_layer=new OpenLayers.Layer.Vector("Track");
    
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
    style_boat.display="none"; //only show the boat once we have valid gps data
    
    var style_bearing = OpenLayers.Util.extend({}, OpenLayers.Feature.Vector.style['default']);
    style_bearing.fillOpacity=1;
    style_bearing.display="none";
    style_bearing.strokeColor=properties.bearingColor;
    style_bearing.strokeWidth=properties.bearingWidth;
    
    tmap.style_track = OpenLayers.Util.extend({}, OpenLayers.Feature.Vector.style['default']);
    tmap.style_track.fillOpacity=1;
    tmap.style_track.strokeColor=properties.trackColor;
    tmap.style_track.strokeWidth=properties.trackWidth;
    
    tmap.addLayers([osm].concat(tiler_overlays).concat([markerLayer,boatLayer,headingLayer,tmap.track_layer]));
    //map.maxZoomLevel=osm.getZoomForResolution(minRes);
    tmap.zoomToExtent(firstLayer.layer_extent,true);
    var initialZoom=tmap.getZoomForResolution(maxRes)+1;
    
    tmap.zoomTo(initialZoom);
    var center=tmap.getCenter();
    var point=new OpenLayers.Geometry.Point(center.lon,center.lat);
    tmap.markerFeature=new OpenLayers.Feature.Vector(point,{isLocked:false},style_mark);
    var boatPoint=new OpenLayers.Geometry.Point(1509813.9046919 ,7220215.0083809); //put the boat at a nice pos
    tmap.boatFeature=new OpenLayers.Feature.Vector(boatPoint,{isLocked:false,angle:0,validPosition:false, oldPosition:false},style_boat);
    tmap.headingFeature=new OpenLayers.Feature.Vector(new OpenLayers.Geometry.LineString([boatPoint,point]),{},style_bearing);
    markerLayer.addFeatures([tmap.markerFeature]);
    boatLayer.addFeatures([tmap.boatFeature]);
    headingLayer.addFeatures([tmap.headingFeature]);
    
    tmap.addControl(new OpenLayers.Control.Graticule({layerName: 'Grid', id: 'grid',intervals: [0.16666666666666666666666666666667,0.083333333333333333333333333333333],
    		autoActivate: false}));
    tmap.events.register("zoomend",tmap,function(e){
    	if ((tmap.zoom +zoomOffset) < properties.minGridLedvel) tmap.getControl('grid').deactivate();
    	else tmap.getControl('grid').activate();
    });
    tmap.events.register("mousemove", tmap, mouseEvent);
    tmap.events.register("moveend", tmap, moveEndEvent);
    tmap.events.register("move", tmap, moveEvent);
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
	$('.avn_btNavCancel').button({
		icons: {
	  		 primary: "ui-icon-unlocked"
	  	 },
		text: false,
	  	label: 'Main'
	   	});
	$('#markerPosition').text(formatLonLats(tmap.mapPosToLonLat(tmap.getCenter())));
	map=tmap;
	$('.avn_toggleButton').addClass("avn_buttonInactive");
	
	$('#leftBottom').click(function(e){
		if (map.markerFeature.attributes.isLocked && ! map.boatFeature.attributes.isLocked){
			map.moveMapToFeature(map.markerFeature,true);
		}
	});
	$('#leftTop').click(function(e){
		map.moveMapToFeature(map.boatFeature,true);
	});
	
	
    readUserData();

	

}

function showPage(name){
	for (p in properties.pages){
		var pname=properties.pages[p];
		if (pname == name){
			$('.avn_'+pname+'page').show();
		}
		else{
			$('.avn_'+pname+'page').hide();
		}
	}
}

/*----------------------------------------------------------------------------------------------------
 *  main page
 *  start reading the GPS
 *  read the available chartlist and populate the main content with this data
 *  
 */
function handleMainPage(){
	//TODO: fill mainpage
	showPage('main');
	validPosition=false;
	handleGpsStatus(false, true);
	var url=properties.navUrl+"?request=listCharts";
	$.ajax({
		url: url,
		dataType: 'json',
		cache: false,
		error: function(ev){
			alert("unable to read chart list: "+ev.responseText);
		},
		success: function(data){
			if (data.status != 'OK'){
				alert("reading chartlist failed: "+data.info);
				return;
			}
			var entryTemplate=$('.avn_mainpage #defaultChartEntry:first').clone();
			$('.avn_mainpage #allSelections a').remove();
			for (e in data.data){
				var chartEntry=data.data[e];
				var domEntry=entryTemplate.clone();
				domEntry.attr('href',"javascript:handleNavPage('"+chartEntry.url+"')");
				var ehtml='<img src="';
				if (chartEntry.icon) ehmtl+=chartEntry.icon;
				else ehtml+=entryTemplate.find('img').attr('src');
				ehtml+='"/>'+chartEntry.name;
				domEntry.html(ehtml);
				$('.avn_mainpage #allSelections').append(domEntry);
			}
		}
		
	});
}

/**
 * nav page
 * read the description via ajax and init the map
 */
function handleNavPage(list){
	validPosition=false;
	if (! list.match(/^http:/)){
		if (list.match(/^\//)){
			list=window.location.href.replace(/^([^\/:]*:\/\/[^\/]*).*/,'$1')+list;
		}
		else {
			list=window.location.href.replace(/[?].*/,'').replace(/[^\/]*$/,'')+"/"+list;
		}
	}
	var url=list+"/avnav.xml";
	$.ajax({
		url:url,
		dataType: 'xml',
		cache: false,
		success: function(data){
			showPage('nav');
			initMap(data,list);
			handleGpsStatus(false, true);
		},
		error: function(ev){
			alert("unable to load charts "+ev.responseText);
		}
	});
	return false;
}

$(document).ready(function(){
	var urlpar=OpenLayers.Util.getParameters();
	var entry_list=null;
	if (urlpar.charts!= null){
		entry_list=[].concat(urlpar.charts);
	}
	if (! entry_list){
		handleMainPage();
	}	
	else {
		handleNavPage(entry_list[0]);
	}
	queryPosition();
	queryTrackData();
});
