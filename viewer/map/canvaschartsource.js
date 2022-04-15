/**
 *###############################################################################
 # Copyright (c) 2012-2020 Andreas Vogel andreas@wellenvogel.net
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
 #  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHERtime
 #  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 #  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 #  DEALINGS IN THE SOFTWARE.
 #
 ###############################################################################
 */

import Requests from '../util/requests.js';
import ChartSourceBase from './chartsourcebase.js';
import {Style as olStyle, Stroke as olStroke, Circle as olCircle, Icon as olIcon, Fill as olFill} from 'ol/style';
import Helper from "../util/helper";
import {assign} from "ol/obj";
import ImageCanvasSource from 'ol/source/ImageCanvas';
import ImageLayer from 'ol/layer/Image';

let lonlat_to_Canvas=function(coordinate) {
	const coordinates=this.mapholder.olmap.getPixelFromCoordinate(this.mapholder.transformToMap(coordinate));
	const mapExtent = this.mapholder.olmap.getView().calculateExtent(this.mapholder.olmap.getSize())
	const mapCenter = [mapExtent[0]+(mapExtent[2]-mapExtent[0])/2,mapExtent[1]+(mapExtent[3]-mapExtent[1])/2];
	const mapCenterPixel = this.mapholder.olmap.getPixelFromCoordinate(mapCenter);
	coordinates[0]-=mapCenterPixel[0]
	coordinates[1]-=mapCenterPixel[1]
    coordinates[0]*=this.mapholder.drawing.devPixelRatio;
    coordinates[1]*=this.mapholder.drawing.devPixelRatio;
	return(coordinates);

		}


let styleParam={};
class CanvasChartSource extends ChartSourceBase{
    /**
     *
     * @param mapholer
     * @param chartEntry
     *        properties: url - the url of the gpx
     *                    icons - the base url for icons (if points have a sym)
     *                    defaultIcon - the url for an icon if sym not found (opt)
     *                    minZoom - minimal zoom (opt)
     *                    maxZoom - maximal zoom (opt)
     *                    minScale - min zoom, lower zoom decrease symbol size (opt)
     *                    maxScale - max zoom, higher zooms increase symbol size (opt)
     *                    opacity - 0...1 (opt)
     */
    constructor(mapholer, chartEntry) {
        super(mapholer,chartEntry);
        this.styleMap={};
		this.map=mapholer.olmap;
		//map=mapholer.olmap;
		this.mapholder=mapholer;
        this.styleFunction=this.styleFunction.bind(this);

        for (let k in styleParam) {
            if (chartEntry[stylePrefix + k] !== undefined) {
                styleParam[k] = chartEntry[stylePrefix + k];
            }
        }
        let image;
        if (this.chartEntry.defaultIcon) {
            image=new olIcon({
                url: this.chartEntry.defaultIcon
            })
        }
        else {
            image = new olCircle({
                radius: styleParam.circleWidth/2,
                fill: new olFill({
                    color: styleParam.fillColor,
                })
            });
        }

        this.styles = {
        };

    }
    styleFunction(feature,resolution) {
        let type=feature.getGeometry().getType();
        return this.styles[feature.getGeometry().getType()];
    }
    prepareInternal() {
    	let url = this.chartEntry.url;
    	let self = this;
    	return new Promise((resolve, reject)=> {
    		if (!url) {
    			reject("no url for "+this.chartEntry.name);
    			return;
    		}
    		Requests.getHtmlOrText(url)
            		.then((data)=>{
    			try {
    				eval.apply( ImageCanvasSource, [data] );
    				{
						let canvasLayer;
    					let canvasSource = new ImageCanvasSource({
    						canvasFunction: mycanvasFunction,
    						//projection: 'EPSG:3857'
    					})
						canvasSource.mapholder = this.mapholder;
						canvasSource.userFunction = userCanvasFunction;
						canvasSource.lonlat_to_Canvas = lonlat_to_Canvas;  

    					let layerOptions={
    					                  source: canvasSource,
    					                  opacity: this.chartEntry.opacity!==undefined?parseFloat(this.chartEntry.opacity):1 ,
    					};
    					if (this.chartEntry.minZoom !== undefined) layerOptions.minZoom=this.chartEntry.minZoom;
    					if (this.chartEntry.maxZoom !== undefined) layerOptions.maxZoom=this.chartEntry.maxZoom;
    					canvasLayer = new ImageLayer(layerOptions);

    					resolve([canvasLayer]);

    				}
    			}catch (e){
    				window.avnav.api.showToast(url+" is no valid js: "+e.message);
    			}
    		})
    		.catch((error)=>{
    			window.avnav.api.showToast("unable to load "+url+": "+error)
    		})			
    	});
    }
    featureToInfo(feature,pixel){
        let rt={
            overlayName:this.chartEntry.name,
            overlayType:this.chartEntry.type,
            overlayUrl: this.chartEntry.url,
            overlaySource: this
        };
        if (! feature) {
            return rt;
        }

        let geometry=feature.getGeometry();
        let coordinates;
        if (geometry instanceof olPoint){
            rt.kind='point';
            coordinates=this.mapholder.transformFromMap(geometry.getCoordinates());
            rt.nextTarget=coordinates;
        }
        else{
            if (geometry){
                coordinates=this.mapholder.transformFromMap(geometry.getClosestPoint(this.mapholder.pixelToCoord(pixel)));
                rt.nextTarget=coordinates;
            }
            else {
                coordinates = this.mapholder.transformFromMap(this.mapholder.pixelToCoord(pixel));
            }
        }
        rt.coordinates=coordinates;
        let param=['desc','name','sym','link','linkText'];
        param.forEach((p)=>rt[p]=feature.get(p));
        for (let k in this.chartEntry){
            if (Helper.startsWith(k,stylePrefix)){
                rt[k]=this.chartEntry[k];
            }
        }
        this.formatFeatureInfo(rt,feature,coordinates);
        if (rt.link && this.chartEntry.icons){
            rt.link=this.getLinkUrl(rt.link);
        }
        return rt;
    }
}

export default  CanvasChartSource;



/**
 * checks for correct js syntax and for existence of userCanvasFunction()
 * returns with rt.hasAny if ok
 * @param doc
 * @returns {*}
 *      hasAny
 *
 */
 export const readFeatureInfoFromCanvas=(url,doc)=>{
	 //let parser=new olGeoJSON();
	 let parser = require("acorn").Parser;
	 let parsed
	 let rt={
	         styles:{}
	 };
	 try{
		 parsed = parser.parse(doc);
		 if(parsed.body.find(node => (node.type === 'FunctionDeclaration')&&(node.id.name == 'userCanvasFunction')))
		 {
			 rt.allowFormatter=true;
			 rt.hasAny=true;
			 rt.script=doc;
		 }
		 else
		 	window.avnav.api.showToast(url+" has no userCanvasFunction()");
	 }catch (e){
		 window.avnav.api.showToast(url+" is no valid js: "+e.message);
	 }

	 return rt;
 }


var mycanvasFunction = function(extent, resolution, pixelRatio, size, projection) 
{
	console.log("canvaschartsource:");

	let canvas = document.createElement('canvas');
	canvas.setAttribute("width", size[0]);
	canvas.setAttribute("height", size[1]);
	var mapExtent = this.mapholder.olmap.getView().calculateExtent(this.mapholder.olmap.getSize())
	const mapCenter = [mapExtent[0]+(mapExtent[2]-mapExtent[0])/2,mapExtent[1]+(mapExtent[3]-mapExtent[1])/2];
	const mapCenterPixel = this.mapholder.olmap.getPixelFromCoordinate(mapCenter);

	let ctx = canvas.getContext('2d');
	ctx.save();
	ctx.clearRect(0, 0, canvas.getAttribute("width"), canvas.getAttribute("height"));
	// Draw relative to the center of the canvas
	ctx.translate(canvas.getAttribute("width") / 2, canvas.getAttribute("height") / 2);
	// Cancel the rotation of the map.
	ctx.rotate(-this.mapholder.olmap.getView().getRotation());
// USER DEFINED CANVAS DRAWING 
	this.userFunction(canvas);
// END OF USER DEFINED CANVAS DRAWING
	ctx.restore();
	return canvas;
}
