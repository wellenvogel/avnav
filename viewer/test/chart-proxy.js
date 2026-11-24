// Match the viewer's module initialization order (without starting its UI).
import '../avnav_viewer';
import AvnavChartSource from '../map/avnavchartsource';
import {layerFactory} from '../map/chartlayers';
import globalStore from '../util/globalstore';
import keys from '../util/keys';

// Run with test/webpack.chart-proxy.js, then open the generated HTML file
// through a local HTTP server. Requests are intercepted; no chart service is used.
window.runChartProxyTests = async () => {
    globalStore.storeData(keys.properties.networkTimeout, 5000);
    const originalFetch = window.fetch;
    const results = [];
    try {
        for (const [name, options, expectedProxy] of [
            ['camel-case enabled', {useProxy: true}, true],
            ['camel-case disabled', {useProxy: false}, false],
            ['lower-case enabled', {useproxy: true}, true],
            ['lower-case disabled', {useproxy: false}, false],
            ['XML true', {xml: '<TileMap useProxy="true"/>'}, true],
            ['XML false', {xml: '<TileMap useProxy="false"/>'}, false],
            ['absent', {}, false],
            ['lower-case precedence', {useproxy: false, useProxy: true}, false]
        ]) {
            const remote = 'https://charts.example/style.json';
            const fetched = [];
            window.fetch = async url => {
                fetched.push(String(url));
                return new Response(JSON.stringify({version: 8, sources: {}, layers: []}));
            };
            const layer = layerFactory.layerClass('maplibre', {overviewUrl: location.href});
            const parsed = options.xml
                ? AvnavChartSource.prototype.parseOverviewXml.call(
                    {parseXmlNode: AvnavChartSource.prototype.parseXmlNode}, options.xml)[0]
                : options;
            await layer.prepare({...parsed, style: remote}, {});
            const expected = expectedProxy ? location.origin + '/proxy/' + encodeURIComponent(remote) : remote;
            if (fetched.length !== 1 || fetched[0] !== expected) {
                throw new Error(`${name}: expected ${expected}, got ${fetched}`);
            }
            const tile = 'https://charts.example/0/0/0.pbf';
            const translated = layer._translateUrl(tile, true);
            const expectedTile = expectedProxy ? location.origin + '/proxy/' + encodeURIComponent(tile) : tile;
            if (translated !== expectedTile) throw new Error(`${name}: incorrect tile URL ${translated}`);
            const local = location.origin + '/local/0/0/0.pbf';
            if (layer._translateUrl(local, true) !== local) throw new Error(`${name}: proxied local URL`);
            results.push(name);
        }
        return results;
    } finally {
        window.fetch = originalFetch;
    }
};
