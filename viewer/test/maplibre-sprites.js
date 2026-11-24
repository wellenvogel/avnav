import '../avnav_viewer';
import {layerFactory} from '../map/chartlayers';

window.runSpriteTests = async () => {
    const results = [];
    const base = 'https://charts.example/seamap/style.json';
    for (const useproxy of [false, true]) {
        for (const [name, sprite, expected] of [
            ['string', './sprites/base', 'https://charts.example/seamap/sprites/base'],
            ['array', [
                {id: 'base', url: 'https://tiles.versatiles.org/assets/sprites/base'},
                {id: 'freenauticalchart', url: './sprites/freenauticalchart'}
            ], [
                {id: 'base', url: 'https://tiles.versatiles.org/assets/sprites/base'},
                {id: 'freenauticalchart', url: 'https://charts.example/seamap/sprites/freenauticalchart'}
            ]],
            ['empty array', [], []],
            ['absent', undefined, undefined]
        ]) {
            try {
                const layer = layerFactory.layerClass('maplibre', {overviewUrl: base});
                const style = {version: 8, sources: {}, layers: [], glyphs: './fonts/{fontstack}/{range}.pbf'};
                if (sprite !== undefined) style.sprite = sprite;
                const options = await layer.prepare({style, useproxy}, {});
                layer.createOL(options);
                if (JSON.stringify(style.sprite) !== JSON.stringify(expected)) throw new Error('incorrect sprite URLs or IDs');
                if (style.glyphs !== 'https://charts.example/seamap/fonts/{fontstack}/{range}.pbf') throw new Error('glyph placeholders changed');
                const url = 'https://charts.example/seamap/sprites/base@2x.png';
                const translated = options.maplibre.transformRequest(url, 'SpriteImage').url;
                const wanted = useproxy ? location.origin + '/proxy/' + encodeURIComponent(url) : url;
                if (translated !== wanted) throw new Error('incorrect proxy translation');
                results.push({name: `${name}, proxy ${useproxy}`, pass: true});
            } catch (e) {
                results.push({name: `${name}, proxy ${useproxy}`, pass: false, error: String(e)});
            }
        }
    }
    return results;
};
const output = document.createElement('pre');
output.id = 'results';
document.body.append(output);
window.runSpriteTests().then(results => {output.textContent = JSON.stringify(results);})
    .catch(e => {output.textContent = JSON.stringify({error: String(e)});});
