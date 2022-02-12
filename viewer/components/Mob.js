import NavData from '../nav/navdata.js';
import MapHolder from '../map/mapholder.js';
import navobjects from '../nav/navobjects.js';
import RouteEdit,{StateHelper} from '../nav/routeeditor.js';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import LayoutHandler from '../util/layouthandler.js';


const activeRoute=new RouteEdit(RouteEdit.MODES.ACTIVE,true);


const controlMob=(start,history)=>{
    let Router=NavData.getRoutingHandler();
    let isActive=StateHelper.targetName(activeRoute.getRawData()) === navobjects.WayPoint.MOB;
    if (start){
        if (isActive) return;
        if (! globalStore.getData(keys.nav.gps.valid)) return;
        if (! globalStore.getData(keys.properties.connectedMode)) return;
        if (LayoutHandler.isEditing()) LayoutHandler.loadStoredLayout();
        let target=navobjects.WayPoint.fromPlain(globalStore.getData(keys.nav.gps.position));
        target.name=navobjects.WayPoint.MOB;
        Router.wpOn(target,false);
        MapHolder.setGpsLock(true);
        if (MapHolder.getCurrentChartEntry()){
            let currentZoom=MapHolder.getZoom();
            let mzoom=globalStore.getData(keys.properties.mobMinZoom);
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

const toggleMob=(history)=>{
    let isActive=StateHelper.targetName(activeRoute.getRawData()) === navobjects.WayPoint.MOB;
    controlMob(!isActive, history);
};

const mobDefinition=(history)=>{return {
    name: "MOB",
    storeKeys: activeRoute.getStoreKeys({visible:keys.properties.connectedMode, hasGps: keys.nav.gps.valid}),
    updateFunction:(state)=>{
        let toggle=StateHelper.targetName(state) === navobjects.WayPoint.MOB
        return {
            toggle: toggle,
            visible: toggle || (state.visible && state.hasGps)
        }
    },
    onClick:()=>{
        toggleMob(history);
    },
    editDisable:true
}};


export default {
    mobDefinition,
    controlMob,
    toggleMob
};