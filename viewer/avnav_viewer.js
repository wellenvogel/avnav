/*
# vim: ts=2 sw=2 et
###############################################################################
# Copyright (c) 2012, Andreas Vogel andreas@wellenvogel.net
# parts of the software are taken from tiler_tools
# http://code.google.com/p/tilers-tools/
# the license below applies also to this complete software
# it also uses parts of software from movable-type
# http://www.movable-type.co.uk/
# for their license see the file latlon.js
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
		maxUpscale:2, //2 levels upscale (otherwise we need too much mem)
		hideLower: true, //if set, hide smaller zoom layers when completely covered
		maxZoom: 21,  //only allow upscaling up to this zom level
		minGridLedvel: 10,
		showOSM: true,
		rightPanelWidth: 60, //currently not used
		loggingEnabled: true,
		positionQueryTimeout: 1000, //1000ms
		trackQueryTimeout: 5000, //10s
		bearingColor: "#DDA01F",
		bearingWidth: 3,
		trackColor: "#D71038",
		trackWidth: 3,
		trackInterval: 30, //seconds
		initialTrackLength: 24*120, //multiplies with trackInterval - so this gives 24h
		aisQueryTimeout: 5000, //ms
		aisDistance: 20, //distance for AIS query in nm
		maxAisErrors: 3, //after that many errors AIS display will be switched off
		minAISspeed: 0.2, //minimal speed in kn that we consider when computing cpa/tcpa
		maxAisTPA: 3,    //max. computed AIS TPA time in h (otherwise we do not consider this)
		aisWarningCpa: 0.274, //nm for AIS warning (500m)
		aisWarningTpa: 900, //in s - max time for tpa warning (15min)
		aisNearestImage: 'images/ais-nearest.png',
		aisWarningImage: 'images/ais-warning.png',
		statusQueryTimeout: 3000, //ms
                centerDisplayTimeout: 45000, //ms - auto hide measure display (0 - no auto hide)
		navUrl: "avnav_navi.php",
		maxGpsErrors: 3, //after that much invalid responses/timeouts the GPS is dead
		cookieName: "avnav",
		statusErrorImage: "images/RedBubble40.png",
		statusOkImage: "images/GreenBubble40.png",
		pages: ["main","nav","ais","status"],
		statusIcons: {
			INACTIVE: "images/GreyBubble40.png",
			STARTED:  "images/YellowBubble40.png",
			RUNNING:  "images/YellowBubble40.png",
			NMEA:	  "images/GreenBubble40.png",
			ERROR:	  "images/RedBubble40.png"
		}
};

var aisparam={
		distance:{
			headline: 'dist(nm)',
			format: function(v){ return formatDecimal(parseFloat(v.distance||0),3,2);}
		},
		speed: {
			headline: 'speed(kn)',
			format: function(v){ return formatDecimal(parseFloat(v.speed||0),3,1);}
		},
		course:	{
			headline: 'course',
			format: function(v){ return formatDecimal(parseFloat(v.course||0),3,0);}
		},
		cpa:{
			headline: 'cpa',
			format: function(v){ return formatDecimal(parseFloat(v.cpa||0),3,2);}
		},
		tcpa:{
			headline: 'tcpa',
			format: function(v){
				var tval=parseFloat(v.tcpa||0);
				var h=Math.floor(tval/3600);
				var m=Math.floor((tval-h*3600)/60);
				var s=tval-3600*h-60*m;
				return formatDecimal(h,2,0)+':'+formatDecimal(m,2,0)+':'+formatDecimal(s,2,0);
				}
		},
    passFront:{
      headline: 'pass',
      format: function(v){
        if (! v.cpa) return "-";
        if (v.passFront) return "Front";
        return "Back";
      }
    },
		shipname:{
			headline: 'name',
			format: function(v){ return v.shipname;}
		},
		callsign:{
			headline: 'call',
			format: function(v){ return v.callsign;}
		},
		mmsi: {
			headline: 'mmsi',
			format: function(v){ return v.mmsi;}
		},
		shiptype:{
			headline: 'type',
			format: function(v){
				var t=0;
				try{
					t=parseInt(v.shiptype||0);
				}catch (e){}
				if (t>=20 && t<=29) return "WIG";
				if (t==30) return "Fishing";
				if (t==31 || t==32) return "Towing";
				if (t==33) return "Dredging";
				if (t==34) return "Diving";
				if (t==35) return "Military";
				if (t ==36)return "Sail";
				if (t==37) return "Pleasure";
				if (t>=40 && t<=49) return "HighSp";
				if (t==50) return "Pilot";
				if (t==51) return "SAR";
				if (t==52) return "Tug";
				if (t==53) return "PortT";
				if (t==54) return "AntiPol";
				if (t==55) return "Law";
				if (t==58) return "Medical";
				if (t>=60 && t<=69) return "Passenger";
				if (t>=70 && t<=79) return "Cargo";
				if (t>=80 && t<=89) return "Tanker";
				if (t>=91 && t<=94) return "Hazard";
				return "Other";
			}
		},
		position:{
			headline: 'position',
			format: function(v){return formatLonLats({lon:v.lon,lat:v.lat});}
		},
    destination: {
      headline: 'destination',
      format: function(v){ var d=v.destination; if (d) return d; return "unknown";}
    }
		
};

var userData={
		
};
var zoomOffset=0;
var maxZoom=0;
var map=null;
var timer=null;
var trackTimer=null;
var aisTimer=null;
var centerTimer=null;
var currentAngle=0;
var NM=1852;
var gpsErrors=0;
var validPosition=false;
var lastTrackQuery=0;
var mapsequence=1; //will be incremented each time a new map is created
var aisList=[];
var aisErrors=0;
var trackedAIStarget=null;
var aisWarningTarget=null;
var pageActivationTimes=[];
var statusQuery;
var statusTimer;

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
		this.ais_layer=null;
		this.ais_features=[]; //the list fo AIS features, sorted by MMSI
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
	//------------------ drawing of AIS data ---------------------------------------------------
	//the input list is an array of AIS data sorted by distance
	//we check if we need to add/remove features and update the position and direction
	//if a target cpa is below the alarm cpa, we draw this one separately
	//the nearest one will be drawn in green
	updateAIS: function(aisdata){
		var addlist=[];
		var removelist=[];
		var now=new Date().getTime(); //for checking if we hit all features
		for (var aisidx in aisdata){
			var ais=aisdata[aisidx];
			var mmsi=ais.mmsi;
			if (! mmsi) continue;
			if (! this.ais_features[mmsi]){
				//we must add this target
				//we make a copy of the style so that each ais target has its own style
				var aisTargetPoint=this.lonLatToPoint(ais.lon, ais.lat);
			    var nAisFeature=new OpenLayers.Feature.Vector(aisTargetPoint,
			    		{isLocked:false,angle:0,mmsi:ais.mmsi},
			    		 OpenLayers.Util.extend({label:ais.mmsi},this.style_ais));
				addlist.push(nAisFeature);
				this.ais_features[mmsi]=nAisFeature;
			}
			this.ais_features[mmsi].attributes.updatets=now;
		}
		for (var o in this.ais_features){
			if (this.ais_features[o] && this.ais_features[o].attributes.updatets != now){
				removelist.push(this.ais_features[o]);
				delete this.ais_features[o];
			}
		}
		this.ais_layer.removeFeatures(removelist);
		this.ais_layer.addFeatures(addlist);
		var isFirst=true;
		for (var aisidx in aisdata){
			var ais=aisdata[aisidx];
			var mmsi=ais.mmsi;
			if (! mmsi) continue;
			var aisfeature=this.ais_features[mmsi];
			if (! aisfeature) continue;
			this.updateAIStarget(ais,aisfeature,isFirst,(aisWarningTarget && mmsi == aisWarningTarget));
			isFirst=false;
		}
		this.ais_layer.redraw();
	},
	
	
	//update a single AIS target
	updateAIStarget: function(aisdata,aisfeature,isFirst,isWarning){
		aisfeature.geometry.calculateBounds();
		var mlonlat=this.lonLatToMap(new OpenLayers.LonLat(aisdata.lon,aisdata.lat));
		aisfeature.style.rotation=aisdata.course;
		aisfeature.move(mlonlat);
		if (aisdata.shipname && aisdata.shipname != "unknown" ){
			aisfeature.style.label=aisdata.shipname;
		}
    else {
			aisfeature.style.label=aisdata.mmsi;
    }
		if (isWarning){
			aisfeature.style.externalGraphic=properties.aisWarningImage
		}
		else {
			if (isFirst){
				aisfeature.style.externalGraphic=properties.aisNearestImage;
			}
			else{
				aisfeature.style.externalGraphic=this.style_ais.externalGraphic;
			}
		}
		
		
	},
	
	//center the map to an AIS target
	//return true when found
	centerToAIStarget: function(mmsi){
		var targetFeature=this.ais_features[mmsi];
		if (! targetFeature) return false;
		this.moveMapToFeature(targetFeature, false);
		return true;
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
    //this.nextLayer=options.nextLayer;
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
    //we use global mercator as a marker for "old style" OSM like tiles
    //with y starting at 0 lower left
    y= -y - 1;
    if (this.profile != 'global-mercator'){
    	//For OSM/google/MOBAC y starts at 0 upper left...
    	y=limit-y-1;
    }
        
    return {'x': x, 'y': y, 'z': z};
  },
  //handle our list of bounding boxes - return null if the tile is not within
  getURL: function (bounds) {
	  var fits=false;
	  if (this.boundings != null && this.boundings.length != 0){
		  for (var i in this.boundings){
			  if (this.boundings[i].intersectsBounds(bounds)){
				  fits=true;
				  break;
			  }
		  }
	  }
	  else {
		  fits=true;
	  }
	  if (! fits){
		  return null;
	  }
	  if (properties.hideLower && this.nextLayer && this.nextLayer.getVisibility() && this.nextLayer.calculateInRange()){
		  //don't show the tile if the next layer covers this completely
		  for (var i in this.nextLayer.boundings){
			  var nlbound=this.nextLayer.boundings[i];
			  if (bounds.top <= nlbound.top && bounds.bottom >= nlbound.bottom 
					  && bounds.left >= nlbound.left && bounds.right <= nlbound.right){
				  return null;
			  }
		  }
	  }
      var xyz = this.getXYZ(bounds);
      var url = this.url;
      if (OpenLayers.Util.isArray(url)) {
          var s = '' + xyz.x + xyz.y + xyz.z;
          url = this.selectUrl(s, url);
      }
      var lonlat=this.map.mapPosToLonLat(new OpenLayers.Geometry.Point(bounds.left,bounds.top));
      log("url:lon="+lonlat.lon+", lat="+lonlat.lat+", x="+xyz.x+", y="+xyz.y+", z="+xyz.z);
      return OpenLayers.String.format(url, xyz);
  },
  
  // openlayers now uses the layer extend as reference for rounding to chart bounds
  // as our layers have restricted extends, we insetad use the origin...
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

// a control to route events to the AIS layer

OpenLayers.Control.AISselectorControl = OpenLayers.Class(OpenLayers.Control, {
    initialize: function(layer, options) {
        OpenLayers.Control.prototype.initialize.apply(this, [options]);
        this.layer = layer;
        this.handler = new OpenLayers.Handler.Feature(
            this, layer, {
            	click: this.clickAIStarget
            	
            }
        );
    },
    clickAIStarget: function(feature) {
        selectAIStarget(feature);
    },
    setMap: function(map) {
        this.handler.setMap(map);
        OpenLayers.Control.prototype.setMap.apply(this, arguments);
    },
    CLASS_NAME: "OpenLayers.Control.AISselectorControl"
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
	var llprojection=new OpenLayers.Projection("EPSG:4326");
	var mapprojection=new OpenLayers.Projection("EPSG:900913");
	
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
	    	rt.layer_extent = new OpenLayers.Bounds(e2f(bb,'minlon'),e2f(bb,'minlat'),
	    			e2f(bb,'maxlon'),e2f(bb,'maxlat')).transform(llprojection,mapprojection);
	    });
	    
	    $(tm).find(">Origin").each(function(nr,or){
	    	rt.tile_origin = new OpenLayers.LonLat(e2f(or,'x'),e2f(or,'y'));
	    });
	    if (! rt.tile_origin){
	    	rt.tile_origin=new OpenLayers.LonLat(-20037508.343,-20037508.343);
	    }
	    
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
	    	var bounds=new OpenLayers.Bounds(e2f(bb,'minlon'),e2f(bb,'minlat'),
	    			e2f(bb,'maxlon'),e2f(bb,'maxlat')).transform(llprojection,mapprojection);
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
	var rt={
	};
	//use the movable type stuff for computations
	var llsrc=new LatLon(srcll.lat,srcll.lon);
	var lldst=new LatLon(dstll.lat,dstll.lon);
	rt.dts=llsrc.distanceTo(lldst,5)*1000;
	rt.dtsnm=rt.dts/NM;
	rt.course=llsrc.bearingTo(lldst);
	return rt;
}

/*cpa/tcpa computation
  hard to find some sources - best at 
  https://www.google.de/url?sa=t&rct=j&q=&esrc=s&source=web&cd=12&ved=0CDgQFjABOAo&url=http%3A%2F%2Forin.kaist.ac.kr%2Fboard%2Fdownload.php%3Fboard%3Dpublications%26no%3D32%26file_no%3D130&ei=2yaqUbb5GJPV4ASm9oDoBg&usg=AFQjCNFZA1OZGnJvY4USs5buqe8-BCsAiQ&sig2=fbsksaJ3sYIIO3intM-iZw&cad=rja
  basically assume courses being straight lines (should be fine enough for our 20nm....)
  if we have the intersection point, we have:
     a=angle between courses, 
     da=initial distance from ship a to intersect
     db=initial distance from ship b to intersect
     va=speed a
     vb=speed b
   we can now simply use a coord system having the origin at current b position , x pointing towards the intersect
   xa=(da-va*t)*cos(a)
   ya=(da-va*t)*sin(a)
   xb=(db-vb*t)
   yb=0
   For the distance we get:
   s=sqrt((xa-xb)^^2+(ya-yb)^^2))
   with inserting and differentiating against t + finding null (tm being the time with minimal s)
   tm=((va*da+vb*db)-cos(a)*(va*db+vb*da))/(va^^2+vb^^2-2*va*vb*cos(a))
   we need to consider some limits...
   we return -1 if no meaningfull tpa
*/
function computeTPA(a,da,db,va,vb){
	var n=va*va+vb*vb-2*va*vb*Math.cos(a);
	if (n < 1e-6 && n > -1e-6) return -1;
	var tm=((va*da+vb*db)-Math.cos(a)*(va*db+vb*da))/n;
	return tm;
}

//compute the CPA point 
//returns srclon,srclat,dstlon,dstlat,cpa(m),cpanm(nm),tcpa(s),front (true if src reaches intersect point first)
//each of the objects must have: lon,lat,course,speed
//lon/lat in decimal degrees, speed in kn
function computeCPAdata(src,dst){
	var rt={
			lat:0,
			lon:0,
			cpa:0,
			tcpa:0,
      front: false
	};
	if (dst.speed < properties.minAISspeed){
		return rt;
	}
	var llsrc=new LatLon(src.lat,src.lon);
	var lldst=new LatLon(dst.lat,dst.lon);
	var intersect=LatLon.intersection(llsrc,src.course,lldst,dst.course);
	if (! intersect) return rt;
	var da=llsrc.distanceTo(intersect,5)*1000; //m
  var timeIntersectSrc=0;
  if (src.speed) timeIntersectSrc=da/src.speed; //strange unit: m/nm*h -> does not matter as we only compare
	var db=lldst.distanceTo(intersect,5)*1000; //m
  var timeIntersectDest=0;
  if (dst.speed) timeIntersectDest=db/dst.speed; //strange unit: m/nm*h -> does not matter as we only compare
  if (timeIntersectSrc < timeIntersectDest) rt.front=true;
	var a=(src.course-dst.course)*Math.PI/180;
	var va=src.speed*NM; //m/h
	var vb=dst.speed*NM;
	var tm=computeTPA(a,da,db,va,vb); //tm in h
	if (tm < 0) return rt;
	if (tm >= properties.maxAisTPA) return rt;
	var cpasrc=llsrc.destinationPoint(src.course,src.speed*NM/1000*tm);
	var cpadst=lldst.destinationPoint(dst.course,dst.speed*NM/1000*tm);
	rt.tcpa=tm*3600;
	rt.cpa=cpasrc.distanceTo(cpadst,5)*1000;
	rt.cpanm=rt.cpa/NM;
	rt.srclon=cpasrc._lon;
	rt.srclat=cpasrc._lat;
	rt.dstlon=cpadst._lon;
	rt.dstlat=cpadst._lat;
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
	updateCenterDisplay();
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
	var ctxdata={};
	ctxdata.mapsequence=mapsequence;
	$.ajax({
		url: url,
		dataType: 'json',
		cache:	false,
		context: ctxdata,
		success: function(data,status){
			if (this.mapsequence != mapsequence)
				//the map has been changed while the ajax request was running
				//recreate the track data on next query
				lastTrackQuery=0;
			else{
				lastTrackQuery=new Date().getTime();
				if (map) map.addTrackData(data);
			}
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

function queryAISData(){
	if (! map){
		window.clearTimeout(aisTimer);
		aisTimer=window.setTimeout(queryAISData,properties.aisQueryTimeout);
		return;
	}
	var url=properties.navUrl+"?request=ais";
	var urlparam=OpenLayers.Util.getParameters();
	if (urlparam.demo != null){
		url+="&demo="+urlparam.demo;
	}
	var center=map.mapPosToLonLat(map.getCenter());
	url+="&lon="+formatDecimal(center.lon,3,5);
	url+="&lat="+formatDecimal(center.lat,3,5);
	url+="&distance="+formatDecimal(properties.aisDistance||10,4,1);
	var ctxdata={};
	ctxdata.mapsequence=mapsequence;
	$.ajax({
		url: url,
		dataType: 'json',
		cache:	false,
		context: ctxdata,
		success: function(data,status){
			aisErrors=0;
			if (data.class && data.class == "error") aisList=[];
			else aisList=data;
			handleAISData();
			window.clearTimeout(aisTimer);
			aisTimer=window.setTimeout(queryAISData,properties.aisQueryTimeout);
		},
		error: function(status,data,error){
			log("query ais error");
			aisErrors+=1;
			if (aisErrors >= properties.maxAisErrors){
				aisList=[];
				handleAISData();
			}
			window.clearTimeout(aisTimer);
			aisTimer=window.setTimeout(queryAISData,properties.aisQueryTimeout);
		},
		timeout: 10000
	});
}

function aisSort(a,b){
	try{
		if (a.distance == b.distance) return 0;
		if (a.distance<b.distance) return -1;
		return 1;
	} catch (err){
		return 0;
	}
}

/*
 * handle the received AIS data
 * 1. compute distances, cpa, tcpa
 * 1a. check if the tracked target is still there, otherwise set this to "closest"
 * 1b. check if we have target nearer the cpa warning level, in this case track the one with the smallest tcpa
 * 2. update the aisInfoPanel
 * 3. update the map
 * 4. update the AIS page if currently shown
 * aisList must already be sorted by distance
 */

function handleAISData(){
	if (map && map.boatFeature.attributes.validPosition){
		var boatPos=new OpenLayers.LonLat(map.boatFeature.attributes.lon,map.boatFeature.attributes.lat);
		var foundTrackedTarget=false;
		var aisWarningAis=null;
		for (aisidx in aisList){
			var ais=aisList[aisidx];
			var dst=computeDistances(boatPos,new OpenLayers.LonLat(ais.lon,ais.lat));
			var cpadata=computeCPAdata({
				lon:boatPos.lon,
				lat:boatPos.lat,
				course: map.boatFeature.attributes.course||0,
				speed: map.boatFeature.attributes.speed||0
			},
			{
				lon:parseFloat(ais.lon||0),
				lat:parseFloat(ais.lat||0),
				course: parseFloat(ais.course||0),
				speed: parseFloat(ais.speed||0)	
			}
			);
			ais.distance=dst.dtsnm;
			ais.headingTo=dst.heading;
			if (cpadata.tcpa){
				ais.cpa=cpadata.cpanm;
				ais.tcpa=cpadata.tcpa;
			}
			else {
				ais.cpa=0;
				ais.tcpa=0;
			}
      ais.passFront=cpadata.front;
			if (! ais.shipname) ais.shipname="unknown";
			if (! ais.callsign) ais.callsign="????";
			if (ais.cpa && ais.cpa < properties.aisWarningCpa && ais.tcpa && ais.tcpa < properties.aisWarningTpa){
				if (aisWarningAis){
					if (aisWarningAis.tcpa > ais.tcpa) aisWarningAis=ais;
				}
				else aisWarningAis=ais;
			}
			if (ais.mmsi == trackedAIStarget) foundTrackedTarget=true;
		}
		if (! foundTrackedTarget) trackedAIStarget=null;
		if (! aisWarningAis) aisWarningTarget=null;
		else aisWarningTarget=aisWarningAis.mmsi;
	}
	if (aisList) aisList.sort(aisSort);
	updateAISInfoPanel();
	if (map){
		map.updateAIS(aisList);
	}
	updateAISPage();
	
}


function updateAISInfoPanel(){
	if (! isPageVisible('nav')){
			hideAISPanel();
			return;
	}
	if (map && map.ais_layer.getVisibility()){
		if (aisList.length){
			showAISPanel();
			var ais;
			var displayClass="avn_ais_info_first";
			var warningClass="avn_ais_info_warning";
			var isFirst=true;
			if (!trackedAIStarget && ! aisWarningTarget )ais=aisList[0];
			else {
				for(var idx in aisList){
					if ( aisWarningTarget){
						if (aisList[idx].mmsi != aisWarningTarget) continue;
						isFirst=false;
						ais=aisList[idx];
						break;
					}
					if (aisList[idx].mmsi == trackedAIStarget){
						ais=aisList[idx];
						if (idx != 0) isFirst=false;
						break;
					}
				}
			}
			if (! ais){
				//maybe our target disappeared...
				trackedAIStarget=null;
				ais=aisList[0];
				isFirst=true;
			}
			if (!aisWarningTarget) $('#aisInfo').removeClass(warningClass);
			if (isFirst) $('#aisInfo').addClass(displayClass);
			else {
				$('#aisInfo').removeClass(displayClass);
				if (aisWarningTarget) $('#aisInfo').addClass(warningClass);
			}
			$('#aisDst').text(aisparam['distance'].format(ais));
			$('#aisSog').text(aisparam['speed'].format(ais));
			$('#aisCog').text(aisparam['course'].format(ais));
			$('#aisCpa').text(aisparam['cpa'].format(ais));
			$('#aisTcpa').text(aisparam['tcpa'].format(ais)); //TODO
			$('#aisMmsi').text(aisparam['mmsi'].format(ais));
			$('#aisName').text(aisparam['shipname'].format(ais));
			$('#aisDestination').text(aisparam['destination'].format(ais));
			$('#aisFront').text(aisparam['passFront'].format(ais));
			$('#aisShiptype').text(aisparam['shiptype'].format(ais));
		}
		else{
			hideAISPanel();
		}
	}
	else {
		hideAISPanel();
	}
}

//called from the AIS page, when an AIS target is selected
function aisSelection(mmsi,idx){
	if (! map) return;
	var now=new Date().getTime();
	//we have some bug in boat browser that seems to fire a mouse event when we active this page
	//so prevent any action here for 600ms
	if (pageActivationTimes['ais'] && pageActivationTimes['ais'] > (now -600)) return;
	if (idx != 0){
		if (! mmsi) return;
		trackedAIStarget=mmsi;
	}
	else {
		trackedAIStarget=null;
	}
	map.boatFeature.attributes.isLocked=false;
	handleToggleButton('#btnLockPos',false);
	showPage('nav');
	updateAISInfoPanel();
	map.centerToAIStarget(mmsi);
}

//called from the MAP when an AIS target is selected
function selectAIStarget(feature){
	if (! feature)return;
	var mmsi=feature.attributes.mmsi;
	if (!mmsi) return;
	trackedAIStarget=mmsi;
	hideAISPanel();
	showPage('ais');
	updateAISPage(true);
}
function updateAISPage(initial){
	
	if (isPageVisible('ais')){
		var html='<div class="avn_ais_infotable">';
		html+='<div class="avn_ais avn_ais_headline">';
		for (var p in aisparam){
			html+='<div class="avn_aisparam">'+aisparam[p].headline+'</div>';
		}
		html+='</div>';
		for( var aisidx in aisList){
			var ais=aisList[aisidx];
			var addClass='';
			if (aisWarningTarget){
				if (ais.mmsi == aisWarningTarget) addClass='avn_ais_warning';
			}
			else {
				if ((trackedAIStarget && ais.mmsi == trackedAIStarget)|| (! trackedAIStarget && aisidx==0)) addClass='avn_ais_selected';
			}
			html+='<div class="avn_ais '+addClass+'" onclick="aisSelection(\''+ais['mmsi']+'\','+aisidx+')">';
			for (var p in aisparam){
				html+='<div class="avn_aisparam">'+aisparam[p].format(ais)+'</div>';
			}
			html+='</div>';
		}
		html+='</div>';
		$('#aisPageContent').html(html);
		if (initial){
			var topElement=$('#aisPageContent .avn_ais_selected').position();
			if (! topElement)topElement=$('#aisPageContent .avn_ais_warning').position();
			if (topElement){
				$('#aisPageContent').scrollTop(topElement.top);
			}
		}
	}
	else{
		$('#aisPageContent').empty();
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
		if (i == 0) continue;
		dhtml+='<ul id="'+layer.name+'" ';
		if (!layer.calculateInRange()){
			if (layer.getVisibility()) dhtml+='class="ui-selected ui-disabled" ';
			else dhtml+='class="ui-disabled"';
		}
		else {
			if ( layer.getVisibility()) dhtml+='class="ui-selected"';
		}
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
						  
				          if ($(el).hasClass('ui-selected')){
				        	  map.layers[idx+1].setVisibility(true);
				          }
				          else {
				        	  map.layers[idx+1].setVisibility(false);
				          }
				          if (map.layers[idx+1]==map.boatFeature.layer){
				        	  if (map.boatFeature.attributes.isLocked) map.moveMapToFeature(map.boatFeature);
				        	  handleToggleButton('#btnLockPos',map.boatFeature.attributes.isLocked
				        			  && map.layers[idx+1].getVisibility());
				        	  updateCourseDisplay();
				          }
				        });
					updateAISInfoPanel();
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
	$('#selectLayerList ul').bind( "mousedown", function ( e ) {
	    if ($(this).hasClass('ui-selected')){
	    	$(this).removeClass('ui-selected');
	    }
	    else{
	    	$(this).addClass('ui-selected');
	    }
	} );
	//$('.ui-dialog-content').niceScroll();
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
                hideCenterFeature();
		
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
        hideCenterFeature();
	}
	handleToggleButton('#btnLockPos',map.boatFeature.attributes.isLocked,(map.boatFeature.attributes.validPosition?'avn_buttonActive':'avn_buttonActiveError'));
}
function btnNavCancel(){
	handleMainPage();
}

function btnNavAIS(){
	var aisinfo='#aisInfo';
	if ($(aisinfo).is(':visible')){
		hideAISPanel();
	}
	else {
		showAISPanel();
	}
}

function btnAISCancel(){
	showPage('nav');
	updateAISInfoPanel();
}
function btnAISFirst(){
	trackedAIStarget=null;
	showPage('nav');
	if (aisList.length) map.centerToAIStarget(aisList[0].mmsi);
	updateAISInfoPanel();
}

function hideAISPanel(){
	var aisinfo='#aisInfo';
	if (!$(aisinfo).is(':visible')){
		return;
	}
	else {
		showHideAdditionalPanel(aisinfo,false);
        updateMapSize();
	}
}

function showAISPanel(){
	var aisinfo='#aisInfo';
	if ($(aisinfo).is(':visible')){
		return;
	}
	else {
		showHideAdditionalPanel(aisinfo,true);
		$(aisinfo).click(function(e){
			showPage('ais');
			updateAISPage(true);
		});
        updateMapSize();
	}
}

function btnShowStatus(){
	showPage('status');
	updateStatus(true);
}
function btnStatusCancel(){
	showPage('main');
	stopStatus();
}
function btnStatusUpdate(){
	updateStatus(true);
}

function updateStatus(auto){
	if (auto){
		if (! statusQuery) statusQuery=1;
		else statusQuery++;
	}
	if (! statusQuery) return;
	var url=properties.navUrl+"?request=status";
	$.ajax({
		url: url,
		dataType: 'json',
		cache:	false,
		context: {sequence:statusQuery},
		success: function(data,status){
			if (this.sequence != statusQuery) return;
			showStatusData(data);
			statusTimer=window.setTimeout(updateStatus,properties.statusQueryTimeout);
		},
		error: function(status,data,error){
			log("status position error");
			if (this.sequence != statusQuery) return;
			statusTimer=window.setTimeout(updateStatus,properties.statusQueryTimeout);
		},
		timeout: 10000
	});
}

function stopStatus(){
	statusQuery=0;
	if (statusTimer) window.clearTimeout(statusTimer);
}

function statusTextToImageUrl(text){
	var rt=properties.statusIcons[text];
	if (! rt) rt=properties.statusIcons.INACTIVE;
	return rt;
}
function formatChildStatus(item){
	var ehtml='<img src="';
	ehtml+=statusTextToImageUrl(item.status);
	ehtml+='"/><span class="avn_status_name">'+item.name+'</span><span class="avn_status_info">'+item.info+'</span><br>';
	return ehtml;
}

function showStatusData(data){
	if (!isPageVisible('status')) return;
	var statusTemplate=$('.avn_statuspage #statusTemplate:first').clone();
	var childStatusTemplate=$('.avn_statuspage #childStatusTemplate:first').clone();
	$('.avn_statuspage #statusData .avn_status').remove();
	$('.avn_statuspage  #statusData .avn_child_status').remove();
	for (var e in data.handler){
		var worker=data.handler[e];
		var domEntry=statusTemplate.clone();
		domEntry.html('<span class="avn_status_name">'+worker.name+'</span><br>');
		$('.avn_statuspage #statusData').append(domEntry);
		if (worker.info.items) for (var c in worker.info.items){
			var child=worker.info.items[c];
			var cdomEntry=childStatusTemplate.clone();
			cdomEntry.html(formatChildStatus(child));
			$('.avn_statuspage #statusData').append(cdomEntry);
		}
	}
	$('.avn_statuspage #statusData .avn_status').show();
	$('.avn_statuspage #statusData .avn_child_status').show();
	
}

//event handlers

function mouseEvent(e){
		if (e.xy == null) return;
}

function moveEvent(){
  var pos=map.getCenter();
  moveMarkerFeature(pos);
  moveCenterFeature(pos);
	
}
function moveEndEvent(){
  var pos=map.getCenter();
	moveMarkerFeature(pos,true);
  moveCenterFeature(pos,true);
	userData.mapPosition=pos;
	userData.mapZoom=map.zoom+zoomOffset;
	$.cookie(properties.cookieName,userData);
	
}

function zoomEndEvent(){
	if (! map) return;
	for (var i in map.layers){
		var layer=map.layers[i];
		if (layer.nextLayer !== undefined){
			//as we have potentially hidden a couple of tiles
			//we must now redraw the layer if the next layer becomes invisible
			var nlir=layer.nextLayer.calculateInRange();
			if (layer.lastNextLayerInRange != nlir){
				layer.redraw();
				layer.lastNextLayerInRange = nlir;
			}
		}
	}
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

function moveCenterFeature(pos,moveEnd){
  if (! map) return;
  if (! map.markerFeature.attributes.isLocked || map.boatFeature.attributes.isLocked|| ! map.centerFeature.layer.getVisibility()){
    hideCenterFeature();
    return;
  }
  map.centerFeature.move(pos);
  if (map.centerFeature.style.display == "none"){
    map.centerFeature.style.display=null;
    map.centerFeature.layer.redraw();
  }
  if (! ($('#centerDisplay').is(':visible'))){
    $('#centerDisplay').show();
    $('#centerDisplay').click(function(e){
      hideCenterFeature();
    });
  }
  updateCenterDisplay();
  if (centerTimer) window.clearTimeout(centerTimer);
  if (moveEnd && properties.centerDisplayTimeout){
    centerTimer=window.setTimeout(hideCenterFeature,properties.centerDisplayTimeout);
  }
}

function updateCenterDisplay(){
  if (! ($('#centerDisplay').is(':visible')))return;
  var markerDist=computeDistances(map.markerFeature.geometry,map.centerFeature.geometry,true);
  var boatDist=computeDistances(map.boatFeature.geometry,map.centerFeature.geometry,true);
  $('#centerBoatDistance').text(formatDecimal(boatDist.dtsnm,3,1));
  $('#centerMarkerDistance').text(formatDecimal(markerDist.dtsnm,3,1));
  $('#centerBoatCourse').text(formatDecimal(boatDist.course,3,0));
  $('#centerMarkerCourse').text(formatDecimal(markerDist.course,3,0));
	$('#centerPosition').text(formatLonLats(map.mapPosToLonLat(map.centerFeature.geometry)));
}

function hideCenterFeature(){
  if (! map) return;
  if (map.centerFeature.style.display == "none") return;
  map.centerFeature.style.display="none";
  map.centerFeature.layer.redraw();
  if ($('#centerDisplay').is(':visible')){
    $('#centerDisplay').hide();
  }
  if (centerTimer) window.clearTimeout(centerTimer);
}
//update the map size while preventing showing the center display
function updateMapSize(){
  if (map) map.updateSize();
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
		map.moveTo(new OpenLayers.LonLat(userData.mapPosition.lon,userData.mapPosition.lat),userData.mapZoom-zoomOffset);
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
    //allow some upscaling also for tha max zoom layer (but only if we are below some limit...)
    if (maxZoom < properties.maxZoom){
    	maxZoom+=properties.maxUpscale;
    	if (maxZoom > properties.maxZoom) maxZoom=properties.maxZoom;
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
    	if (layer.url === undefined){
    		error("missing href in layer");
    	}
    	if (! layer.url.match(/^http:/)){
    		baseurl=url+"/"+layer.url;
    	}
    	else baseurl=layer.url;
    	
    	var layermaxzoom=maxZoom+zoomOffset;
    	if ((layer.maxZoom+properties.maxUpscale) < layermaxzoom) layermaxzoom=layer.maxZoom+properties.maxUpscale;
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
    for (var i=tiler_overlays.length-2;i>=0;i--){
    	tiler_overlays[i].nextLayer=tiler_overlays[i+1];
    }
    
    
    //the vector layers
    var centerLayer=new OpenLayers.Layer.Vector("Center");
    var markerLayer=new OpenLayers.Layer.Vector("Marker");
    var boatLayer=new OpenLayers.Layer.Vector("Boat");
    var headingLayer=new OpenLayers.Layer.Vector("Heading");
    //the track layer is a member of the map as we can only draw the feature as soon as we hav at least 2 points...
    tmap.track_layer=new OpenLayers.Layer.Vector("Track");
    tmap.ais_layer=new OpenLayers.Layer.Vector("AIS");
    
    var style_mark = OpenLayers.Util.extend({}, OpenLayers.Feature.Vector.style['default']);
    style_mark.graphicWidth = 40;
    style_mark.graphicHeight = 40;
    
    style_mark.externalGraphic = "images/Marker1.png";
    // title only works in Firefox and Internet Explorer
    style_mark.title = "Marker";
    style_mark.rotation=0;
    style_mark.fillOpacity=1;
    
    var style_center_mark = OpenLayers.Util.extend({}, OpenLayers.Feature.Vector.style['default']);
    style_center_mark.graphicWidth = 40;
    style_center_mark.graphicHeight = 40;
    
    style_center_mark.externalGraphic = "images/Marker2.png";
    style_center_mark.title = "Center";
    style_center_mark.rotation=0;
    style_center_mark.fillOpacity=1;
    
    var style_boat = OpenLayers.Util.extend({}, OpenLayers.Feature.Vector.style['default']);
    //must fit to the dimensions of the boat: 100x400, offset 50,241
    style_boat.graphicWidth = 30;
    style_boat.graphicHeight = 120;
    style_boat.graphicXOffset=-15;
    style_boat.graphicYOffset=-72;
    
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
    
    tmap.style_ais = OpenLayers.Util.extend({}, OpenLayers.Feature.Vector.style['default']);
    //must fit to the dimensions of the ais target: 100x300, offset 50,200
    tmap.style_ais.graphicWidth = 30;
    tmap.style_ais.graphicHeight = 90;
    tmap.style_ais.graphicXOffset=-15;
    tmap.style_ais.graphicYOffset=-60;
    
    
    tmap.style_ais.externalGraphic = "images/ais-default.png";
    // title only works in Firefox and Internet Explorer
    tmap.style_ais.title = "AIS";
    tmap.style_ais.rotation=20;
    tmap.style_ais.fillOpacity=1;
    tmap.style_ais.labelOutlineWidth=3;
    tmap.style_ais.labelYOffset=15;
    tmap.style_ais.fontSize="14px";
   
    
    tmap.addLayers([osm].concat(tiler_overlays).concat([centerLayer,markerLayer,headingLayer,tmap.track_layer,tmap.ais_layer,boatLayer]));
    //boatLayer.setZIndex(1001);
    //map.maxZoomLevel=osm.getZoomForResolution(minRes);
    tmap.zoomToExtent(firstLayer.layer_extent,true);
    var initialZoom=tmap.getZoomForResolution(maxRes)+1;
    
    tmap.zoomTo(initialZoom);
    var center=tmap.getCenter();
    var point=new OpenLayers.Geometry.Point(center.lon,center.lat);
    tmap.markerFeature=new OpenLayers.Feature.Vector(point,{isLocked:false},style_mark);
    var centerPoint=new OpenLayers.Geometry.Point(center.lon,center.lat);
    tmap.centerFeature=new OpenLayers.Feature.Vector(centerPoint,{isLocked:false},style_center_mark);
    var boatPoint=new OpenLayers.Geometry.Point(1509813.9046919 ,7220215.0083809); //put the boat at a nice pos
    tmap.boatFeature=new OpenLayers.Feature.Vector(boatPoint,{isLocked:false,angle:0,validPosition:false, oldPosition:false},style_boat);
    tmap.headingFeature=new OpenLayers.Feature.Vector(new OpenLayers.Geometry.LineString([boatPoint,point]),{},style_bearing);
    centerLayer.addFeatures([tmap.centerFeature]);
    markerLayer.addFeatures([tmap.markerFeature]);
    boatLayer.addFeatures([tmap.boatFeature]);
    headingLayer.addFeatures([tmap.headingFeature]);
    
    tmap.addControl(new OpenLayers.Control.Graticule({layerName: 'Grid', id: 'grid',intervals: [0.16666666666666666666666666666667,0.083333333333333333333333333333333],
    		autoActivate: false}));
    var aisSelectFeature= new OpenLayers.Control.AISselectorControl(
    	tmap.ais_layer
    );
    tmap.addControl(aisSelectFeature);
    aisSelectFeature.activate();
    tmap.events.register("zoomend",tmap,function(e){
    	if ((tmap.zoom +zoomOffset) < properties.minGridLedvel) tmap.getControl('grid').deactivate();
    	else tmap.getControl('grid').activate();
    });
    tmap.events.register("mousemove", tmap, mouseEvent);
    tmap.events.register("moveend", tmap, moveEndEvent);
    tmap.events.register("move", tmap, moveEvent);
    tmap.events.register("zoomend",tmap,zoomEndEvent);

	$('#markerPosition').text(formatLonLats(tmap.mapPosToLonLat(tmap.getCenter())));
	map=tmap;
	mapsequence+=1;
	$('.avn_toggleButton').addClass("avn_buttonInactive");
	
	$('.avn_markerPosition').click(function(e){
		if (map.markerFeature.attributes.isLocked && ! map.boatFeature.attributes.isLocked){
			map.moveMapToFeature(map.markerFeature,true);
		}
	});
	$('.avn_boatPosition').click(function(e){
		map.moveMapToFeature(map.boatFeature,true);
	});
	
	
    readUserData();

	

}

function showHideAdditionalPanel(id,show){
  var mainLocation='bottom';
  if ($(id).hasClass('avn_left')) mainLocation='left';
  if ($(id).hasClass('avn_right')) mainLocation='right';
  if ($(id).hasClass('avn_top')) mainLocation='top';
	var npos=null;
	var mainid='.avn_main';
	var oval=parseInt($(mainid).css(mainLocation).replace(/px/,''));
	
	if (show){
		if ($(id).is(':visible')) return;
		$(id).show();
		elheight=$(id).height();
		elwidth=$(id).width();
		if (mainLocation == 'bottom' || mainLocation=='top') npos=oval+elheight;
		if (mainLocation == 'left' || mainLocation=='right') npos=oval+elwidth;
	}
	else {
		if (!$(id).is(':visible')) return;
		elheight=$(id).height();
		elwidth=$(id).width();
		$(id).hide();
		if (mainLocation == 'bottom' || mainLocation=='top') npos=oval-elheight;
		if (mainLocation == 'left' || mainLocation=='right') npos=oval-elwidth;
	}
	if (npos != null){
		$(mainid).css(mainLocation,npos+"px");
	}
	if (map) map.updateSize();
        //additional top/bottom panels should only fill the same width as main
        $('.avn_top:visible').css('left',$(mainid).css('left'));
        $('.avn_bottom:visible').css('left',$(mainid).css('left'));
        $('.avn_top:visible').css('right',$(mainid).css('right'));
        $('.avn_bottom:visible').css('right',$(mainid).css('right'));
}

function showPage(name){
  hideCenterFeature();
  hideAISPanel();
	//set the page activation time to e.g. prevent some strange errors on boat browser
	pageActivationTimes[name]=new Date().getTime();
	//first hide all pages, afterwards show the selected one
	for (p in properties.pages){
		var pname=properties.pages[p];
		if (pname != name){
			$('.avn_'+pname+'page').hide();
		}
	}
	for (p in properties.pages){
		var pname=properties.pages[p];
		if (pname == name){
			$('.avn_'+pname+'page').show();
		}
	}
}

function isPageVisible(name){
	return $('.avn_'+name+'page_main').is(':visible');
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
				domEntry.attr('href',"javascript:handleNavPage('"+chartEntry.url+"','"+chartEntry.charturl+"')");
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
function handleNavPage(list,chartbase){
	if (! chartbase){
		chartbase=list;
	}
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
			initMap(data,chartbase);
			handleGpsStatus(false, true);
			updateAISInfoPanel();
		},
		error: function(ev){
			alert("unable to load charts "+ev.responseText);
		}
	});
	return false;
}

function showButtons(){
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
	$('.avn_btAISCancel').button({
		icons: {
	  		 primary: "ui-icon-unlocked"
	  	 },
		text: false,
	  	label: 'Nav'
	   	});
	$('.avn_btAISFirst').button({
		icons: {
	  		 primary: "ui-icon-unlocked"
	  	 },
		text: false,
	  	label: 'Track first'
	   	});
	$('.avn_btNavAIS').button({
		text: 'AIS',
	  	label: 'AIS'
	   	});
	
	$('.avn_btStatusCancel').button({
		icons: {
	  		 primary: "ui-icon-unlocked"
	  	 },
		text: false,
	  	label: 'Main'
	   	});
	$('.avn_btStatusUpdate').button({
		icons: {
	  		 primary: "ui-icon-arrowrefresh-1-w"
	  	 },
		text: false,
	  	label: 'Update'
	   	});
	$('.avn_btShowStatus').button({
		icons: {
	  		 primary: "ui-icon-signal"
	  	 },
		text: false,
	  	label: 'Status'
	   	});
	
	 
}

$(document).ready(function(){
	var urlpar=OpenLayers.Util.getParameters();
	var entry_list=null;
	if (urlpar.charts!= null){
		entry_list=[].concat(urlpar.charts);
	}
	showButtons();
	if (! entry_list){
		handleMainPage();
	}	
	else {
		handleNavPage(entry_list[0]);
	}
	queryPosition();
	queryTrackData();
	queryAISData();
});
