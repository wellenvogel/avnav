import type {Map as MapLibreMap} from 'maplibre-gl';

/**
 * Return the copyright a MapLibre map.
 * @param map A MapLibre map
 */
// @ts-ignore
const getMapLibreAttributions = (map: MapLibreMap | undefined): string[] => {
    return []
}
export default getMapLibreAttributions;
