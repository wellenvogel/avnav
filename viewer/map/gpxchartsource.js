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
    addToSettings, buildOlFontConfig, editableOverlayParameters, FoundFeatureFlags, orderSettings, TEXT_FORMAT_SETTINGS
} from './chartsourcebase.js';
import {Style as olStyle, Stroke as olStroke, Circle as olCircle, Icon as olIcon, Fill as olFill, Text as olText} from 'ol/style';
import {Vector as olVectorSource} from 'ol/source';
import {Vector as olVectorLayer} from 'ol/layer';
import {LineString as olLineString, MultiLineString as olMultiLineString, Point as olPoint} from 'ol/geom';
import {Feature as olFeature} from 'ol';
import {GPX as olGPXFormat} from 'ol/format';
import globalstore from "../util/globalstore";
import keys from "../util/keys";
import navobjects from "../nav/navobjects";
import NavCompute from "../nav/navcompute";
import {getRouteStyles} from "./routelayer";
import routeobjects from "../nav/routeobjects";
import {getClosestRoutePoint} from "../nav/routeeditor";
import Mapholder from "./mapholder";

export const stylePrefix="style."; // the prefix for style attributes


class OwnGpx extends olGPXFormat{
    constructor(mapholder) {
        super();
        this.mapholder=mapholder;
    }

    readFeaturesFromNode(node, opt_options) {
        let routes=node.ownerDocument.getElementsByTagName('rte');
        let rt=[];
        for (let i=0;i<routes.length;i++){
            let rtel=routes[i];
            rtel.parentNode.removeChild(rtel);
            let route=new routeobjects.Route();
            route.fromXmlNode(rtel);
            if (route.name !== undefined || route.points.length > 0){
                let coordinates=[];
                route.points.forEach((pt)=>{
                    coordinates.push(this.mapholder.transformToMap([pt.lon,pt.lat]));
                })
                let feature=new olFeature();
                feature.setGeometry(new olLineString(coordinates));
                feature.set('name',route.name);
                feature.set('route',route);
                rt.push(feature);
            }
        }
        let of=super.readFeaturesFromNode(node, opt_options);
        return rt.concat(of);
    }
}

const getRoutePointName=(feature,idx)=>{
    if (!feature) return;
    const route=feature.get('route');
    if (! route || ! route.points) return;
    return route.points[idx].name;
}

const getSupportedStyleParameters=(isRoute)=>{
    return [
        editableOverlayParameters.lineWidth.clone({default:globalstore.getData(isRoute?keys.properties.routeWidth:keys.properties.trackWidth)}),
        editableOverlayParameters.lineColor.clone({efault:globalstore.getData(isRoute?keys.properties.routeColor:keys.properties.trackColor)}),
        editableOverlayParameters.fillColor.clone({default:isRoute?globalstore.getData(keys.properties.routeColor):'rgba(255,255,0,0.4)'}),
        editableOverlayParameters.strokeWidth.clone({default:0}),
        editableOverlayParameters.strokeColor.clone({default:globalstore.getData(isRoute?keys.properties.routeColor:keys.properties.trackColor) }),
        editableOverlayParameters.circleWidth.clone({default:globalstore.getData(keys.properties.routeWpSize) }),
        editableOverlayParameters.showText.clone({default:isRoute}),
        editableOverlayParameters.textSize.clone({default:globalstore.getData(keys.properties.routingTextSize)}),
        editableOverlayParameters.textColor,
        editableOverlayParameters.textOffset,
        editableOverlayParameters.featureFormatter,
        editableOverlayParameters.minZoom,
        editableOverlayParameters.maxZoom,
        editableOverlayParameters.minScale,
        editableOverlayParameters.maxScale,
        editableOverlayParameters.icon,
        editableOverlayParameters.defaultIcon
    ]
}

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
        this.styles={};

        this.source=undefined;
        this.isRoute=false;
        globalstore.register(()=>{
            if (this.isRoute){
                this.redraw();
            }
        },[keys.nav.routeHandler.useRhumbLine])
        this.routePoints=[];
    }

    redraw() {
        if (this.source) {
            this.source.clear();
            this.source.refresh();
            return true;
        }
    }
    buildStyles(){
        const supportedStyles=getSupportedStyleParameters(this.isRoute); //get the defaults
        this.styleParameters=this.buildStyleConfig(supportedStyles);
        const textStyle= new olText(
            buildOlFontConfig(this.styleParameters,{
                declutterMode: 'declutter',
                offsetY: this.styleParameters[editableOverlayParameters.textOffset],
                scale: this.getScale()
            })
        )
        this.styles = {
            Point: new olStyle({
                image: new olCircle({
                    fill: new olFill({
                        color: this.styleParameters[editableOverlayParameters.fillColor],
                    }),
                    radius: this.styleParameters[editableOverlayParameters.circleWidth]/2,
                    stroke: new olStroke({
                        color: (this.styleParameters[editableOverlayParameters.strokeWidth]>0)?
                            this.styleParameters[editableOverlayParameters.strokeColor]:this.COLOR_INVISIBLE,
                        width: this.styleParameters[editableOverlayParameters.strokeWidth],
                    })
                })
            }),
            LineString: new olStyle({
                stroke: new olStroke({
                    color: (this.styleParameters[editableOverlayParameters.lineWidth]>0)?
                        this.styleParameters[editableOverlayParameters.lineColor]:this.COLOR_INVISIBLE,
                    width: this.styleParameters[editableOverlayParameters.lineWidth],
                })
            }),
            MultiLineString: new olStyle({
                stroke: new olStroke({
                    color: (this.styleParameters[editableOverlayParameters.lineWidth]>0)?this.styleParameters[editableOverlayParameters.lineColor]:this.COLOR_INVISIBLE,
                    width: this.styleParameters[editableOverlayParameters.lineWidth],
                })
            }),
            RoutePoint: new olStyle({
                image: new olCircle({
                    fill: new olFill({
                        color: this.styleParameters[editableOverlayParameters.fillColor],
                    }),
                    radius: this.styleParameters[editableOverlayParameters.circleWidth] / 2,
                }),
                text: this.styleParameters[editableOverlayParameters.showText]?textStyle:undefined
            })
        };
    }
    styleFunction(feature,resolution) {

        let type=feature.getGeometry().getType();
        if (type === 'Point'){
            let rt=this.styles[type];
            if(this.styleParameters[editableOverlayParameters.icon]||this.styleParameters[editableOverlayParameters.defaultIcon]) {
                let sym = feature.get('sym');
                if (!sym && this.styleParameters[editableOverlayParameters.defaultIcon]) {
                    sym = "defaultIcon"; //arbitrary name that is neither an external or absolute URL
                }
                if (sym) {
                    if (!this.styleMap[sym]) {
                        rt = rt.clone();
                        rt.setImage(
                                new olIcon({
                                    src: this.getSymbolUrl(sym, '.png')
                                })
                        );
                        this.styleMap[sym] = rt;
                    }
                    else{
                        rt=this.styleMap[sym];
                    }
                }
            }
            const scale=this.getScale();
            const image=rt.getImage();
            if (image) image.setScale(scale);
            const textStyle=rt.getText();
            if (textStyle) textStyle.setScale(scale);
            return rt;
        }
        if (type === 'LineString'){
            //route
            let geometry=feature.getGeometry();
            let styles=[this.styles[type]];
            let isFirst=true;
            let ptIdx=0;
            geometry.forEachSegment((start,end)=>{
                if (isFirst){
                    styles.push(this.getRoutePointStyle(start,getRoutePointName(feature,ptIdx)));
                    isFirst=false;
                    ptIdx++;
                }
                styles.push(this.getRoutePointStyle(end,getRoutePointName(feature,ptIdx)));
                ptIdx++;
            })
            return styles;
        }
        if (type === 'MultiLineString'){
            //route
            let geometry=feature.getGeometry();
            let styles=[this.styles[type]];
            let isFirst=true;
            let lineStrings=geometry.getLineStrings();
            let ptIdx=0;
            lineStrings.forEach((lineString)=>{
                let coordinates=lineString.getCoordinates();
                if (coordinates.length > 1) {
                    if (isFirst) {
                        styles.push(this.getRoutePointStyle(coordinates[0],getRoutePointName(feature,ptIdx)));
                        isFirst = false;
                        ptIdx++;
                    }
                    styles.push(this.getRoutePointStyle(coordinates[coordinates.length-1],getRoutePointName(feature,ptIdx)));
                    ptIdx++;
                }
            })
            return styles;
        }
        return this.styles[feature.getGeometry().getType()];
    };
    getRoutePointStyle(coordinates,name){
        const base=this.styles.RoutePoint;
        let rt= new olStyle({
            geometry: new olPoint(coordinates),
            image: new olCircle({
                fill: base.getImage().getFill(),
                radius: base.getImage().getRadius(),
                scale: this.getScale()
            }),
            text: (base.getText())?base.getText().clone():undefined
        });
        const textStyle=rt.getText();
        if (textStyle) textStyle.setScale(this.getScale());
        if (name && textStyle) textStyle.setText(name);
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
                format: new OwnGpx(this.mapholder),
                loader: (extent, resolution, projection) => {
                    Requests.getHtmlOrText(url, {}, {'_': (new Date()).getTime()})
                        .then((gpx) => {
                            gpx = stripExtensions(gpx);
                            let features = this.source.getFormat().readFeatures(gpx, {
                                extent: extent,
                                featureProjection: projection,
                            });
                            if (features) {
                                features.forEach((feature) => {
                                    let geometry = feature.getGeometry();
                                    if (geometry instanceof olLineString) {
                                        this.isRoute = 1;
                                        //this is a route
                                        let coordinates = geometry.getCoordinates();
                                        if (coordinates.length > 1 && !globalstore.getData(keys.nav.routeHandler.useRhumbLine)) {
                                            let newGeometry = new olMultiLineString([]);
                                            let start = new navobjects.Point();
                                            start.fromCoord(this.mapholder.transformFromMap(coordinates[0]));
                                            let end = new navobjects.Point();
                                            for (let i = 1; i < coordinates.length; i++) {
                                                let newCoordinates = [];
                                                end.fromCoord(this.mapholder.transformFromMap(coordinates[i]));
                                                let points = NavCompute.computeCoursePoints(start, end, 3);
                                                points.forEach((point) => {
                                                    newCoordinates.push(this.mapholder.transformToMap([point.lon, point.lat]));
                                                })
                                                start.lat = end.lat;
                                                start.lon = end.lon;
                                                newGeometry.appendLineString(new olLineString(newCoordinates));
                                            }
                                            feature.setGeometry(newGeometry);
                                        }
                                    }
                                })
                            }

                            this.source.addFeatures(
                                features
                            );
                        })
                        .catch((error) => {
                            //vectorSource.removeLoadedExtent(extent);
                        })
                },
                wrapX: false
            });
            this.buildStyles();
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
            coordinates=this.mapholder.fromMapToPoint(geometry.getCoordinates());
            rt.nextTarget=coordinates;
            const fn=feature.get('name');
            if (fn !== undefined) rt.nextTarget.name=fn;
        }
        else{
            if (geometry){
                coordinates=this.mapholder.fromMapToPoint(geometry.getClosestPoint(this.mapholder.pixelToCoord(pixel)));
                if (this.isRoute){
                    const route=feature.get('route');
                    if (route){
                        rt.routeName=route.name;
                        const routePoint=getClosestRoutePoint(route,coordinates);
                        if (routePoint) coordinates=routePoint;
                    }
                }
                rt.nextTarget=coordinates;
            }
            else {
                coordinates = this.mapholder.fromMapToPoint(this.mapholder.pixelToCoord(pixel));
            }
        }
        let infoItems=['desc','name','sym','time','height','link','linkText'];
        infoItems.forEach((item)=>rt[item]=feature.get(item));
        this.formatFeatureInfo(this.styleParameters[editableOverlayParameters.featureFormatter], rt,feature,coordinates,true);
        return rt;
    }

    static analyzeOverlay(overlay){
        return readFeatureInfoFromGpx(overlay)
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
 *
 */
export const readFeatureInfoFromGpx=(gpx)=>{
    let parser=new OwnGpx(Mapholder);
    let features=parser.readFeatures(stripExtensions(gpx));
    const featureFlags=FoundFeatureFlags.parseFoundFeatures(features,(feature,rt)=>{
        if (feature.get('route')) {
            rt.hasRoute=true;
            rt.hasText=true;
            rt.hasNonSymbolPoint=true;
        }
    });
    let settings=featureFlags.createSettings();
    addToSettings(settings,editableOverlayParameters.featureFormatter)
    addToSettings(settings,getSupportedStyleParameters(featureFlags.hasRoute),true);
    TEXT_FORMAT_SETTINGS.forEach((setting)=>{
        addToSettings(settings,setting.clone({
            condition:{[editableOverlayParameters.showText]:true}
        }),true);
    })
    return {
        hasAny: featureFlags.hasAny,
        settings: orderSettings(settings,getSupportedStyleParameters(featureFlags.isRoute))
    }

}
