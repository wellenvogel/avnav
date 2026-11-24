// Run with webpack.map-widget-coordinates.js and open its generated index.html.
import '../avnav_viewer';
import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import Map from 'ol/Map';
import View from 'ol/View';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import {fromLonLat, toLonLat} from 'ol/proj';
import {Drawing} from '../map/drawing';
import MapWidget from '../components/MapWidget';

window.runMapWidgetTests = () => {
    const results = [];
    const check = (name, actual, expected) => {
        const pass = actual.length === expected.length && actual.every((v, i) => Math.abs(v - expected[i]) < 1e-6);
        results.push({name, pass, actual, expected});
    };
    for (const ratio of [1, 2]) {
        const target = document.createElement('div');
        target.style.cssText = 'width:600px;height:400px';
        document.body.append(target);
        const center = fromLonLat([12, 54]);
        const layer = new VectorLayer({source: new VectorSource({features: [new Feature(new Point(center))]})});
        const map = new Map({target, pixelRatio: ratio, layers: [layer], view: new View({center, zoom: 8}), controls: []});
        const drawing = new Drawing({
            coordToPixel: coord => map.getPixelFromCoordinate(coord),
            pixelToCoord: pixel => map.getCoordinateFromPixel(pixel),
            pointToMap: fromLonLat,
            pointFromMap: toLonLat
        }, true);
        const component = document.createElement('div');
        document.body.append(component);
        const root = createRoot(component);
        let render;
        let label;
        flushSync(() => root.render(<MapWidget name="coordinate-test" registerMap={fn => {render = fn;}}
            triggerRender={() => {}} renderCanvas={(canvas, props, api) => {
                check(`${label}: canvas dimensions`, api.getDimensions(), [canvas.width, canvas.height]);
                for (const pixel of [[canvas.width / 2, canvas.height / 2], [100, 80]]) {
                    check(`${label}: round trip ${pixel}`, api.lonLatToPixel(...api.pixelToLonLat(...pixel)), pixel);
                }
                check(`${label}: known center`, api.pixelToLonLat(...api.lonLatToPixel(12, 54)), [12, 54]);
            }}/>));
        layer.on('postrender', event => {
            drawing.setContext(event.context);
            drawing.setDevPixelRatio(event.frameState.pixelRatio);
            drawing.setPixelTransform(event.inversePixelTransform);
            drawing.setRotation(event.frameState.viewState.rotation);
            render(drawing);
        });
        for (const rotation of [0, -0.22481, Math.PI / 2]) {
            label = `ratio ${ratio}, rotation ${rotation}`;
            map.getView().setRotation(rotation);
            map.renderSync();
        }
        flushSync(() => root.unmount());
        map.dispose();
        target.remove();
        component.remove();
    }
    return results;
};
const output = document.createElement('pre');
output.id = 'results';
document.body.append(output);
try { output.textContent = JSON.stringify(window.runMapWidgetTests()); }
catch (error) { output.textContent = JSON.stringify({error: String(error), stack: error.stack}); }
