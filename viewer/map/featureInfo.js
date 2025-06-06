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
    constructor({name,label,onClick,condition}) {
        this.name=name;
        this.label=label;
        this.onClickHandler=onClick;
        this.condition=condition;
    }
    shouldShow(featureInfo){
        if (! this.condition) return true;
        return this.condition(featureInfo);
    }
    onClick(featureInfo){
        if (this.shouldShow(featureInfo) && this.onClickHandler){
            this.onClickHandler(featureInfo);
        }
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
        anchor: 10,
        unknown: 0,
        any: 99 //for additional actions
    }
    constructor({point,type,isOverlay,title}) {
        /**
         * goto target
         * @type {navobjects.Point}
         */
        this.point=point||new navobjects.Point();
        this.type=type|| FeatureInfo.TYPE.unknown;
        this.title=title;
        this.isOverlay=isOverlay||false;
        this.urlOrKey=undefined;
        this.icon=undefined;
        this.userInfo= {};
        this.overlaySource=undefined;
    }
    typeString(){
        for (let k in FeatureInfo.TYPE){
            if (this.type === FeatureInfo.TYPE[k]) return k;
        }
        return 'unknown';
    }
    validPoint(){
        return this.point && (this.point instanceof navobjects.Point) && this.point.valid();
    }
}

export class BaseFeatureInfo extends FeatureInfo{
    constructor({point,title}) {
        super({point,type:FeatureInfo.TYPE.base,title});
    }
}

export class OverlayFeatureInfo extends FeatureInfo{
    constructor({title,point,urlOrKey,userInfo,overlaySource}) {
        super({title,point,isOverlay:true,type: FeatureInfo.TYPE.overlay});
        this.userInfo=userInfo;
        this.urlOrKey=urlOrKey;
        this.overlaySource=overlaySource;
    }
}

export class RouteFeatureInfo extends FeatureInfo{
    constructor({point,isOverlay,routeName,title}) {
        super({point,type:FeatureInfo.TYPE.route,isOverlay});
        this.urlOrKey=routeName||this.point.routeName;
        this.title=title||`Route: ${this.urlOrKey}`
    }
}
export class AisFeatureInfo extends FeatureInfo{
    constructor({point,mmsi,title,icon}) {
        super({point,type:FeatureInfo.TYPE.ais});
        this.urlOrKey=mmsi;
        this.title=title||`MMSI: ${mmsi}`
        this.icon=icon;
    }
}
export class TrackFeatureInfo extends FeatureInfo{
    constructor({point,urlOrKey,title,isOverlay}) {
        super({point,type:FeatureInfo.TYPE.track,isOverlay,title});
        this.urlOrKey=urlOrKey
    }
}
export class ChartFeatureInfo extends FeatureInfo{
    constructor({point,chartKey,title,isOverlay,chartFeatures}) {
        super({point,type:FeatureInfo.TYPE.chart,isOverlay,title});
        this.urlOrKey=chartKey
        this.chartFeatures=chartFeatures;
    }
}

/**
 * active waypoint
 */
export class WpFeatureInfo extends FeatureInfo{
    constructor({point,title}) {
        super({point,type:FeatureInfo.TYPE.waypoint});
        this.title=title||`WP ${this.point.name}`;
    }
}

export class BoatFeatureInfo extends FeatureInfo{
    constructor({point,icon}) {
        super({point,title:'current position',icon,type: FeatureInfo.TYPE.boat});
    }
}
export class AnchorFeatureInfo extends FeatureInfo{
    constructor({point}) {
        super({point,title:'anchor',type: FeatureInfo.TYPE.anchor});
    }
}