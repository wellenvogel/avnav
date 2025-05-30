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

import ChartSourceBase, {
    addToSettings, buildOlFontConfig,
    editableOverlayParameters,
    FoundFeatureFlags,
    orderSettings, TEXT_FORMAT_SETTINGS
} from './chartsourcebase.js';
import {Style as olStyle, Stroke as olStroke, Circle as olCircle, Icon as olIcon, Fill as olFill, Text as olText} from 'ol/style';
import {Vector as olVectorSource} from 'ol/source';
import {Vector as olVectorLayer} from 'ol/layer';
import {Point as olPoint} from 'ol/geom';
import {GeoJSON as olGeoJSON} from 'ol/format';

const supportedStyleParameters= {
    lineWidth:editableOverlayParameters.lineWidth,
    lineColor: editableOverlayParameters.lineColor,
    fillColor: editableOverlayParameters.fillColor,
    strokeWidth: editableOverlayParameters.strokeWidth,
    strokeColor: editableOverlayParameters.strokeColor,
    circleWidth: editableOverlayParameters.circleWidth,
    showText: editableOverlayParameters.showText,
    textSize: editableOverlayParameters.textSize,
    textOffset: editableOverlayParameters.textOffset,
    textColor: editableOverlayParameters.textColor,
    defaultIcon: editableOverlayParameters.defaultIcon,
    icon: editableOverlayParameters.icon,
    featureFormatter: editableOverlayParameters.featureFormatter,
    minZoom: editableOverlayParameters.minZoom,
    maxZoom: editableOverlayParameters.maxZoom,
    minScale: editableOverlayParameters.minScale,
    maxScale: editableOverlayParameters.maxScale
}

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
        this.userIcons={};
        this.styleFunction=this.styleFunction.bind(this);
        this.styleParameters=this.buildStyleConfig(supportedStyleParameters);
        let image;
        if (this.styleParameters[supportedStyleParameters.defaultIcon]) {
            image=new olIcon({
                src: this.styleParameters[supportedStyleParameters.defaultIcon]
            })
        }
        else {
            image = new olCircle({
                radius: this.styleParameters[supportedStyleParameters.circleWidth]/2,
                fill: new olFill({
                    color: this.styleParameters[supportedStyleParameters.fillColor],
                }),
                stroke: new olStroke({
                    color: (this.styleParameters[supportedStyleParameters.strokeWidth]>0)?
                        this.styleParameters[supportedStyleParameters.strokeColor]:this.COLOR_INVISIBLE,
                    width: this.styleParameters[supportedStyleParameters.strokeWidth],
                })
            });
        }

        this.styles = {
            'Point': new olStyle({
                image: image
            }),
            'LineString': new olStyle({
                stroke: new olStroke({
                    color: this.styleParameters[supportedStyleParameters.lineColor],
                    width: this.styleParameters[supportedStyleParameters.lineWidth],
                }),
            }),
            'MultiLineString': new olStyle({
                stroke: new olStroke({
                    color: this.styleParameters[supportedStyleParameters.lineColor],
                    width: this.styleParameters[supportedStyleParameters.lineWidth],
                }),
            }),
            'MultiPoint': new olStyle({
                image: image,
            }),
            'MultiPolygon': new olStyle({
                stroke: new olStroke({
                    color: this.styleParameters[supportedStyleParameters.lineColor],
                    width: this.styleParameters[supportedStyleParameters.lineWidth],
                }),
                fill: new olFill({
                    color: this.styleParameters[supportedStyleParameters.fillColor],
                }),
            }),
            'Polygon': new olStyle({
                stroke: new olStroke({
                    color: this.styleParameters[supportedStyleParameters.lineColor],
                    width: this.styleParameters[supportedStyleParameters.lineWidth],
                }),
                fill: new olFill({
                    color: this.styleParameters[supportedStyleParameters.fillColor],
                }),
            }),
            'GeometryCollection': new olStyle({
                stroke: new olStroke({
                    color: this.styleParameters[supportedStyleParameters.lineColor],
                    width: this.styleParameters[supportedStyleParameters.lineWidth],
                }),
                fill: new olFill({
                    color: this.styleParameters[supportedStyleParameters.fillColor],
                }),
                image: image,
            }),
            'Circle': new olStyle({
                stroke: new olStroke({
                    color: this.styleParameters.lineColor,
                    width: this.styleParameters.lineWidth,
                }),
                fill: new olFill({
                    color: this.styleParameters.fillColor,
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
        let isCloned=false;
        let userInfo=this.formatFeatureInfo(this.styleParameters[supportedStyleParameters.featureFormatter],{name:feature.getProperties().name},feature,false);
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
        if (this.styleParameters[supportedStyleParameters.showText]){
            if (userInfo.name !== undefined){
                if (!isCloned){
                    rt=rt.clone();
                }
                rt.setText(new olText(
                    buildOlFontConfig(this.styleParameters, {
                        text: name,
                        textAlign: 'start',
                        offsetX: this.styleParameters[supportedStyleParameters.textOffset],
                        scale: this.getScale()
                    })
                ))
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
        this.formatFeatureInfo(this.styleParameters[supportedStyleParameters.featureFormatter], rt,feature,coordinates,true);
        if (rt.link){
            rt.link=this.getLinkUrl(rt.link);
        }
        return rt;
    }
    static analyzeOverlay(overlay){
        return readFeatureInfoFromGeoJson(overlay);
    }
}

export default  GeoJsonChartSource;



/**
 * parses an geajson document and returns a couple of flags
 * to determine which kind of styling is necessary
 * @param doc
 *
 */
const readFeatureInfoFromGeoJson=(doc)=>{
    let parser=new olGeoJSON();
    let features=parser.readFeatures(doc);
    let flags= FoundFeatureFlags.parseFoundFeatures(features,(feature)=>{
      //no dedicated actions
    })
    let settings=flags.createSettings();
    addToSettings(settings,supportedStyleParameters.featureFormatter)
    if (flags.hasNonSymbolPoint) addToSettings(settings,supportedStyleParameters.defaultIcon);
    //add a condition to the text format settings
    TEXT_FORMAT_SETTINGS.forEach((setting)=>{
        addToSettings(settings,setting.clone({
            condition:{[editableOverlayParameters.showText]:true}
        }),true);
    })
    return {
        hasAny: flags.hasAny,
        settings: orderSettings(settings,supportedStyleParameters)
    }
}
