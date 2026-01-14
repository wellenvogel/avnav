import {Map as MapLibreMap} from 'maplibre-gl';
import type {MapOptions, QueryRenderedFeaturesOptions} from 'maplibre-gl';
import type {Map} from 'ol';
import Layer from 'ol/layer/Layer.js';
import type {Options as LayerOptions} from 'ol/layer/Layer.js';
import type {EventsKey} from 'ol/events.js';
import BaseEvent from 'ol/events/Event.js';
import {unByKey} from 'ol/Observable.js';
import {Source} from 'ol/source.js';
import MapLibreLayerRenderer from './MapLibreLayerRenderer';
import getMapLibreAttributions from './getMapLibreAttributions';

export type MapLibreOptions = Omit<MapOptions, 'container'>;

/**
 * Receives the zoom level from the OpenLayers view
 * and can transform it for MapLibre in case the projection
 * system used by OL isn't using a standard Mercator pyramid.
 *
 * This enables the MapLibreLayer to work in Mercator zooms even if OL
 * is using a localized projection (such as LV95 for Switzerland)
 */
export type MapLibreLayerTranslateZoomFunction = (zoom: number) => number;

export type MapLibreLayerOptions = LayerOptions & {
  mapLibreOptions: MapLibreOptions;
  queryRenderedFeaturesOptions?: QueryRenderedFeaturesOptions;
  translateZoom?: MapLibreLayerTranslateZoomFunction
};

export class LoadEvent extends BaseEvent {
    public data: MapLibreMap;
    constructor(name:string,data:MapLibreMap) {
        super(name);
        this.data=data;
    }

}

export default class MapLibreLayer extends Layer {
  mapLibreMap?: MapLibreMap;


  private olListenersKeys: EventsKey[] = [];
  private visibleChange: EventsKey=undefined;
  private sizeChange: EventsKey=undefined;

  constructor(options: MapLibreLayerOptions) {
    super({
      source: new Source({
        attributions: () => {
          return getMapLibreAttributions(this.mapLibreMap);
        },
      }),
      ...options,
    });
  }

  override disposeInternal() {
      unByKey(this.visibleChange);
      unByKey(this.sizeChange);
      unByKey(this.olListenersKeys);
    if (this.mapLibreMap) {
      // Some asynchronous repaints are triggered even if the MapLibreMap has been removed,
      // to avoid display of errors we set an empty function.
      this.mapLibreMap.triggerRepaint = () => {};
      this.mapLibreMap.remove();
      this.mapLibreMap = undefined;
      console.log("destroyed map libre map");
    }
    super.disposeInternal();
  }

  override setMapInternal(map: Map) {
    super.setMapInternal(map);
    if (map){
        if (! this.mapLibreMap) {
            this.loadMapLibreMap(map);
        }
    } else {
      // TODO: I'm not sure if it's the right call
      this.dispose();
    }
  }

  private loadMapLibreMap(map:Map) {
    console.log("loading maplibre");
    const container = document.createElement('div');
    container.setAttribute('id', 'mapLibreMapXXX');
    container.style.position = 'absolute';
    container.style.width = '100%';
    container.style.height = '100%';

    const mapLibreOptions = this.get('mapLibreOptions') as MapLibreOptions;

    this.mapLibreMap = new MapLibreMap(
      Object.assign({}, mapLibreOptions, {
        container: container,
        attributionControl: false,
        interactive: false,
        trackResize: false,
      }),
    );

    this.mapLibreMap.on('sourcedata', () => {
      this.getSource()?.refresh(); // Refresh attribution
    });

    this.mapLibreMap.once('load', () => {
      this.dispatchEvent(new BaseEvent('load'));
      this.dispatchEvent(new LoadEvent('load-maplibre',this.mapLibreMap));
    });
    this.sizeChange=map.on('change:size', () => {
        console.log("maplibre layer resize");
        this.mapLibreMap.resize();
    });
  }

  override createRenderer(): MapLibreLayerRenderer {
    const translateZoom = this.get('translateZoom') as MapLibreLayerTranslateZoomFunction | undefined;
    return new MapLibreLayerRenderer(this, translateZoom);
  }
}
