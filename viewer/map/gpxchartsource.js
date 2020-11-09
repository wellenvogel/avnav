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

import Promise from 'promise';
import base from '../base.js';
import Requests from '../util/requests.js';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import Helper from '../util/helper.js';
import CryptHandler from './crypthandler.js';
import ChartSourceBase from './chartsourcebase.js';
import {Style as olStyle, Stroke as olStroke, Circle as olCircle, Icon as olIcon, Fill as olFill} from 'ol/style';
import {Vector as olVectorSource} from 'ol/source';
import {Vector as olVectorLayer} from 'ol/layer';
import {GPX as olGPXFormat} from 'ol/format';



class GpxChartSource extends ChartSourceBase{
    /**
     *
     * @param mapholer
     * @param chartEntry
     *        properties: url - the url of the gpx
     *                    icons - the base url for icons (if points have a sym)
     *                    fallbackIcon - the url for an icon if sym not found (opt)
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
        if (typeof  chartEntry.styles === 'object'){
            for (k in styleParam){
                if (chartEntry.styles[k] !== undefined){
                    styleParam[k]=chartEntry.styles[k];
                }
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
    getSymbolUrl(sym){
        if (! sym.match(/\./)) sym+=".png";
        let url=this.chartEntry.icons + "/" + sym;
        if (this.chartEntry.fallbackIcon) url+="?fallback="+encodeURIComponent(this.chartEntry.fallbackIcon);
        return url;
    }
    styleFunction(feature,resolution) {

        let type=feature.getGeometry().getType();
        if (type == 'Point' && this.chartEntry.icons){
            let sym=feature.get('sym');
            if (sym){
                if (!this.styleMap[sym]) {
                    let style = new olStyle({
                        image: new olIcon({
                            src: this.getSymbolUrl(sym)
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
        return this.styles[feature.getGeometry().getType()];
    };

    prepareInternal() {
        let url = this.chartEntry.url;
        let self = this;
        return new Promise((resolve, reject)=> {
            if (!url) {
                reject("no map selected");
                return;
            }
            let vectorSource = new olVectorSource({
                format: new olGPXFormat(),
                url: url,
                wrapX: false
            });
            let layerOptions={
                source: vectorSource,
                style: this.styleFunction,
                opacity: this.chartEntry.opacity!==undefined?this.chartEntry.opacity:1
            };
            if (this.chartEntry.minZoom !== undefined) layerOptions.minZoom=this.chartEntry.minZoom;
            if (this.chartEntry.maxZoom !== undefined) layerOptions.maxZoom=this.chartEntry.maxZoom;
            let vectorLayer = new olVectorLayer(layerOptions);
            resolve([vectorLayer]);
        });
    }
}

export default  GpxChartSource;