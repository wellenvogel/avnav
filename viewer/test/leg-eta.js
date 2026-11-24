// Import in the same order as the viewer, without starting its UI.
import '../avnav_viewer';
import NavCompute from '../nav/navcompute';
import globalStore from '../util/globalstore';
import keys from '../util/keys';

// Build: npx webpack --config test/webpack.leg-eta.js
// Serve build/leg-eta over HTTP and call runLegEtaTests() in the browser console.
window.runLegEtaTests = () => {
    const results = [];
    const assert = (ok, message) => { if (!ok) throw new Error(message); };
    const start = {lat: 50, lon: 1};
    const target = {lat: 50.1, lon: 1};
    const previous = globalStore.getData(keys.nav.routeHandler.useRhumbLine);
    try {
        for (const rhumb of [false, true]) {
            globalStore.storeData(keys.nav.routeHandler.useRhumbLine, rhumb);
            const distance = NavCompute.computeDistance(start, target, rhumb).dts;
            const gps = {...start, valid: true, course: 0, speed: distance / 3600};
            for (const [time, expected] of [
                ['2020-08-03T12:00:00Z', '2020-08-03T13:00:00Z'],
                ['2026-11-18T23:30:00Z', '2026-11-19T00:30:00Z'],
                ['1970-01-01T00:00:00Z', '1970-01-01T01:00:00Z'],
            ]) {
                const result = NavCompute.computeLegInfo(target, {...gps, epochms: Date.parse(time)});
                const actual = result.markerEta?.toISOString();
                assert(actual === new Date(expected).toISOString(), `${rhumb ? 'rhumb' : 'great circle'}: ${actual} != ${expected}`);
                assert(Math.abs(result.markerTtgVmg - 3600) < 0.001, 'Travel time changed');
                results.push({rhumb, time, actual});
            }
            for (const changes of [{}, {epochms: Date.parse('2026-11-18'), speed: 0}, {epochms: Date.parse('2026-11-18'), course: 180}]) {
                assert(NavCompute.computeLegInfo(target, {...gps, ...changes}).markerEta === undefined,
                    'No ETA should be supplied without GPS time or positive approach speed');
                results.push({rhumb, noEta: changes});
            }
        }
        return results;
    } finally { globalStore.storeData(keys.nav.routeHandler.useRhumbLine, previous); }
};
