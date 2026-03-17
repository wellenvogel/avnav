// @ts-ignore
import NavData from '../nav/navdata.js';
// @ts-ignore
import MapHolder, {LOCK_MODES} from '../map/mapholder.js';
// @ts-ignore
import navobjects from '../nav/navobjects.js';
// @ts-ignore
import RouteEdit,{StateHelper} from '../nav/routeeditor.js';
import globalStore from '../util/globalstore';
// @ts-ignore
import keys from '../util/keys.jsx';
// @ts-ignore
import LayoutHandler from '../util/layouthandler.js';
import {getav} from "../util/helper";
import {IHistory} from "../util/history";
import {ButtonEvent} from "./Button";


const activeRoute=new RouteEdit(RouteEdit.MODES.ACTIVE,true);


const controlMob=(start:boolean,history: IHistory)=>{
    const Router=NavData.getRoutingHandler();
    const isActive=StateHelper.targetName(activeRoute.getRawData()) === navobjects.WayPoint.MOB;
    if (start){
        if (isActive) return;
        if (! globalStore.getData(keys.nav.gps.valid)) return;
        if (! globalStore.getData(keys.properties.connectedMode)) return;
        LayoutHandler.resetEditing();
        const target=navobjects.WayPoint.fromPlain(globalStore.getData(keys.nav.gps.position));
        target.name=navobjects.WayPoint.MOB;
        Router.wpOn(target).then(()=>{},()=>{});
        MapHolder.setGpsLock(LOCK_MODES.center);
        if (MapHolder.getCurrentChartEntry()){
            const currentZoom=MapHolder.getZoom();
            const mzoom=globalStore.getData(keys.properties.mobMinZoom);
            let diff=mzoom-currentZoom.required;
            if (diff < 0) diff=0;
            MapHolder.changeZoom(diff,true); //force to set required zoom
            history.reset();
            history.push("navpage")
        }
        else{
            history.reset();
            history.push("gpspage")
        }
    }
    else{
        if (! isActive) return;
        Router.routeOff();
    }
};

const toggleMob=(history:IHistory)=>{
    const isActive=StateHelper.targetName(activeRoute.getRawData()) === navobjects.WayPoint.MOB;
    controlMob(!isActive, history);
};

const mobDefinition=()=>{return {
    name: "MOB",
    storeKeys: activeRoute.getStoreKeys({visible:keys.properties.connectedMode, hasGps: keys.nav.gps.valid}),
    updateFunction:(state:Record<string, any>)=>{
        const toggle=StateHelper.targetName(state) === navobjects.WayPoint.MOB
        return {
            toggle: toggle,
            visible: toggle || (state.visible && state.hasGps)
        }
    },
    onClick:(ev:ButtonEvent)=>{
        const history=getav(ev).history;
        if (! history) return;
        toggleMob(history);
    },
    editDisable:true
}};


export default {
    mobDefinition,
    controlMob,
    toggleMob
};