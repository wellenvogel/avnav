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
import ChartSourceBase, {
    addToSettings, buildOlFontConfig,
    editableOverlayParameters,
    FoundFeatureFlags, LINE_SETTINGS,
    orderSettings, TEXT_FORMAT_SETTINGS
} from './chartsourcebase.js';
import {Circle as olCircle, Icon as olIcon, Fill as olFill, Text as olText, Stroke as olStroke} from 'ol/style';
import {Vector as olVectorSource} from 'ol/source';
import {Vector as olVectorLayer} from 'ol/layer';
import {Point as olPoint} from 'ol/geom';
import {KML as olKMLFormat} from 'ol/format';
import base from "../base";
import {FeatureInfo, OverlayFeatureInfo} from "./featureInfo";

const supportedStyleParameters= {
    lineWidth:editableOverlayParameters.lineWidth,
    lineColor: editableOverlayParameters.lineColor,
    fillColor: editableOverlayParameters.fillColor,
    strokeWidth: editableOverlayParameters.strokeWidth,
    circleWidth: editableOverlayParameters.circleWidth,
    showText: editableOverlayParameters.showText,
    textSize: editableOverlayParameters.textSize,
    textOffset: editableOverlayParameters.textOffset,
    textColor: editableOverlayParameters.textColor,
    overwriteTextStyle: editableOverlayParameters.overwriteTextStyle,
    overwriteLineStyle: editableOverlayParameters.overwriteLineStyle,
    defaultIcon: editableOverlayParameters.defaultIcon,
    icon: editableOverlayParameters.icon,
    featureFormatter: editableOverlayParameters.featureFormatter,
    allowOnline: editableOverlayParameters.allowOnline,
    minZoom: editableOverlayParameters.minZoom,
    maxZoom: editableOverlayParameters.maxZoom,
    minScale: editableOverlayParameters.minScale,
    maxScale: editableOverlayParameters.maxScale,
    allowHtml: editableOverlayParameters.allowHtml
}

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
        this.source=undefined;
        this.styleParameters=this.buildStyleConfig(supportedStyleParameters);

    }
    redraw() {
        if (this.source){
            this.source.clear();
            this.source.refresh();
            return true;
        }
    }
    setImageStyle(style){
        try {
            let imageStyle=style.getImage();
            let currentUrl=imageStyle.getSrc();
            if (currentUrl.startsWith(this.styleParameters[supportedStyleParameters.icon]) || currentUrl.startsWith(this.chartEntry.defaultIcon)){
                imageStyle.setScale(this.getScale());
                return style;
            }
            let url;
            let ourBase=window.location.href.replace(/\/[^/]*$/,'');
            if (currentUrl.startsWith(ourBase)){
                currentUrl=currentUrl.substr(ourBase.length);
                if (currentUrl.startsWith("/")) currentUrl=currentUrl.substr(1);
            }
            if (currentUrl.startsWith("http")){
                if (this.styleParameters[supportedStyleParameters.allowOnline]){
                    imageStyle.setScale(this.getScale());
                    return style;
                }
                url=this.styleParameters[supportedStyleParameters.defaultIcon];
            }
            else{
                if (this.styleParameters[supportedStyleParameters.icon]){
                    url=this.styleParameters[supportedStyleParameters.icon]+"/"+currentUrl+"?fallback="+encodeURIComponent(this.styleParameters[supportedStyleParameters.defaultIcon]);
                }
                else{
                    url=this.styleParameters[supportedStyleParameters.defaultIcon];
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
                            color: this.styleParameters[supportedStyleParameters.fillColor],
                        }),
                        radius: (this.styleParameters[supportedStyleParameters.circleWidth])/2,
                    })
                );
            }
            style.getImage().setScale(this.getScale());
        }catch (e){base.log("exception in kml style: "+e.message);}
    }
    setTextStyle(style){
        try{
            const textStyle=style.getText();
            if (textStyle) {
                if (!this.styleParameters[supportedStyleParameters.showText]) {
                    style.setText(undefined);
                } else if (this.styleParameters[supportedStyleParameters.overwriteTextStyle]) {
                    const text = textStyle.getText();
                    if (text) {
                        style.setText(new olText(
                            buildOlFontConfig(this.styleParameters, {
                                text: text,
                                offsetX: this.styleParameters[supportedStyleParameters.textOffset],
                                scale: this.getScale()
                            })))
                    }
                }
            }
        }catch(e){base.log("exception in kml style "+e.message)}
    }
    setLineStyle(style){
        if (! this.styleParameters[supportedStyleParameters.overwriteLineStyle]) return style;
        style.setStroke(new olStroke({
            color: (this.styleParameters[supportedStyleParameters.lineWidth]>0)?
                this.styleParameters[supportedStyleParameters.lineColor]:this.COLOR_INVISIBLE,
            width: this.styleParameters[supportedStyleParameters.lineWidth],
        }))
        return style;
    }
    replacePointStyle(feature,style){
        let type=feature.getGeometry().getType();
        if (type === 'Point'){
            this.setImageStyle(style);
            this.setTextStyle(style);
        }
        else{
            this.setTextStyle(style);
            if (type === 'LineString' || type === 'MultiLineString'){
                this.setLineStyle(style);
            }
        }
        return style;
    }
    prepareInternal() {
        let url = this.chartEntry.url;
        return new Promise((resolve, reject)=> {
            if (!url) {
                reject("no url for "+this.chartEntry.name);
                return;
            }
            this.source = new olVectorSource({
                format: new olKMLFormat({
                    showPointNames: this.styleParameters[supportedStyleParameters.showText],
                }),
                wrapX: false,
                loader: (extent,resolution,projection)=>{
                    Requests.getHtmlOrText(url,{},{'_':(new Date()).getTime()})
                        .then((kml)=>{
                            let features=this.source.getFormat().readFeatures(kml,{
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
                                        const rs=this.replacePointStyle(feature,style);
                                        return rs;
                                    }
                                    feature.setStyle(newSf);
                                }
                            })
                            this.source.addFeatures(features);
                        })
                        .catch((error)=>{
                            //vectorSource.removeLoadedExtent(extent);
                        })
                },
            });
            let layerOptions={
                source: this.source,
                opacity: this.chartEntry.opacity!==undefined?parseFloat(this.chartEntry.opacity):1
            };
            if (this.chartEntry.minZoom !== undefined) layerOptions.minZoom=this.chartEntry.minZoom;
            if (this.chartEntry.maxZoom !== undefined) layerOptions.maxZoom=this.chartEntry.maxZoom;
            let vectorLayer = new olVectorLayer(layerOptions);
            resolve([vectorLayer]);
        });
    }
    featureToInfo(feature,pixel){
        let rt=new OverlayFeatureInfo({
            title:this.getName(),
            urlOrKey: this.getUrl(),
            overlaySource: this
        });
        if (! feature) {
            return rt;
        }

        let geometry=feature.getGeometry();
        if (geometry instanceof olPoint){
            rt.point=this.mapholder.fromMapToPoint(geometry.getCoordinates());
        }
        else{
            if (geometry){
                rt.point=this.mapholder.fromMapToPoint(geometry.getClosestPoint(this.mapholder.pixelToCoord(pixel)));
            }
            else {
                rt.point = this.mapholder.fromMapToPoint(this.mapholder.pixelToCoord(pixel));
            }
        }
        const userInfo={};
        userInfo.desc=feature.get('desc')||feature.get('description');
        if (userInfo.desc){
            if (userInfo.desc.indexOf("<") >= 0){
                if(this.styleParameters[supportedStyleParameters.allowHtml]) {
                    userInfo.htmlInfo = userInfo.desc.replace(/src *= *"([^"]*)"/g,(match,url)=>{
                        if (url.startsWith('http')){
                            if (!this.styleParameters[supportedStyleParameters.allowOnline]) return 'src=""';
                            return match;
                        }
                        return 'src="'+(this.styleParameters[supportedStyleParameters.icons]+"/"+url).replace('"','\\"')+'" ';
                    });
                    userInfo.desc=undefined;
                }
            }
        }
        userInfo.name=feature.get('name');
        userInfo.sym=feature.get('sym');
        this.formatFeatureInfo(this.styleParameters[supportedStyleParameters.featureFormatter],userInfo,feature,rt.point,true);
        rt.userInfo=userInfo;
        return rt;
    }
    static analyzeOverlay(overlay){
        return readFeatureInfoFromKml(overlay);
    }
}

export default  KmlChartSource;

/**
 * parses an gpx document and returns a couple of flags
 * to determine which kind of styling is necessary
 * @param kml
 *
 */
export const readFeatureInfoFromKml=(kml)=>{
    let parser=new olKMLFormat();
    let features=parser.readFeatures(kml);
    let flags=FoundFeatureFlags.parseFoundFeatures(features);
    let settings=flags.createSettings();
    if (flags.hasNonSymbolPoint) addToSettings(settings,supportedStyleParameters.defaultIcon);
    addToSettings(settings,[
        supportedStyleParameters.featureFormatter,
        supportedStyleParameters.allowOnline,
        supportedStyleParameters.icon
    ])
    if (flags.hasText) {
        addToSettings(settings,supportedStyleParameters.overwriteTextStyle.clone({
            condition: {[editableOverlayParameters.showText]:true}
        }));
        TEXT_FORMAT_SETTINGS.forEach((setting)=>{
            addToSettings(settings,setting.clone({
                condition:{
                    [editableOverlayParameters.overwriteTextStyle]:true,
                    [editableOverlayParameters.showText]:true
                }
            }),true);
        })
    }
    if (flags.hasText){
        addToSettings(settings,supportedStyleParameters.overwriteLineStyle);
        LINE_SETTINGS.forEach((setting)=>{
            addToSettings(settings,setting.clone({
                condition:{[supportedStyleParameters.overwriteLineStyle]:true}
            }),true);
        })
    }
    else{
        LINE_SETTINGS.forEach((setting)=>{
            delete settings[setting.name];
        })
    }
    return {
        hasAny: flags.hasAny,
        settings: orderSettings(settings,supportedStyleParameters)
    }

}
