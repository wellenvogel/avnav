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

//TODO: styles...
const styles = {
    'Point': new ol.style.Style({
        image: new ol.style.Circle({
            fill: new ol.style.Fill({
                color: 'rgba(255,255,0,0.4)',
            }),
            radius: 5,
            stroke: new ol.style.Stroke({
                color: '#ff0',
                width: 1,
            }),
        }),
    }),
    'LineString': new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: '#f00',
            width: 3,
        }),
    }),
    'MultiLineString': new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: '#0f0',
            width: 3,
        }),
    }),
};

class GpxChartSource extends ChartSourceBase{
    /**
     *
     * @param mapholer
     * @param chartEntry
     *        properties: url - the url of the gpx
     *                    iconBase - the base url for icons (if points have a sym)
     */
    constructor(mapholer, chartEntry) {
        super(mapholer,chartEntry);
        this.styleMap={};
        this.styleFunction=this.styleFunction.bind(this);
    }
    styleFunction(feature,resolution) {

        let type=feature.getGeometry().getType();
        if (type == 'Point' && this.chartEntry.iconBase){
            let sym=feature.get('sym');
            if (sym){
                if (! sym.match(/\./)) sym+=".png";
                if (!this.styleMap[sym]) {
                    let style = new ol.style.Style({
                        image: new ol.style.Icon({
                            src: this.chartEntry.iconBase + "/" + sym
                        })
                    });
                    this.styleMap[sym] = style;
                }
                let rt=this.styleMap[sym];
                let scale=this.mapholder.olmap.getView().getResolutionForZoom(13)/resolution;
                if (scale > 1) scale=1;
                rt.getImage().setScale(scale);
                return rt;
            }
        }
        return styles[feature.getGeometry().getType()];
    };

    prepareInternal() {
        let url = this.chartEntry.url;
        let self = this;
        return new Promise((resolve, reject)=> {
            if (!url) {
                reject("no map selected");
                return;
            }
            let vectorSource = new ol.source.Vector({
                format: new ol.format.GPX(),
                url: url,
                wrapX: false
            });

            let vectorLayer = new ol.layer.Vector({
                source: vectorSource,
                style: this.styleFunction
            });
            resolve([vectorLayer]);
        });
    }


    isEqual(other) {
        if (!super.isEqual(other)) return false;
        if (this.chartEntry.iconBase !== other.chartEntry.iconBase) return false;
    }
}

export default GpxChartSource;