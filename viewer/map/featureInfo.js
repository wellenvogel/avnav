/*
# Copyright (c) 2022,2025 Andreas Vogel andreas@wellenvogel.net

#  Permission is hereby granted, free of charge, to any person obtaining a
#  copy of this software and associated documentation files (the "Software"),
#  to deal in the Software without restriction, including without limitation
#  the rights to use, copy, modify, merge, publish, distribute, sublicense,
#  and/or sell copies of the Software, and to permit persons to whom the
#  Software is furnished to do so, subject to the following conditions:
#
#  The above copyright notice and this permission notice shall be included
#  in all copies or substantial portions of the Software.
#
#  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
#  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
#  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
#  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
#  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
#  DEALINGS IN THE SOFTWARE.
*/

import navobjects from "../nav/navobjects";


export class FeatureAction{
    constructor({name,label,onClick,condition,close,toggle,onPreClose}) {
        this.name=name;
        this.label=label;
        this.onClickHandler=onClick;
        this.condition=condition;
        this.close=close;
        this.toggleValue=toggle;
        this.onPreCloseValue=onPreClose
    }
    shouldShow(featureInfo){
        if (! this.condition) return true;
        return this.condition(featureInfo);
    }
    onClick(featureInfo,dialogCtx){
        if (this.shouldShow(featureInfo) && this.onClickHandler){
            this.onClickHandler(featureInfo,dialogCtx);
        }
    }
    toggle(featureInfo){
        if (this.toggleValue === undefined) return false;
        if (typeof this.toggleValue === 'function') return this.toggleValue(featureInfo);
        return this.toggleValue;
    }

    /**
     * called before the feature dialog will close
     * @param featureInfo
     * @returns {*|boolean} return false to threat this as a "cancel" action - i.e. keep the feature list open
     *                      the default is true - i.e. close the feature list when closing the featureinfo
     */
    onPreClose(featureInfo){
        if (this.onPreCloseValue !== undefined) {
            if (typeof this.onPreCloseValue === 'function') return this.onPreCloseValue(featureInfo);
            return this.onPreCloseValue;
        }
        return true;
    }
}

export class FeatureInfo{
    static TYPE={
        route:1,
        ais:2,
        boat: 3,
        track: 4,
        overlay: 5,
        chart: 6,
        waypoint: 7,
        base:8,
        measure:9,
        anchor: 10,
        unknown: 0,
        any: 99 //for additional actions
    }
    constructor({point,isOverlay,title,icon}) {
        /**
         * goto target
         * @type {navobjects.Point}
         */
        this.point=point||new navobjects.Point();
        this.title=title;
        this.isOverlay=isOverlay||false;
        this.urlOrKey=undefined;
        this.icon=icon;
        this.userInfo= {};
        this.overlaySource=undefined;
    }
    getType(){
        return FeatureInfo.TYPE.unknown;
    }
    typeString(){
        for (let k in FeatureInfo.TYPE){
            if (this.getType() === FeatureInfo.TYPE[k]) return k;
        }
        return 'unknown';
    }
    validPoint(){
        return this.point && (this.point instanceof navobjects.Point) && this.point.valid();
    }
}

export class BaseFeatureInfo extends FeatureInfo{
    constructor({point,title}) {
        super({point,title});
    }
    getType(){
        return FeatureInfo.TYPE.base;
    }
}

export class OverlayFeatureInfo extends FeatureInfo{
    constructor({title,point,urlOrKey,userInfo,overlaySource}) {
        super({title,point,isOverlay:true});
        this.userInfo=userInfo;
        this.urlOrKey=urlOrKey;
        this.overlaySource=overlaySource;
    }
    getType(){
        return FeatureInfo.TYPE.overlay;
    }
}

export class RouteFeatureInfo extends FeatureInfo{
    constructor({point,isOverlay,routeName,title}) {
        super({point,isOverlay});
        this.urlOrKey=routeName||this.point.routeName;
        this.title=title||`Route: ${this.urlOrKey}`
    }
    getType(){
        return FeatureInfo.TYPE.route;
    }
}
export class AisFeatureInfo extends FeatureInfo{
    constructor({point,mmsi,title,icon}) {
        super({point});
        this.urlOrKey=mmsi;
        this.title=title||`MMSI: ${mmsi}`
        this.icon=icon;
    }
    getType(){
        return FeatureInfo.TYPE.ais;
    }
}
export class TrackFeatureInfo extends FeatureInfo{
    constructor({point,urlOrKey,title,isOverlay}) {
        super({point,isOverlay,title});
        this.urlOrKey=urlOrKey
    }
    getType(){
        return FeatureInfo.TYPE.track;
    }
}
export class ChartFeatureInfo extends FeatureInfo{
    constructor({point,chartKey,title,isOverlay,overlaySource}) {
        super({point,isOverlay,title});
        this.urlOrKey=chartKey
        this.overlaySource=overlaySource
    }
    getType(){
        return FeatureInfo.TYPE.chart;
    }
}

/**
 * active waypoint
 */
export class WpFeatureInfo extends FeatureInfo{
    constructor({point,title}) {
        super({point});
        this.title=title||`WP ${this.point.name}`;
    }
    getType(){
        return FeatureInfo.TYPE.waypoint;
    }
}

export class BoatFeatureInfo extends FeatureInfo{
    constructor({point,icon}) {
        super({point,title:'current position',icon});
    }
    getType(){
        return FeatureInfo.TYPE.boat;
    }
}
export class AnchorFeatureInfo extends FeatureInfo{
    constructor({point}) {
        super({point,title:'anchor'});
    }
    getType(){
        return FeatureInfo.TYPE.anchor;
    }
}
export class MeasureFeatureInfo extends FeatureInfo{
    constructor({point}) {
        super({point,title:'measure'});
    }
    getType(){
        return FeatureInfo.TYPE.measure;
    }
}