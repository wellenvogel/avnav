/**
 * Created by andreas on 18.05.14.
 */

import keys from '../util/keys.jsx';
import globalStore from '../util/globalstore.jsx';
import base from "../base";

/**
 * a cover for the layer that the track
 * @param {MapHolder} mapholder
 * @constructor
 */
export default class UserLayer {
    constructor(mapholder) {
        /**
         * @private
         * @type {MapHolder}
         */
        this.mapholder = mapholder;

        /**
         * @private
         * @type {boolean}
         */
        this.visible = globalStore.getData(keys.properties.layers.user);
        this.userOverlays = {};
        this.lineStyle = {};
        this.setStyle();
        this.panelPage=undefined;
    }

    /**
     * set the style for the track line
     * @private
     */
    setStyle() {
        this.lineStyle = {
            color: globalStore.getData(keys.properties.trackColor),
            width: globalStore.getData(keys.properties.trackWidth)
        }
    }


    /**
     *
     * @param {olCoordinate} center
     * @param {Drawing} drawing
     */
    onPostCompose(center, drawing) {
        if (!this.visible) {
            return;
        }
        for (let k in this.userOverlays){
            try {
                this.userOverlays[k](drawing, center);
            }catch(e){
                base.log("error in user overlay "+k+": "+e);
            }
        }
    }

    dataChanged() {
        this.visible = globalStore.getData(keys.properties.layers.user);
        this.setStyle();
    }

    setImageStyles(styles) {

    }

    registerMapWidget(page,config,callback){
        if (this.panelPage !== page && ! callback) return;
        if (! config.name) return;
        if (this.panelPage !== page){
            this.userOverlays={};
        }
        this.panelPage=page;
        if (!callback) {
            delete this.userOverlays[config.name];
        }
        else {
            this.userOverlays[config.name] = callback;
        }
        return config.storeKeys;
    }
    unregisterPageWidgets(page){
        if (this.panelPage !== page) return;
        this.userOverlays={};
        this.panelPage=undefined;
    }
};

