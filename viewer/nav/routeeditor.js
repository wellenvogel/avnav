/**
 * Created by andreas on 04.05.14.
 */

import routeobjects from './routeobjects';
import navobjects from './navobjects';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import assign from 'object-assign';
import NavCompute from "./navcompute";

const ERROR_KEYS="either provide leg or route,index and activeName as keys";

class Callback{
    constructor(cbFunction){
        this.callback=cbFunction;
    }
    dataChanged(keys){
        this.callback(keys);
    }
}

const guard=new Callback((keys)=>{throw new Error("access to "+keys+" outside of route editor")});

const load=(storeKeys,clone)=>{
    let storeData=globalStore.getMultiple(storeKeys);
    if (storeKeys.leg){
        let newLeg=storeData.leg;
        if (clone && newLeg) newLeg=newLeg.clone();
        if (!newLeg){
            newLeg=new routeobjects.Leg(
                new navobjects.WayPoint(),
                new navobjects.WayPoint(),
                false);
        }
        return{
            leg:    newLeg,
            route:  newLeg.hasRoute()?newLeg.currentRoute:undefined,
            index:  storeData.index,
            activeName: storeData.activeName,
            useRhumbLine: storeData.useRhumbLine
        }
    }
    let route=storeData.route;
    if (clone && route) route=route.clone();
    let rt={
        route:route,
        index:storeData.index,
        activeName: storeData.activeName,
        useRhumbLine: storeData.useRhumbLine
    };
    return rt;
};

const write=(storeKeys,data,opt_omitCallbacks)=>{
    let writeKeys=assign({},storeKeys);
    delete writeKeys.useRhumbLine;
    let storeData=globalStore.getMultiple(writeKeys);
    let hasChanged=false;
    if (writeKeys.leg){
        if (!data.leg) throw new Error("missing leg on write");
        data.leg.currentRoute=data.route; //resync as the route could be new...
        hasChanged=(storeData.index != data.index) || data.leg.differsTo(storeData.leg);
    }
    else {
        let [route,index,active]=StateHelper.getRouteIndexFlag(storeData);
        hasChanged = data.index !== index;
        if (!hasChanged) {
            if (!data.route && route) hasChanged = true;
            if (data.route && !hasChanged) hasChanged = data.route.differsTo(route);
        }
    }
    if (storeKeys.activeName && data.leg){
        let newName=data.leg.getRouteName();
        if (newName != data.activeName){
            data.activeName=newName;
        }
        if (data.activeName != storeData.activeName){
            hasChanged=true;
        }
    }
    if (hasChanged){
        if (opt_omitCallbacks === undefined || opt_omitCallbacks === true) {
            globalStore.storeMultiple(data, writeKeys, guard);
        }
        else {
            globalStore.storeMultiple(data, writeKeys, [guard].concat(opt_omitCallbacks));
        }
    }
};

/**
 * a handler that will work on the global store to edit (ore query) routes
 * there are 3 sources it can work on:
 *    PAGE:     the route and index for the route page
 *    EDIT:     the route that is shown by the routing layer and can be modified directly
 *              changes made here are synced by the RouteHandler to the active route
 *              if we are editing the active one
 *    ACTIVE:   the current leg (if there is a route) - read only
 * @param mode {RouteEdit.MODES}
 * @constructor
 */
class RouteEdit{
    constructor(mode,opt_readOnly){
        this.storeKeys={};
        if (mode.storeKeys === undefined || mode.writable === undefined) throw new Error("invalid mode spec");
        let modeKeys=mode.storeKeys;
        if (modeKeys.leg !== undefined){
            this.storeKeys.leg=modeKeys.leg;
            if (modeKeys.index === undefined || modeKeys.route !== undefined) throw new Error(ERROR_KEYS);
            this.storeKeys.index=modeKeys.index;
        }
        else{
            if (modeKeys.index === undefined || modeKeys.route === undefined || modeKeys.activeName === undefined) throw new Error(ERROR_KEYS);
            this.storeKeys.route=modeKeys.route;
            this.storeKeys.index=modeKeys.index;
        }
        this.writable=mode.writable && ! opt_readOnly;
        this.writeKeys=assign({},this.storeKeys);
        this.storeKeys.activeName=modeKeys.activeName;
        if (mode.writeActiveName){
            this.writeKeys.activeName=modeKeys.activeName;
        }

    }
    checkWritable(){
        if (! this.writable) throw new Error("this route editor is not writable");
    }
    getStoreKeys(opt_merge){
        return assign({},opt_merge,this.storeKeys);
    }
    getState(){
        return {...load(this.storeKeys)}
    }
    addMultipleWaypoints(points,opt_before){
        if (! points || ! points.length) return;
        this.checkWritable();
        let data=load(this.storeKeys,true);
        if (!data.route) return;
        if (opt_before){
            //start from the end
            for (let i=points.length-1;i>=0;i--){
                data.index=data.route.addPoint(data.index,points[i],true);
            }
        }
        else{
            for (let i=0;i<points.length;i++){
                data.index=data.route.addPoint(data.index,points[i],false);
            }
        }
        write(this.writeKeys,data);
    }
    addWaypoint(point,opt_before){
        this.checkWritable();
        let data=load(this.storeKeys,true);
        if (!data.route) return;
        data.index=data.route.addPoint(data.index,point,opt_before);
        write(this.writeKeys,data);
    }
    emptyRoute(){
        this.checkWritable();
        let data=load(this.storeKeys,true);
        if (!data.route) return;
        data.route.points=[];
        write(this.writeKeys,data);
    }
    removeRoute(){
        this.checkWritable();
        let data=load(this.storeKeys,true);
        if (!data.route) return;
        data.route=undefined;
        data.index=-1;
        write(this.writeKeys,data);
    }
    invertRoute(){
        this.checkWritable();
        let data=load(this.storeKeys,true);
        if (!data.route) return;
        let old=data.route.getPointAtIndex(data.index);
        data.route.swap();
        if (old) data.index=data.route.getIndexFromPoint(old);
        write(this.writeKeys,data);
    }
    setNewRoute(route,opt_index,opt_ignoreWpNames){
        if (! route) return;
        this.checkWritable();
        let data=load(this.storeKeys,true);
        let oldTarget=undefined;
        let oldNext=undefined;
        let oldRouteName=undefined;
        if (this.storeKeys.leg && data.route){
            oldRouteName=data.route.name;
            oldTarget=data.leg.to;
            let oldIndex=data.route.getIndexFromPoint(oldTarget);
            if (oldIndex >= 0)  oldNext=data.route.getPointAtIndex(oldIndex+1);
        }
        let oldPoint=data.route?data.route.getPointAtIndex(data.index):undefined;
        data.route=route.clone();
        if (oldPoint){
            data.index=data.route.findBestMatchingIdx(oldPoint);
        }
        else{
            data.index=0;
        }
        if (this.storeKeys.leg && oldTarget){
            /**
             * try hard to set the new target
             * if the route name remains the same:
             *   1st try to find the same name
             *   2nd try to find the next name
             *   bestMatching
             * else
             *   bestMatching
             */
            let newIndex=-1;
            if (oldRouteName == data.route.name && ! opt_ignoreWpNames){
                newIndex=data.route.getIndexFromPoint(oldTarget,true);
                if (newIndex < 0 && oldNext){
                    newIndex=data.route.getIndexFromPoint(oldNext,true);
                }
                if (newIndex < 0){
                    newIndex=data.route.findBestMatchingIdx(oldTarget);
                }
            }
            else{
                newIndex=data.route.findBestMatchingIdx(oldTarget);
            }
            let newTarget=data.route.getPointAtIndex(newIndex);
            if (newTarget){
                data.leg.to=newTarget;
            }
            else{
                data.leg.to=undefined;
                data.leg.active=false;
            }
        }
        if (opt_index !== undefined){
            data.index=opt_index;
        }
        if (!data.route.getPointAtIndex(data.index)){
            data.index=0;
        }
        write(this.writeKeys,data);
    }
    changeSelectedWaypoint(newPoint,opt_index){
        this.checkWritable();
        let data=load(this.storeKeys,true);
        if (!data.route) return;
        if (opt_index !== undefined){
            data.index=opt_index;
        }
        let setAsTarget=false;
        if (this.storeKeys.leg){
            if (data.leg.getCurrentTargetIdx() == data.index) setAsTarget=true;
        }
        let routePoint=data.route.changePointAtIndex(data.index, newPoint);
        if (setAsTarget && routePoint){
            data.leg.to=routePoint;
        }
        write(this.writeKeys,data);
    }

    /**
     * only allowed if there is no route, otherwise ignored
     * @param new_point
     */
    changeTargetWaypoint(new_point){
        let data=load(this.storeKeys,true);
        if (! data.leg) return;
        if (data.route) return;
        data.leg.to=new_point;
        write(this.writeKeys,data);
    }


    deleteWaypoint(idx){
        this.checkWritable();
        let data=load(this.storeKeys,true);
        if (idx === undefined) idx=data.index;
        if (idx < 0 || ! data.route || idx >= data.route.points.length) return;
        let wasTarget=false;
        if (this.storeKeys.leg){
            wasTarget=data.leg.getCurrentTargetIdx()==idx;
        }
        let nextPoint=data.route.deletePoint(idx);
        if (wasTarget){
            data.leg.to=nextPoint;
            if (!nextPoint) data.leg.active=false;
        }
        if (data.index < 0 || data.index >= data.route.points.length){
            //we deleted the last point (and there are just points in the route)
            data.index-=1;
        }
        write(this.writeKeys,data);
    }
    checkChangePossible(newPoint,opt_index){
        if (! this.writable) return false;
        let data=load(this.storeKeys);
        if (opt_index !== undefined) data.index=opt_index;
        if (data.index < 0 || ! data.route) return false;
        return data.route.checkChangePossible(data.index,newPoint);
    }
    setNewIndex(newIndex){
        this.checkWritable();
        let data=load(this.storeKeys,true);
        if (!data.route) return;
        if (data.route.getPointAtIndex(newIndex)){
            data.index=newIndex;
            write(this.writeKeys,data);
        }
    }
    setRouteAndIndex(newRoute,newIndex){
        this.setNewRoute(newRoute,newIndex);
    }
    moveIndex(offset){
        this.checkWritable();
        let data=load(this.storeKeys,true);
        if (!data.route) return;
        let start=(data.index >= 0)?data.index:0;
        if (data.route.getPointAtIndex(start+offset)){
            data.index=start+offset;
            write(this.writeKeys,data);
        }
    }
    setIndexToTarget(){
        this.checkWritable();
        let data=load(this.storeKeys,true);
        if ( ! data.leg) {
            data.index=-1;
        }
        else{
            data.index=data.leg.getCurrentTargetIdx();
        }
        write(this.writeKeys,data);
    }

    /**
     * do arbitrary changes on the data
     * @param modifyFunction will be called with the data loaded
     *                       from the store (and potentially already cloned)
     *                       return true to update the data in the store
     */
    modify(modifyFunction,omitCallbacks){
        this.checkWritable();
        let data=load(this.storeKeys,true);
        let doUpdate=modifyFunction(data);
        if (doUpdate){
            write(this.writeKeys,data,omitCallbacks);
        }
    }

    /**
     * sync this to another RouteEdit
     * this will clone the route and the index
     * @param other {RouteEdit|RouteEdit.MODES}
     */
    syncTo(other){
        let otherEdit=other;
        if (! (other instanceof RouteEdit)){
            otherEdit=new RouteEdit(other)
        }
        let data=load(this.storeKeys);
        otherEdit.setRouteAndIndex(data.route,data.index);
    }

    getIndex(){
        let data=load(this.storeKeys);
        return data.index;
    }
    /**
     *
     * @param index - if undefined or < 0, use the current index
     */
    getPointAt(index){
        let data=load(this.storeKeys);
        if (index === undefined || index < 0){
            return StateHelper.getSelectedWaypoint(data);
        }
        if (!data.route) {
            return;
        }
        return data.route.getPointAtIndex(index);
    }
    getRoutePoints(selectedIndex){
        let data=load(this.storeKeys);
        if (!data.route) return [];
        return data.route.getRoutePoints(selectedIndex,data.useRhumbLine);
    }
    getRouteName(){
        let data=load(this.storeKeys);
        let [route]=StateHelper.getRouteIndexFlag(data);
        if (!route) return;
        return data.route.name;
    }
    getIndexFromPoint(point,opt_bestMatching){
        let data=load(this.storeKeys);
        if (!data.route) return -1;
        if (opt_bestMatching){
            return data.route.findBestMatchingIdx(point)
        }
        return data.route.getIndexFromPoint(point);
    }
    getRoute(){
        let data=load(this.storeKeys);
        return data.route;
    }
    isRouteWritable(){
        if (! this.writable) return;
        let data=load(this.storeKeys);
        if (!data.route) return false;
        if (data.route.server && ! globalStore.getData(keys.properties.connectedMode,false)) return false;
        return true;
    }
    hasRoute(){
        let data=load(this.storeKeys);
        return StateHelper.hasRoute(data);
    }
    getRawData(){
        return load(this.storeKeys);
    }
    //the following functions will only return meaningful data if we have a leg...
    hasActiveTarget(){
        let data=load(this.storeKeys);
        return StateHelper.hasActiveTarget(data);
    }
    isServerLeg(){
        let data=load(this.storeKeys);
        return StateHelper.isServerLeg(data);
    }
    getCurrentTarget(){
        let data=load(this.storeKeys);
        if (!data.leg || ! data.leg.active) return undefined;
        return data.leg.to;
    }
    getNextWaypoint(){
        let data=load(this.storeKeys);
        if (!data.leg || ! data.leg.active) return;
        if (!data.route) return;
        let currentIdx=data.route.getIndexFromPoint(data.leg.to);
        if (currentIdx < 0) return;
        return data.route.getPointAtIndex(currentIdx+1);
    }
    getCurrentFrom(){
        let data=load(this.storeKeys);
        if (!data.leg ) return undefined;
        return data.leg.from;
    }
    anchorWatch(){
        let data=load(this.storeKeys);
        if (!data.leg) return;
        return data.leg.anchorWatch();
    }
    isApproaching(){
        let data=load(this.storeKeys);
        if (!data.leg) return false;
        return data.leg.isApproaching();
    }
}

RouteEdit.MODES={
    EDIT:{
        storeKeys: {
            route: keys.nav.routeHandler.editingRoute,
            index: keys.nav.routeHandler.editingIndex,
            activeName: keys.nav.routeHandler.activeName,
            useRhumbLine: keys.nav.routeHandler.useRhumbLine
        },
        writable: true
    },
    ACTIVE:{
        storeKeys: {
            leg: keys.nav.routeHandler.currentLeg,
            index: keys.nav.routeHandler.currentIndex,
            activeName: keys.nav.routeHandler.activeName,
            useRhumbLine: keys.nav.routeHandler.useRhumbLine
        },
        writable:true,
        writeActiveName: true
    }
};
/**
 * this class provides a couple of helpers
 * that work on an object returned from the store by using the store keys from
 * RouteEdit (after getMultiple or in an update function)
 * you should never directly modify the returned objects!
 */
export class StateHelper{
    static getRouteIndexFlag(state){
        if (state.leg) {
            if (state.leg.isRouting()) {
                return [state.leg.currentRoute, state.index!==undefined?state.index:-1, state.leg.getRouteName() === state.activeName];
            }
            return [undefined,-1,false];
        }
        else{
            if (state.route){
                return [state.route,state.index!==undefined?state.index:-1,state.route.name == state.activeName]
            }
        }
        return [undefined,-1,false];

    }
    static getPointAtOffset(state,opt_offset){
        let [route,index]=StateHelper.getRouteIndexFlag(state);
        if (! route) return;
        return route.getPointAtIndex(index+(opt_offset||0));
    }
    static isActiveRoute(state){
        let [route,index,active]=StateHelper.getRouteIndexFlag(state);
        return active;
    }
    static hasPointAtOffset(state,offset){
        let [route,index,active]=StateHelper.getRouteIndexFlag(state);
        if (!route) return false;
        return route.getPointAtIndex(index+offset) !== undefined;
    }
    static getSelectedWaypoint(state){
        return StateHelper.getPointAtOffset(state);
    }

    /**
     * only meaningfull for keys with a leg
     * @param state
     */
    static hasActiveTarget(state){
        if (! state.leg) return false;
        return state.leg.isRouting();
    }

    static activeTarget(state){
        if (! state.leg) return;
        if (!state.leg.isRouting()) return;
        return state.leg.to;
    }

    static targetName(state){
        if (! StateHelper.hasActiveTarget(state)) return;
        if (! state.leg.to) return;
        return state.leg.to.name;
    }

    static selectedIsActiveTarget(state){
        if (! StateHelper.hasActiveTarget(state)) return false;
        return state.leg.getCurrentTargetIdx() == state.index;
    }

    static hasRoute(state){
        if (state.route) return true;
        if (! state.leg) return false;
        return state.leg.hasRoute();
    }

    static anchorWatchDistance(state){
        if (! state.leg) return;
        return state.leg.anchorWatch();
    }
    static routeName(state){
        if (state.route ) return state.route.name;
        if (state.leg){
            return state.leg.getRouteName()
        }
    }
    static isServerRoute(state){
        const route=state.route||(state.leg||{}).route;
        if (!route) return false;
        return route.server;
    }
    static isServerLeg(state){
        if (! state.leg) return false;
        return state.leg.server;
    }

}

export default  RouteEdit;
export const getClosestRoutePoint = (route, waypoint) => {
    let idx = route.findBestMatchingIdx(waypoint);
    let useRhumbLine = globalStore.getData(keys.nav.routeHandler.useRhumbLine);
    if (idx >= 0) {
        //now we check if we are somehow between the found point and the next
        let currentTarget = route.getPointAtIndex(idx);
        if (currentTarget.compare(waypoint)) return currentTarget;
        let nextTarget = route.getPointAtIndex(idx + 1);
        if (nextTarget && currentTarget) {
            let nextDistanceWp = NavCompute.computeDistance(waypoint, nextTarget, useRhumbLine).dts;
            let nextDistanceRt = NavCompute.computeDistance(currentTarget, nextTarget, useRhumbLine).dts;
            //if the distance to the next wp is larger then the distance between current and next
            //we stick at current
            //we allow additionally a xx% catch range
            //so we only go to the next if the distance to the nextWp is xx% smaller then the distance between the rp
            let limit = nextDistanceRt * (100 - globalStore.getData(keys.properties.routeCatchRange, 50)) / 100;
            if (nextDistanceWp <= limit) {
                return nextTarget;
            } else {
                return currentTarget;
            }
        }
        return currentTarget;
    }
}