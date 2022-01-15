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

import ChartSourceBase from './chartsourcebase.js';
import {Style as olStyle, Stroke as olStroke, Circle as olCircle, Icon as olIcon, Fill as olFill} from 'ol/style';
import {Vector as olVectorSource} from 'ol/source';
import {Vector as olVectorLayer} from 'ol/layer';
import {LineString as olLineString, MultiLineString as olMultiLineString, Point as olPoint} from 'ol/geom';
import {GeoJSON as olGeoJSON} from 'ol/format';
import Helper from "../util/helper";
import {stylePrefix} from "./gpxchartsource";

let styleParam={
    lineWidth:3,
    lineColor: '#000000',
    fillColor: 'rgba(255,255,0,0.4)',
    strokeWidth: 3,
    circleWidth: 10

};
class GeoJsonChartSource extends ChartSourceBase{
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
            'Point': new olStyle({
                image: image,
            }),
            'LineString': new olStyle({
                stroke: new olStroke({
                    color: styleParam.lineColor,
                    width: styleParam.lineWidth,
                }),
            }),
            'MultiLineString': new olStyle({
                stroke: new olStroke({
                    color: styleParam.lineColor,
                    width: styleParam.lineWidth,
                }),
            }),
            'MultiPoint': new olStyle({
                image: image,
            }),
            'MultiPolygon': new olStyle({
                stroke: new olStroke({
                    color: styleParam.lineColor,
                    width: styleParam.lineWidth,
                }),
                fill: new olFill({
                    color: styleParam.fillColor,
                }),
            }),
            'Polygon': new olStyle({
                stroke: new olStroke({
                    color: styleParam.lineColor,
                    width: styleParam.lineWidth,
                }),
                fill: new olFill({
                    color: styleParam.fillColor,
                }),
            }),
            'GeometryCollection': new olStyle({
                stroke: new olStroke({
                    color: styleParam.lineColor,
                    width: styleParam.lineWidth,
                }),
                fill: new olFill({
                    color: styleParam.fillColor,
                }),
                image: image,
            }),
            'Circle': new olStyle({
                stroke: new olStroke({
                    color: styleParam.lineColor,
                    width: styleParam.lineWidth,
                }),
                fill: new olFill({
                    color: styleParam.fillColor,
                }),
            }),
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
            let vectorSource = new olVectorSource({
                format: new olGeoJSON(),
                url: url,
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

export default  GeoJsonChartSource;



/**
 * parses an geajson document and returns a couple of flags
 * to determine which kind of styling is necessary
 * @param doc
 * @returns {*}
 *      hasSymbols
 *      hasLinks
 *      hasWaypoint
 *      hasRoute
 *      hasTrack
 *      styleXXX - XXX being the keys from styleParam
 *
 */
export const readFeatureInfoFromGeoJson=(doc)=>{
    let parser=new olGeoJSON();
    let rt={
        styles:{}
    };
    let features=parser.readFeatures(doc);
    features.forEach((feature)=>{
        if (! feature) return;
        if (feature.get('sym')){
            rt.hasSymbols=true;
        }
        if (feature.get('link')){
            rt.hasLinks=true;
        }
        let geo=feature.getGeometry();
        if (geo){
            rt.hasAny=true;
        }
        if (geo instanceof olPoint ) {
            rt.hasWaypoint = true;
        }
        for (let k in styleParam) {
            rt[stylePrefix + k] =true;
        }
    })
    rt.allowFormatter=true;
    return rt;

}
