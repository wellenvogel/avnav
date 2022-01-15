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
import {Vector as olVectorSource} from 'ol/source';
import {Vector as olVectorLayer} from 'ol/layer';
import {LineString as olLineString, MultiLineString as olMultiLineString, Point as olPoint} from 'ol/geom';
import {GPX as olGPXFormat} from 'ol/format';
import Helper from "../util/helper";
import globalstore from "../util/globalstore";
import keys from "../util/keys";
import {assign} from "ol/obj";
import featureFormatter from "../util/featureFormatter";

export const stylePrefix="style."; // the prefix for style attributes

class GpxChartSource extends ChartSourceBase{
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
        this.styleFunction=this.styleFunction.bind(this);
        let styleParam={
            lineWidth:3,
            lineColor: '#000000',
            fillColor: 'rgba(255,255,0,0.4)',
            strokeWidth: 3,
            circleWidth: 10

        };
        for (let k in styleParam) {
            if (chartEntry[stylePrefix + k] !== undefined) {
                styleParam[k] = chartEntry[stylePrefix + k];
            }
        }
        this.styles = {
            'Point': new olStyle({
                image: new olCircle({
                    fill: new olFill({
                        color: styleParam.fillColor,
                    }),
                    radius: styleParam.circleWidth/2,
                    stroke: new olStroke({
                        color: styleParam.lineColor,
                        width: styleParam.strokeWidth,
                    })
                })
            }),
            'LineString': new olStyle({
                stroke: new olStroke({
                    color: styleParam.lineColor,
                    width: styleParam.lineWidth,
                })
            }),
            'MultiLineString': new olStyle({
                stroke: new olStroke({
                    color: styleParam.lineColor,
                    width: styleParam.lineWidth,
                })
            })
        };
    }

    styleFunction(feature,resolution) {

        let type=feature.getGeometry().getType();
        if (type === 'Point' && (this.chartEntry.icons||this.chartEntry.defaultIcon)){
            let sym=feature.get('sym');
            if (sym){
                if (!this.styleMap[sym]) {
                    let style = new olStyle({
                        image: new olIcon({
                            src: this.getSymbolUrl(sym,'.png')
                        })
                    });
                    this.styleMap[sym] = style;
                }
                let rt=this.styleMap[sym];
                let view=this.mapholder.olmap.getView();
                let scale=1;
                let currentZoom=view.getZoom();
                if (this.chartEntry.minScale && currentZoom < this.chartEntry.minScale){
                    scale=1/Math.pow(2,this.chartEntry.minScale-currentZoom);
                }
                if (this.chartEntry.maxScale && currentZoom > this.chartEntry.maxScale){
                    scale=Math.pow(2,currentZoom-this.chartEntry.maxScale);
                }
                rt.getImage().setScale(scale);
                return rt;
            }
        }
        if (type === 'LineString'){
            //route
            let geometry=feature.getGeometry();
            let styles=[this.styles[type]];
            let isFirst=true;
            geometry.forEachSegment((start,end)=>{
                if (isFirst){
                    styles.push(this.getRoutePointStyle(start));
                    isFirst=false;
                }
                styles.push(this.getRoutePointStyle(end));
            })
            return styles;
        }
        return this.styles[feature.getGeometry().getType()];
    };
    getRoutePointStyle(coordinates){
        return new olStyle({
            geometry: new olPoint(coordinates),
            image: new olCircle({
                fill: new olFill({
                        color: this.styles.LineString.getStroke().getColor()
                    }),
                radius: globalstore.getData(keys.properties.routeWpSize)
            })
        });
    }
    prepareInternal() {
        let url = this.chartEntry.url;
        let self = this;
        return new Promise((resolve, reject)=> {
            if (!url) {
                reject("no url for "+this.chartEntry.name);
                return;
            }
            let vectorSource = new olVectorSource({
                format: new olGPXFormat(),
                loader: (extent,resolution,projection)=>{
                    Requests.getHtmlOrText(url,{},{'_':(new Date()).getTime()})
                        .then((gpx)=>{
                            gpx=stripExtensions(gpx);
                            vectorSource.addFeatures(
                                vectorSource.getFormat().readFeatures(gpx,{
                                    extent: extent,
                                    featureProjection: projection,
                                })
                            );
                        })
                        .catch((error)=>{
                            //vectorSource.removeLoadedExtent(extent);
                        })
                },
                wrapX: false
            });
            let layerOptions={
                source: vectorSource,
                style: this.styleFunction,
                opacity: this.chartEntry.opacity!==undefined?parseFloat(this.chartEntry.opacity):1
            };
            if (this.chartEntry.minZoom !== undefined) layerOptions.minZoom=this.chartEntry.minZoom;
            if (this.chartEntry.maxZoom !== undefined) layerOptions.maxZoom=this.chartEntry.maxZoom;
            let vectorLayer = new olVectorLayer(layerOptions);
            resolve([vectorLayer]);
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
        let infoItems=['desc','name','sym','time','height','sym','link','linkText'];
        infoItems.forEach((item)=>rt[item]=feature.get(item));
        this.formatFeatureInfo(rt,feature,coordinates);
        for (let k in this.chartEntry){
            if (Helper.startsWith(k,stylePrefix)){
                rt[k]=this.chartEntry[k];
            }
        }
        return rt;
    }
}

export default  GpxChartSource;

/**
 * we will strip extensions from the gpx for now
 * as firefox is very strict with namespaces
 * and we potentially have some strange gpx files (e.g. nautin)
 * @param xml
 */
const stripExtensions=(gpx)=>{
    if (!gpx) return;
    return gpx.replace(/<extensions.*?>.*?<\/extensions.*?>/g,"")
}

/**
 * parses an gpx document and returns a couple of flags
 * to determine which kind of styling is necessary
 * @param gpx
 * @returns {*}
 *      hasSymbols
 *      hasLinks
 *      hasWaypoint
 *      hasRoute
 *      hasTrack
 *      styleXXX - XXX being the keys from styleParam
 *
 */
export const readFeatureInfoFromGpx=(gpx)=>{
    let parser=new olGPXFormat();
    let rt={
        styles:{}
    };
    let features=parser.readFeatures(stripExtensions(gpx));
    features.forEach((feature)=>{
        if (! feature) return;
        if (feature.get('sym')){
            rt.hasSymbols=true;
        }
        if (feature.get('link')){
            rt.hasLinks=true;
        }
        let geo=feature.getGeometry();
        if (geo instanceof olPoint) {
            rt.hasWaypoint = true;
            rt.hasAny=true;
        }
        else if (geo instanceof olLineString){
            rt.hasRoute=true;
            rt[stylePrefix+"lineColor"]=true;
            rt[stylePrefix + "lineWidth"] = true;
            rt.hasAny=true;
        }
        else if (geo instanceof olMultiLineString){
            rt.hasTrack=true;
            rt[stylePrefix+"lineColor"]=true;
            rt[stylePrefix + "lineWidth"] = true;
            rt.hasAny=true;
        }
    })
    rt.allowFormatter=true;
    return rt;

}
