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
import {Style as olStyle, Stroke as olStroke, Circle as olCircle, Icon as olIcon, Fill as olFill, Text as olText} from 'ol/style';
import {Vector as olVectorSource} from 'ol/source';
import {Vector as olVectorLayer} from 'ol/layer';
import {LineString as olLineString, MultiLineString as olMultiLineString, Point as olPoint} from 'ol/geom';
import {GeoJSON as olGeoJSON} from 'ol/format';
import Helper from "../util/helper";
import {stylePrefix} from "./gpxchartsource";
import assign from "object-assign";

//TODO: check against style param from chartsourcebase
let styleParam={
    lineWidth:3,
    lineColor: '#000000',
    fillColor: 'rgba(255,255,0,0.4)',
    strokeWidth: 3,
    circleWidth: 10,
    showName: false,
    textSize: 16,
    textOffset: 32
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
        this.userIcons={};
        this.styleFunction=this.styleFunction.bind(this);
        let ourStyleParam=assign({},styleParam);
        for (let k in ourStyleParam) {
            if (chartEntry[stylePrefix + k] !== undefined) {
                ourStyleParam[k] = chartEntry[stylePrefix + k];
            }
        }
        let image;
        if (this.chartEntry.defaultIcon) {
            image=new olIcon({
                src: this.chartEntry.defaultIcon
            })
        }
        else {
            image = new olCircle({
                radius: ourStyleParam.circleWidth/2,
                fill: new olFill({
                    color: ourStyleParam.fillColor,
                })
            });
        }

        this.styles = {
            'Point': new olStyle({
                image: image
            }),
            'LineString': new olStyle({
                stroke: new olStroke({
                    color: ourStyleParam.lineColor,
                    width: ourStyleParam.lineWidth,
                }),
            }),
            'MultiLineString': new olStyle({
                stroke: new olStroke({
                    color: ourStyleParam.lineColor,
                    width: ourStyleParam.lineWidth,
                }),
            }),
            'MultiPoint': new olStyle({
                image: image,
            }),
            'MultiPolygon': new olStyle({
                stroke: new olStroke({
                    color: ourStyleParam.lineColor,
                    width: ourStyleParam.lineWidth,
                }),
                fill: new olFill({
                    color: ourStyleParam.fillColor,
                }),
            }),
            'Polygon': new olStyle({
                stroke: new olStroke({
                    color: ourStyleParam.lineColor,
                    width: ourStyleParam.lineWidth,
                }),
                fill: new olFill({
                    color: ourStyleParam.fillColor,
                }),
            }),
            'GeometryCollection': new olStyle({
                stroke: new olStroke({
                    color: ourStyleParam.lineColor,
                    width: ourStyleParam.lineWidth,
                }),
                fill: new olFill({
                    color: ourStyleParam.fillColor,
                }),
                image: image,
            }),
            'Circle': new olStyle({
                stroke: new olStroke({
                    color: ourStyleParam.lineColor,
                    width: ourStyleParam.lineWidth,
                }),
                fill: new olFill({
                    color: ourStyleParam.fillColor,
                }),
            }),
        };
        this.source=undefined;

    }

    redraw() {
        if (this.source){
            this.source.clear();
            this.source.refresh();
            return true;
        }
    }
    setIconScale(style,resolution){
        let img=style.getImage();
        if (!img)return;
        img.setScale(this.getScale());
    }
    styleFunction(feature,resolution) {
        let type=feature.getGeometry().getType();
        let rt= this.styles[type];
        let userInfo={};
        let isCloned=false;
        let name;
        if (this.featureFormatter){
            userInfo=this.formatFeatureInfo({},feature,false);
            if (userInfo.sym){
                let icon=this.userIcons(userInfo.sym);
                if (! icon){
                    icon=new olIcon({src:userInfo.sym});
                    this.userIcons[userInfo.sym]=icon;
                }
                rt=rt.clone();
                isCloned=true;
                rt.setImage(icon);
            }
            name=userInfo.name;
        }
        else{
            name=feature.getProperties().name;
        }
        if (this.chartEntry['style.showName']){
            if (name !== undefined){
                if (!isCloned){
                    rt=rt.clone();
                }
                rt.setText(new olText({
                    text:name,
                    textAlign:'start',
                    font: this.chartEntry['style.textSize']||styleParam.textSize+"px",
                    offsetX: this.chartEntry['style.textOffset']||styleParam.textOffset
                }))
            }
        }
        this.setIconScale(rt);
        feature.setStyle((feature,res)=>{
            this.setIconScale(rt);
            return rt;
        });
        return rt;
    }
    prepareInternal() {
        let url = this.chartEntry.url;
        let self = this;
        return new Promise((resolve, reject)=> {
            if (!url) {
                reject("no url for "+this.chartEntry.name);
                return;
            }
            this.source = new olVectorSource({
                format: new olGeoJSON(),
                url: url,
                wrapX: false
            });
            let layerOptions={
                source: this.source,
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
            rt.nextTarget=this.mapholder.fromMapToPoint(geometry.getCoordinates());
        }
        else{
            if (geometry){
                coordinates=this.mapholder.fromMapToPoint(geometry.getClosestPoint(this.mapholder.pixelToCoord(pixel)));
                rt.nextTarget=coordinates;
            }
            else {
                coordinates = this.mapholder.fromMapToPoint(this.mapholder.pixelToCoord(pixel));
            }
        }
        let param=['desc','name','sym','link','linkText'];
        param.forEach((p)=>rt[p]=feature.get(p));
        for (let k in this.chartEntry){
            if (Helper.startsWith(k,stylePrefix)){
                rt[k]=this.chartEntry[k];
            }
        }
        this.formatFeatureInfo(rt,feature,coordinates,true);
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
