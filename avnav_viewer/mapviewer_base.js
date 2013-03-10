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
        this.clickBarDiv.innerHTML = '<- ' + s + ' ->'
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
  try { console.log.apply(console,arguments) } 
  catch (e) {
      setTimeout(function() {
          throw new Error(msg);
      }, 0);
  }
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
        log(e)
        if (e.code == 101) {
            alert('Google Chrome requires to run with "--allow-file-access-from-files" switch to load XML from local files')
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
    for (i=0; i<tileset_el_lst.length; i++) {
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

function read_tile_list(url) {    
	var rt={};
    var tilemap=read_xml(url);
    if (tilemap == null) {
      error('Cannot read '+url);
        return null;
    }
    rt.title = tilemap.getElementsByTagName("Title")[0].textContent;
    document.title = rt.title;

    var tilemap_el_lst=tilemap.getElementsByTagName("TileMap");
    rt.tile_list=[]
    for (i=0; i<tilemap_el_lst.length; i++) {
        var url=tilemap_el_lst[i].getAttribute('href');
        rt.tile_list[i]=url;
    }
    return rt;
}
function formatLonlats(lonLat) {
  var lat = lonLat.lat;
  var long = lonLat.lon;
  var ns = OpenLayers.Util.getFormattedLonLat(lat);
  var ew = OpenLayers.Util.getFormattedLonLat(long,'lon');
  return ns + ', ' + ew + ' (' + (Math.round(lat * 10000) / 10000) + ', ' + (Math.round(long * 10000) / 10000) + ')';
}

var tile_list=['tilemap.xml']
var tiler_overlays=[];

var urlpar=OpenLayers.Util.getParameters();
if (urlpar.charts!= null){
	tile_list=[].concat(urlpar.charts);
}

OpenLayers.Util.extend( OpenLayers.INCHES_PER_UNIT, {
    "NM": OpenLayers.INCHES_PER_UNIT["nmi"],
    "cbl": OpenLayers.INCHES_PER_UNIT["nmi"]/10,
});

       
log('OpenLayers.VERSION_NUMBER',OpenLayers.VERSION_NUMBER);

function initialize_openlayers() {
	var tile_list=[]
	var entry_list=["avnav.xml"]
	var urlpar=OpenLayers.Util.getParameters();
	if (urlpar.charts!= null){
		entry_list=[].concat(urlpar.charts);
	}
	tiles=read_tile_list(entry_list);
	tile_list=tiles.tile_list;
	tile_parameters=[];
	minRes=99999999; //strange default...
	for (var i in tile_list){
		tile_parameters[i]=read_map_parameters(tile_list[i]);
		if (tile_parameters[i].min_res < minRes) minRes=tile_parameters[i].min_res;
	}
    var map = new OpenLayers.Map('map', {
          projection: new OpenLayers.Projection("EPSG:900913"), //mapProjection,
          projection: new OpenLayers.Projection("EPSG:4326"),
          displayProjection: new OpenLayers.Projection("EPSG:4326"),
          units: "m",
          maxResolution: 156543.0339,
          maxExtent: new OpenLayers.Bounds(-20037508.342789, -20037508.342789, 20037508.342789, 20037508.342789),
            controls: [
                new OpenLayers.Control.Navigation(),
                new OpenLayers.Control.PanZoomBar(),
                new OpenLayers.Control.MousePosition(),
                new OpenLayers.Control.KeyboardDefaults(),
                new OpenLayers.Control.LayerSwitcher({
                    'ascending':false
                }),
                new OpenLayers.Control.ScaleLine({
                    maxWidth: 50,
                    bottomOutUnits: 'NM',
                    bottomInUnits: 'cbl'                            
                }),
            ]
    });
    var osm = new OpenLayers.Layer.OSM(
            "Open Street Map",'http://tile.openstreetmap.org/${z}/${x}/${y}.png',
            {
                displayOutsideMaxExtent: false,
            });
    for (var layeridx =tile_parameters.length-1 ; layeridx>= 0;layeridx--){
    	var layer=tile_parameters[layeridx];
    	var baseurl="";
    	var dir=tile_list[layeridx].replace(/\/[^\/]*$/,'');
    	if (dir != tile_list[layeridx]){
    		baseurl=dir+"/";
    	}
    	var tiler_overlay = new OpenLayers.Layer.TilerToolsXYZ( layer.title, baseurl+"${z}/${x}/${y}."+layer.tile_ext,
        {
            sphericalMecator: true,
            wrapDateLine: true,
            maxExtent: layer.layer_extent,
            tileOrigin: layer.tile_origin,
            tileSize: layer.tile_size,
            //resolutions: layer_resolutions,
            maxResolution: layer.max_res,
            minResolution: minRes,
            serverResolutions: layer.layer_resolutions,
            isBaseLayer: false,
            profile: layer.layer_profile,
            displayOutsideMaxExtent: false,

        });
    	tiler_overlays.push(tiler_overlay);
    }   

     map.addControl(
          new OpenLayers.Control.ClickBar({
              displayClass: "clickbar",
              ratio: 0.8,
              reportRatio: function(ratio){
                  log(ratio);
              if (OpenLayers.Util.alphaHack() == false)
            	  for (var ov in tiler_overlays){
            		  tiler_overlays[ov].setOpacity(ratio);
            	  }
              },
          })
        );

    map.addLayers([osm].concat(tiler_overlays));
    map.zoomToExtent(layer.layer_extent,true);

    map.addControl(new OpenLayers.Control.MousePosition( {id: "ll_mouse", formatOutput: formatLonlats} ));
    map.addControl(new OpenLayers.Control.MousePosition( {id: "utm_mouse", prefix: "UTM ", displayProjection: map.baseLayer.projection, numDigits: 0} ));
    map.addControl(new OpenLayers.Control.Graticule({ intervals: [0.16666666666666666666666666666667,0.083333333333333333333333333333333] }));

}
