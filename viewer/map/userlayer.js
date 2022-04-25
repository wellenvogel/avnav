/**
 * Created by andreas on 18.05.14.
 */

import keys from '../util/keys.jsx';
import globalStore from '../util/globalstore.jsx';
import base from "../base";
import assign from 'object-assign';

class UserOverlay{
    constructor(mapholder,config) {
        this.config=config||{}; //TODO: check config
        this.mapholder=mapholder;
        this.isInitialized=false;
        this.drawing=undefined;
        this.visible=true;
    }
    setVisible(v){
        if (this.visible === v) return;
        if (!v){
            if (this.isInitialized) this.finalize();
        }
        this.visible=v;
    }
    initUserContext(){
        this.userContext={};
        this.userContext.lonLatToPixel=(lon,lat)=>{
            if (! this.drawing) return[0,0];
            let mapcoord=this.mapholder.pointToMap([lon,lat]);
            return this.drawing.pixelToDevice(this.drawing.pointToCssPixel(mapcoord));
        }
        this.userContext.pixelToLonLat=(x,y)=>{
            if (! this.drawing) return [0,0];
            x=x/this.drawing.getDevPixelRatio();
            y=y/this.drawing.getDevPixelRatio();
            return this.mapholder.pointFromMap(this.drawing.cssPixelToCoord([x,y]));
        }
        this.userContext.getScale=()=>{
            if (! this.drawing) return 1;
            return this.drawing.useHdpi?this.drawing.devPixelRatio:1;
        }
        this.userContext.getRotation=()=>{
            if (! this.drawing) return 0;
            return this.drawing.getRotation();
        }
        this.userContext.getContext=()=>{
            if (! this.drawing) return;
            return this.drawing.getContext();
        }
        this.userContext.getDimensions=()=>{
            if (! this.drawing) return [0,0];
            let cv=this.drawing.getContext().canvas;
            return [cv.width*this.drawing.getDevPixelRatio(),cv.height*this.drawing.getDevPixelRatio()];
        }
        this.userContext.triggerRender=()=>{
            window.setTimeout(()=>this.mapholder.navEvent(),0);
        }
    }
    init(){
        if (! this.visible) return;
        this.initUserContext();
        if (this.config.initFunction){
            try{
                this.config.initFunction.apply(this.userContext,[this.userContext]);
            }catch(e){
                base.log("init error "+e+" for "+this.config.name);
            }
        }
        this.isInitialized=true;
    }

    /**
     *
     * @param center
     * @param {Drawing}drawing
     */
    onPostCompose(center,drawing){
        if (! this.visible) return;
        if (! this.isInitialized){
            this.init();
        }
        this.drawing=drawing;
        if (this.config.renderCanvas){
            let data=this.config.storeKeys?
                globalStore.getMultiple(this.config.storeKeys):{};
            try{
                this.config.renderCanvas.apply(this.userContext,[drawing.getContext().canvas,data,center]);
            }catch (e){
                base.log("renderCanvas error "+e+" for "+this.config.name);
            }
        }
        this.drawing=undefined;
    }
    finalize(){
        if (! this.isInitialized){
            return;
        }
        if (this.config.finalizeFunction){
            try{
                this.config.finalizeFunction.apply(this.userContext,[this.userContext]);
            }catch(e){
                base.log("finalize error "+e+" for "+this.config.name);
            }
        }
        this.isInitialized=false;
    }
}

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
        this.userOverlays = [];
        this.lineStyle = {};
        this.setStyle();
        this.panelPage=undefined;
        globalStore.register(this, [keys.gui.global.propertySequence,keys.gui.global.layoutSequence]);
        this.subscription=mapholder.subscribe((evt)=>{
            if (! evt || ! evt.type) return;
            if (evt.type===mapholder.EventTypes.HIDEMAP){
                this.userOverlays.forEach((ovl)=>ovl.finalize())
            }
            if (evt.type===mapholder.EventTypes.SHOWMAP){
                this.userOverlays.forEach((ovl)=>ovl.init())
            }
        })
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
        this.userOverlays.forEach((ovl)=>ovl.onPostCompose(center,drawing));

    }

    dataChanged() {
        this.visible = globalStore.getData(keys.properties.layers.user);
        this.setStyle();
    }

    setImageStyles(styles) {

    }

    setMapPanel(page,widgets){
         if (! widgets){
             if (this.panelPage !== page ) return;
         }
         this.panelPage=page;
         this.userOverlays.forEach((ovl)=>ovl.finalize())
         this.userOverlays=[];
         let rt={};
         if (! widgets) return;
         assign(rt,widgets.forEach((widget)=>this.registerUserOverlay(widget)));
         return rt;
    }
    /**
     * register a user overlay
     * @param config
     * @return the store keys (if any)
     */
    registerUserOverlay(config){
        if (! config || ! config.name){
            throw new Error("missing parameter name for user overlay");
        }
        for (let i in this.userOverlays){
            let ovl=this.userOverlays[i];
            if (ovl.config.name === config.name){
                return; //silently ignore duplicates
            }
        }
        let ovl=new UserOverlay(this.mapholder,config);
        this.userOverlays.push(ovl);
        return config.storeKeys;

    }
};

