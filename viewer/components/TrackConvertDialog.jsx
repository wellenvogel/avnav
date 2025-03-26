/**
 *###############################################################################
 # Copyright (c) 2012-2020 Andreas Vogel andreas@wellenvogel.net
 #
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
 #  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHERtime
 #  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 #  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 #  DEALINGS IN THE SOFTWARE.
 #
 ###############################################################################
 * display the infos of a track
 */

import React, {useCallback, useEffect, useState} from 'react';
import PropTypes from 'prop-types';
import DB from "./DialogButton";
import {
    DBCancel,
    DialogButtons,
    DialogFrame,
    DialogRow,
    InfoItem,
    useDialogContext
} from "./OverlayDialog";
import Requests from '../util/requests';
import Toast from "./Toast";
import Helper from "../util/helper";
import navobjects from "../nav/navobjects";
import NavCompute from "../nav/navcompute";
import Formatter from '../util/formatter';
import globalstore from "../util/globalstore";
import keys from "../util/keys";
import {Input} from "./Inputs";
import SimpleRouteFilter from "../nav/simpleroutefilter";
import navdata from "../nav/navdata";
import routeobjects from "../nav/routeobjects";
import RouteEdit from "../nav/routeeditor";
import mapholder from "../map/mapholder";

const RouteHandler=navdata.getRoutingHandler();



export const INFO_ROWS=[
    {label:'name',value:'name'},
    {label:'points',value:'numPoints',formatter:(v,data)=>{
        if (data.refIdx !== undefined) return data.refIdx+"/"+data.numPoints;
        return v;
        }},
    {label:'length',value:'distance',formatter:(v)=>{
        return Formatter.formatDistance(v)+" nm";
        }},
    {label:'remain',value:'remain',formatter: (v)=>{
        return Formatter.formatDistance(v)+ " nm";
        }},
    {label:'average',value:'avgSpeed', formatter:(v)=>{
        return Formatter.formatSpeed(v)+" kn";
        }},
    {label:'speed',value: 'pointSpeed', formatter:(v)=> Formatter.formatSpeed(v)+" kn"},
    {label:'course',value: 'pointCourse',formatter:(v)=>Formatter.formatDirection(v)+" °"},
    {label:'time',value:'pointTime',formatter: (v)=>Formatter.formatDateTime(v)},
    {label:'start',value:'startTime',formatter:(v)=>Formatter.formatDateTime(v)},
    {label:'end',value:'endTime',formatter:(v)=>Formatter.formatDateTime(v)},
    ];

class TrackInfo{
    constructor(opt_refpoint) {
        this.points=[];
        this.distance = 0;
        this.lastPoint = undefined;
        this.startTime = undefined;
        this.endTime = undefined;
        this.hasTimeErrors = false;
        this.refPoint=opt_refpoint;
        this.foundPoint=undefined;
    }

    /**
     *
     * @param point {navobjects.TrackPoint}
     */
    addPoint(point){
        if (this.startTime === undefined || point.ts < this.startTime) {
            this.startTime = point.ts;
        }
        if (this.endTime === undefined || point.ts > this.endTime) {
            this.endTime = point.ts;
        }
        this.points.push(point);
        if (this.lastPoint) {
            let dts = NavCompute.computeDistance(this.lastPoint, point,
                globalstore.getData(keys.nav.routeHandler.useRhumbLine));
            this.distance += dts.dts;
        }
        this.lastPoint = point;
    }

    finalize(resolve,reject){
        if (this.points.length < 2) {
            reject("no points parsed from track");
            return;
        }
        let avgSpeed = undefined;
        let MINDIFF = 1;//s
        if (this.endTime !== undefined && this.startTime !== undefined
            && this.endTime > (this.startTime + MINDIFF)) {
            avgSpeed = this.distance / (this.endTime - this.startTime); //m/s
        }
        let refIdx=-1;
        let remain=0;
        if (this.refPoint){
            let bestDistance;
            for (let i=0;i<this.points.length;i++){
                let cur=NavCompute.computeDistance(this.refPoint,
                    this.points[i],
                    globalstore.getData(keys.nav.routeHandler.useRhumbLine)).dts;
                if (bestDistance === undefined || cur < bestDistance){
                    refIdx=i;
                    bestDistance=cur;
                }
            }
            this.foundPoint=this.points[refIdx];
            let last=this.foundPoint;
            let useRhumbLine=globalstore.getData(keys.nav.routeHandler.useRhumbLine);
            for (let i=refIdx+1;i<this.points.length;i++){
                remain+=NavCompute.computeDistance(last,this.points[i],useRhumbLine).dts;
                last=this.points[i];
            }
        }
        resolve({
            points: this.points,
            distance: this.distance,
            numPoints: this.points.length,
            refIdx: refIdx>=0?refIdx:undefined,
            remain: refIdx>=0?remain:undefined,
            pointTime: this.foundPoint!==undefined?new Date(this.foundPoint.ts*1000):undefined,
            pointSpeed: this.foundPoint!== undefined?this.foundPoint.speed:undefined,
            pointCourse: this.foundPoint !== undefined?this.foundPoint.opt_course||this.foundPoint.course:undefined,
            timeErrors: this.hasTimeErrors,
            avgSpeed: avgSpeed,
            startTime: new Date(this.startTime*1000),
            endTime: new Date(this.endTime*1000)
        });
    }
}

export const getInfoForList=(trackPoints,opt_point)=>{
    let trackInfo=new TrackInfo(opt_point);
    return new Promise((resolve,reject)=>{
        trackPoints.forEach((point)=>{
            trackInfo.addPoint(point);
        });
        trackInfo.finalize(resolve,reject);
    })
}

const TrackPointFields=[
    {
        name: 'time',
        target: 'ts',
        convert: (v) => {
            let time = new Date(v);
            return (!isNaN(time)) ? time.getTime() / 1000.0 : undefined
        }
    },
    {
        name: 'speed',
        target: 'speed',
        convert: (v)=>parseFloat(v)
    },
    {
        name: 'course',
        target: 'opt_course',
        convert: (v) => parseFloat(v)
    }
]
export const getTrackInfo = (trackName,opt_point) => {
    if (trackName === 'current'){
        let trackPoints=globalstore.getData(keys.nav.track.currentTrack,[]);
        return getInfoForList(trackPoints,opt_point);
    }
    let trackInfo=new TrackInfo(opt_point);
    return new Promise((resolve, reject) => {
        if (!trackName) reject("missing track name");
        Requests.getHtmlOrText('', {
            useNavUrl: true
        }, {
            request: 'download',
            type: 'track',
            name: trackName
        })
            .then((data) => {
                let doc;
                try {
                    doc = Helper.parseXml(data);
                } catch (e) {
                    reject("exception while parsing track file: " + e);
                    return;
                }
                let gpxs = doc.getElementsByTagName('gpx');
                if (gpxs.length < 1) {
                    reject("no gpx file");
                    return;
                }
                let tracks = gpxs[0].getElementsByTagName('trk');
                if (tracks.length < 1) {
                    reject('no tracks in trackfile');
                    return;
                }
                let track = tracks[0];
                let segments = track.getElementsByTagName('trkseg');
                if (segments.length < 1) {
                    reject('no track segments in trackfile');
                    return;
                }
                for (let sid = 0; sid < segments.length; sid++) {
                    let tpoints = segments[sid].getElementsByTagName('trkpt');
                    for (let pid = 0; pid < tpoints.length; pid++) {
                        let tpoint = tpoints[pid];
                        let lat = tpoint.getAttribute('lat');
                        let lon = tpoint.getAttribute('lon');
                        if (!lat || !lon) {
                            continue;
                        }
                        lon = parseFloat(lon);
                        lat = parseFloat(lat);
                        if (isNaN(lon) || isNaN(lat)) {
                            continue;
                        }
                        let newPoint = new navobjects.TrackPoint(lon, lat,undefined);
                        let validTime = false;
                        TrackPointFields.forEach((field)=>{
                            let fv=tpoint.getElementsByTagName(field.name)[0];
                            if (fv && fv.textContent) {
                                if (field.convert) {
                                    fv = field.convert(fv.textContent);
                                }
                                else{
                                    fv=fv.textContent;
                                }
                            }
                            if (! fv){
                                return;
                            }
                            if (field.name === 'time') validTime=true;
                            newPoint[field.target]=fv;
                        })
                        if (validTime){
                            trackInfo.addPoint(newPoint);
                        }
                        else{
                            trackInfo.hasTimeErrors=true;
                        }
                    }
                }
                trackInfo.finalize(resolve,reject);
            })
            .catch((error) => reject(error))
    })
}

const CONVERT_INFO_ROWS=[
    {label:'points',value:'numPoints'},
    {label:'length',value:'distance',formatter:(v)=>{
            return Formatter.formatDistance(v)+" nm";
        }}
    ];

const AskEditRoute=(props)=>{
    return  <div className="AskEditRouteDialog flexInner">
        <h3 className="dialogTitle">Route Created</h3>
        <div className="dialogRow">
            route &nbsp;<span>{props.route.name}</span>&nbsp; successfully created
        </div>
        <div className="dialogButtons">
            <DB name="cancel">
                Cancel
            </DB>
            <DB name="editRoute"
                onClick={()=>{
                    let editor=new RouteEdit(RouteEdit.MODES.EDIT);
                    editor.setNewRoute(props.route,0);
                    props.history.push('editroutepage',{center:true});
                }}
            >Edit</DB>
        </div>
    </div>
}

const getRowValue=(data,description)=>{
    let v=data[description.value];
    if (v === undefined) return null;
    if (description.formatter){
        v=description.formatter(v,data);
        if (v === undefined) return null;
    }
    return <InfoItem label={description.label} value={v}/>
}

export const TrackConvertDialog=(props)=> {
    const [points,setPoints]=useState([]);
    const [convertedPoints,setConvertedPoints]=useState(props.points);
    const [name,setName]=useState("Track-"+props.name);
    const [loaded,setLoaded]=useState(false);
    const [processing,setProcessing]=useState(false);
    const [currentRoutes,setCurrentRoutes]=useState([]);
    const [maxXte,setMaxXte]=useState(props.maxXte||20);
    const [info,setInfo]=useState({});
    const [originalInfo,setOriginalInfo]=useState({});
    const dialogContext=useDialogContext();
    useEffect(() => {
        getTrackInfo(props.name)
            .then((info) => {
                setPoints(info.points||[])
                setLoaded(true);
                return info.points||[]
            })
            .then((lpoints)=>{
                getInfoForList(lpoints)
                    .then((values)=>{
                        setInfo(values);
                        setOriginalInfo(values);
                    })
                    .catch((error)=>Toast(error));
            })
            .catch((error) => Toast(error));
    }, []);
    useEffect(() => {
        RouteHandler.listRoutes(true)
            .then((routes)=>{
                setCurrentRoutes(routes);
            })
            .catch((error)=>{Toast(error)});
    },[]);
    const existsRoute=useCallback((name)=>{
        if (Helper.getExt(name) !== 'gpx') name+='.gpx';
        for (let i=0;i<currentRoutes.length;i++){
            if (currentRoutes[i].name === name) return true;
        }
        return false;
    },[currentRoutes]);

    const okClicked=useCallback(()=>{
        let rname=name.replace(/\.gpx$/,"");
        let route=new routeobjects.Route(rname);
        let idx=1;
        convertedPoints.forEach((point)=>{
            idx=route.addPoint(idx,point);
            idx++;
        })
        RouteHandler.saveRoute(route,true)
            .then(()=>{
                dialogContext.closeDialog();
                if (mapholder.getCurrentChartEntry()){
                    dialogContext.replaceDialog(()=>{
                        return <AskEditRoute
                            history={props.history}
                            route={route}
                            />
                    })
                }
            })
            .catch((error)=>{
                Toast(error);
            })
    },[name,convertedPoints]);
    const convert=useCallback(()=>{
        let converter=new SimpleRouteFilter(points,false,undefined,maxXte);
        setProcessing(true);
        window.setTimeout(()=>{
            let newPoints=converter.process()
            getInfoForList(newPoints).then((info)=>{
                setInfo(info);
                setConvertedPoints(newPoints);
                setProcessing(false);
            })
        },10);
    },[points,maxXte]);
        let maxroute=props.maxroute||50;
        let currentPoints=info.numPoints||0;
        let existingName=existsRoute(name);
        let displayName=name.replace(/\.gpx$/,'');
        if (! loaded){
            return <DialogFrame className="TrackConvertDialog" title={"Convert Track to Route"}>
                <DialogRow>{"loading "+props.name}</DialogRow>
                <DialogButtons buttonList={[DBCancel()]}></DialogButtons>
            </DialogFrame>
        }
        return  <DialogFrame className="TrackConvertDialog" title={"Convert Track to Route"}>
            <Input
                dialogRow={true}
                label="route name"
                value={displayName}
                onChange={(nv)=>setName(nv+".gpx")}
                />
            {existingName && <div className="warning">Name already exists</div>}
            <div className="originalPoints">
                <div className="heading dialogRow">original points</div>
                {CONVERT_INFO_ROWS.map((row)=>{
                    return getRowValue(originalInfo,row);
                })}
            </div>
            <div className="computedPoints">
                <div className="heading dialogRow">optimized points</div>
                {CONVERT_INFO_ROWS.map((row)=>{
                    return getRowValue(info,row);
                })}
            </div>
            <div className="converter">
                {currentPoints>maxroute &&
                <div className={"warning"}>{`Your track contains more then ${maxroute} points. 
                You should reduce this count by clicking compute below. 
                Potentially you need to enlarge the allowed Xte`}
                </div>}
                <div className="heading dialogRow">converter options</div>
                <Input
                    dialogRow={true}
                    label="max Xte"
                    value={maxXte}
                    onChange={(nv)=>setMaxXte(nv)}
                    />
                <DialogButtons>
                    <DB name="convert"
                        onClick={convert}
                        close={false}
                        >Compute</DB>
                </DialogButtons>
            </div>
            <DialogButtons>
                <DB name={"cancel"}
                >Cancel</DB>
                {existingName?<DB name={"ok"}
                    onClick={okClicked}
                    close={false}
                >Overwrite</DB>:
                <DB name={"ok"}
                    onClick={okClicked}
                    close={false}
                >Save</DB>}
            </DialogButtons>
        </DialogFrame>
}

TrackConvertDialog.propTypes={
    history: PropTypes.object.isRequired,
    name: PropTypes.string.isRequired
}
