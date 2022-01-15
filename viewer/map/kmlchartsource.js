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
import {KML as olKMLFormat} from 'ol/format';
import base from "../base";
import {stylePrefix} from './gpxchartsource';


class KmlChartSource extends ChartSourceBase{
    /**
     *
     * @param mapholer
     * @param chartEntry
     *        properties: url - the url of the gpx
     *                    icons - the base url for icons (if points have an icon url)
     *                    defaultIcon - the url for an icon if sym not found (opt)
     *                    minZoom - minimal zoom (opt)
     *                    maxZoom - maximal zoom (opt)
     *                    minScale - min zoom, lower zoom decrease symbol size (opt)
     *                    maxScale - max zoom, higher zooms increase symbol size (opt)
     *                    allowOnline - allow image icons that are embedded (online...)
     *                    showText  - show text at points
     *                    opacity - 0...1 (opt)
     */
    constructor(mapholer, chartEntry) {
        super(mapholer,chartEntry);
        this.styleMap=[];

    }
    replacePointStyle(feature,style){
        let type=feature.getGeometry().getType();
        if (type === 'Point'){
            try {
                let currentUrl=style.getImage().getSrc();
                if (currentUrl.startsWith(this.chartEntry.icons) || currentUrl.startsWith(this.chartEntry.defaultIcon)){
                    return style;
                }
                let url;
                let ourBase=window.location.href.replace(/\/[^/]*$/,'');
                if (currentUrl.startsWith(ourBase)){
                    currentUrl=currentUrl.substr(ourBase.length);
                    if (currentUrl.startsWith("/")) currentUrl=currentUrl.substr(1);
                }
                if (currentUrl.startsWith("http")){
                    if (this.chartEntry.allowOnline){
                        return style;
                    }
                    url=this.chartEntry.defaultIcon;
                }
                else{
                    if (this.chartEntry.icons){
                        url=this.chartEntry.icons+"/"+currentUrl+"?fallback="+encodeURIComponent(this.chartEntry.defaultIcon);
                    }
                    else{
                        url=this.chartEntry.defaultIcon;
                    }
                }
                if (url) {
                    style.setImage(
                        new olIcon({
                                src: url
                            }
                        )
                    )
                }
                else{
                    style.setImage(
                        new olCircle({
                            fill: new olFill({
                                color: this.chartEntry[stylePrefix+'fillColor']||'#000000',
                            }),
                            radius: (this.chartEntry[stylePrefix+'circleWidth']||10)/2,
                        })
                    );
                }
            }catch (e){base.log("exception in kml style: "+e.message);}
        }
        return style;
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
                format: new olKMLFormat({
                    showPointNames: this.chartEntry.showText||false,
                }),
                wrapX: false,
                loader: (extent,resolution,projection)=>{
                    Requests.getHtmlOrText(url,{},{'_':(new Date()).getTime()})
                        .then((kml)=>{
                            let features=vectorSource.getFormat().readFeatures(kml,{
                                extent: extent,
                                featureProjection: projection,
                            });
                            features.forEach((feature)=>{
                                let oldSf=feature.getStyleFunction();
                                if (typeof oldSf === 'function'){
                                    let newSf=(sfeature,resolution)=>{
                                        let style=oldSf(sfeature,resolution);
                                        if (style instanceof Array){
                                            let rt=[];
                                            style.forEach((styleElement)=>{
                                                rt.push(this.replacePointStyle(feature,styleElement));
                                            })
                                            return rt;
                                        }
                                        return this.replacePointStyle(feature,style);
                                    }
                                    feature.setStyle(newSf);
                                }
                            })
                            vectorSource.addFeatures(features);
                        })
                        .catch((error)=>{
                            //vectorSource.removeLoadedExtent(extent);
                        })
                },
            });
            let layerOptions={
                source: vectorSource,
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
        rt.desc=feature.get('desc')||feature.get('description');
        if (rt.desc){
            if (rt.desc.indexOf("<") >= 0){
                if(this.chartEntry.allowHtml) {
                    rt.htmlInfo = rt.desc.replace(/src *= *"([^"]*)"/g,(match,url)=>{
                        if (url.startsWith('http')){
                            if (!this.chartEntry.allowOnline) return 'src=""';
                            return match;
                        }
                        return 'src="'+(this.chartEntry.icons+"/"+url).replace('"','\\"')+'" ';
                    });
                    rt.desc=undefined;
                }
            }
        }
        rt.name=feature.get('name');
        rt.sym=feature.get('sym');
        this.formatFeatureInfo(rt,feature,coordinates);
        return rt;
    }
}

export default  KmlChartSource;

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
export const readFeatureInfoFromKml=(kml)=>{
    let parser=new olKMLFormat();
    let rt={
        styles:{}
    };
    let features=parser.readFeatures(kml);
    features.forEach((feature)=>{
        if (! feature) return;
        let geo=feature.getGeometry();
        if (geo instanceof olPoint) {
            rt.hasWaypoint = true;
            rt.hasAny=true;
        }
        else if (geo instanceof olLineString){
            rt.hasTrack=true;
            rt.hasAny=true;
        }
        else if (geo instanceof olMultiLineString){
            rt.hasTrack=true;
            rt.hasAny=true;
        }
        let desc=feature.get('desc')||feature.get('description');
        if (desc && desc.indexOf("<")>=0){
            rt.allowHtml=true;
        }
    })
    rt[stylePrefix+'fillColor']=true;
    rt[stylePrefix+'circleWidth']=true;
    rt.allowOnline=true;
    rt.showText=true;
    rt.allowFormatter=true;
    return rt;

}
