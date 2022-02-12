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

import React from 'react';
import PropTypes from 'prop-types';
import DB from "./DialogButton";
import OverlayDialog, {InfoItem} from "./OverlayDialog";
import Requests from '../util/requests';
import Toast from "./Toast";
import Helper from "../util/helper";
import navobjects from "../nav/navobjects";
import NavCompute from "../nav/navcompute";
import Formatter from '../util/formatter';
import assign from 'object-assign';
import globalstore from "../util/globalstore";
import keys from "../util/keys";
import {Input} from "./Inputs";
import SimpleRouteFilter from "../nav/simpleroutefilter";
import navdata from "../nav/navdata";
import routeobjects from "../nav/routeobjects";
import RouteEdit from "../nav/routeeditor";
import mapholder from "../map/mapholder";
import {stateHelper} from "../util/GuiHelpers";

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
            let dts = NavCompute.computeDistance(this.lastPoint, point);
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
        let refIdx;
        let remain=0;
        if (this.refPoint){
            let bestDistance;
            for (let i=0;i<this.points.length;i++){
                let cur=NavCompute.computeDistance(this.refPoint,this.points[i]).dts;
                if (bestDistance === undefined || cur < bestDistance){
                    refIdx=i;
                    bestDistance=cur;
                }
            }
            let last=this.points[refIdx];
            for (let i=refIdx+1;i<this.points.length;i++){
                remain+=NavCompute.computeDistance(last,this.points[i]).dts;
                last=this.points[i];
            }
        }
        resolve({
            points: this.points,
            distance: this.distance,
            numPoints: this.points.length,
            refIdx: refIdx>=0?refIdx:undefined,
            remain: refIdx>=0?remain:undefined,
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
                        let timev = tpoint.getElementsByTagName('time')[0];
                        let validTime = false;
                        if (timev && timev.textContent) {
                            let time = new Date(timev.textContent);
                            if (!isNaN(time)) {
                                newPoint.ts = time.getTime()/1000.0;
                                trackInfo.addPoint(newPoint);
                                validTime = true;
                            }
                        }
                        if (!validTime) trackInfo.hasTimeErrors=true;

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
            <DB name="cancel"
                onClick={props.closeCallback}>
                Cancel
            </DB>
            <DB name="editRoute"
                onClick={()=>{
                    props.closeCallback();
                    let editor=new RouteEdit(RouteEdit.MODES.EDIT);
                    editor.setNewRoute(props.route,0);
                    this.props.history.push('editroutepage',{center:true});
                }}
            >Edit</DB>
        </div>
    </div>
}

export class TrackConvertDialog extends React.Component{
    constructor(props) {
        super(props);
        this.state={
            points:this.props.points,
            convertedPoints:this.props.points,
            routeName: "Track-"+this.props.name,
            loaded:false,
            processing:false,
            routesLoaded:false,
            currentRoutes:[],
            maxXte: props.maxXte||20
        }
        this.info=stateHelper(this,{},'info');
        this.originalInfo=stateHelper(this,{},'originalInfo');
        this.okClicked=this.okClicked.bind(this);
        this.convert=this.convert.bind(this);
    }

    componentDidMount() {
        getInfoForList(this.state.points)
            .then((values)=>{
                this.setState({loaded:true});
                this.info.setState(values,true);
                this.originalInfo.setState(values,true);
            })
            .catch((error)=>Toast(error));
        RouteHandler.listRoutes(true)
            .then((routes)=>{
                this.setState({currentRoutes:routes,routesLoaded:true});
            })
            .catch((error)=>{Toast(error)});
    }
    existsRoute(name){
        if (! this.state.routesLoaded) return false;
        if (Helper.getExt(name) !== 'gpx') name+='.gpx';
        for (let i=0;i<this.state.currentRoutes.length;i++){
            if (this.state.currentRoutes[i].name === name) return true;
        }
        return false;
    }
    getRowValue(data,description){
        let v=data[description.value];
        if (v === undefined) return null;
        if (description.formatter){
            v=description.formatter(v,data);
            if (v === undefined) return null;
        }
        return <InfoItem label={description.label} value={v}/>
    }
    okClicked(){
        let name=this.state.routeName.replace(/\.gpx$/,"");
        let route=new routeobjects.Route(name);
        let idx=1;
        this.state.convertedPoints.forEach((point)=>{
            idx=route.addPoint(idx,point);
            idx++;
        })
        RouteHandler.saveRoute(route,true)
            .then(()=>{
                this.props.closeCallback();
                if (mapholder.getCurrentChartEntry()){
                    OverlayDialog.dialog((props)=>{
                        return <AskEditRoute
                            {...props}
                            route={route}
                            />
                    })
                }
            })
            .catch((error)=>{
                Toast(error);
            })
    }
    convert(){
        let converter=new SimpleRouteFilter(this.state.points,false,undefined,this.state.maxXte);
        this.setState({processing:true});
        window.setTimeout(()=>{
            let newPoints=converter.process()
            getInfoForList(newPoints).then((info)=>{
                this.info.setState(info,true);
                this.setState({convertedPoints: newPoints,processing:false});
            })
        },10);
    }
    render(){
        let maxroute=this.props.maxroute||50;
        let currentPoints=this.info.getValue('numPoints');
        let existingName=this.existsRoute(this.state.routeName);
        let displayName=this.state.routeName.replace(/\.gpx$/,'');
        return  <div className="TrackConvertDialog flexInner">
            <h3 className="dialogTitle">Convert Track to Route</h3>
            <Input
                dialogRow={true}
                label="route name"
                value={displayName}
                onChange={(nv)=>this.setState({routeName:nv+".gpx"})}
                />
            {existingName && <div className="warning">Name already exists</div>}
            <div className="originalPoints">
                <div className="heading dialogRow">original points</div>
                {CONVERT_INFO_ROWS.map((row)=>{
                    return this.getRowValue(this.originalInfo.getState(),row);
                })}
            </div>
            <div className="computedPoints">
                <div className="heading dialogRow">optimized points</div>
                {CONVERT_INFO_ROWS.map((row)=>{
                    return this.getRowValue(this.info.getState(),row);
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
                    value={this.state.maxXte}
                    onChange={(nv)=>this.setState({maxXte:nv})}
                    />
                <div className="dialogButtons">
                    <DB name="convert"
                        onClick={this.convert}
                        >Compute</DB>
                </div>
            </div>
            <div className="dialogButtons">
                <DB name={"cancel"}
                    onClick={this.props.closeCallback}
                >Cancel</DB>
                {existingName?<DB name={"ok"}
                    onClick={this.okClicked}
                >Overwrite</DB>:
                <DB name={"ok"}
                    onClick={this.okClicked}
                >Save</DB>}
            </div>
        </div>
    }
}

TrackConvertDialog.propTypes={
    history: PropTypes.object.isRequired,
    points: PropTypes.array.isRequired,
    name: PropTypes.string.isRequired
}

TrackConvertDialog.showDialog=(history,name,opt_showDialogFunction)=>{
    if (!opt_showDialogFunction){
        opt_showDialogFunction=OverlayDialog.dialog;
    }
    getTrackInfo(name)
        .then((info) => {
            opt_showDialogFunction((props) => {
                return <TrackConvertDialog
                    {...props}
                    history={history}
                    points={info.points} name={name}/>;
            });
        })
        .catch((error) => Toast(error));
}

class TrackInfoDialog extends React.Component{
    constructor(props) {
        super(props);
        this.state={
            points:[],
            loaded:false,
            name:this.props.name
        }
        this.showConvertDialog=this.showConvertDialog.bind(this);
    }

    componentDidMount() {
        getTrackInfo(this.props.name)
            .then((values)=>{
                this.setState(assign({loaded: true},values));
            })
            .catch((error)=>Toast(error));
    }
    showConvertDialog(){
        this.props.closeCallback();
        OverlayDialog.dialog((props)=>{
            return <TrackConvertDialog
                {...props}
                points={this.state.points}
                name={this.props.name}/>
        })
    }
    render(){
       return  <div className="TrackInfoDialog flexInner">
            <h3 className="dialogTitle">Track Info</h3>
            {INFO_ROWS.map((row)=>{
                let v=this.state[row.value];
                if (v === undefined) return null;
                if (row.formatter) v=row.formatter(v,this.state);
                if (v === undefined) return null;
                return <InfoItem label={row.label} value={v}/>
            })}
            <div className="dialogButtons">
                <DB name={"toroute"}
                    onClick={this.showConvertDialog}
                    disabled={!this.state.loaded}
                >
                    Convert</DB>
                <DB name={"cancel"}
                    onClick={this.props.closeCallback}
                >Cancel</DB>
            </div>
        </div>
    }
}

TrackInfoDialog.PropTypes={
    name: PropTypes.string.isRequired
}
TrackInfoDialog.showDialog=(info,opt_showDialogFunction)=>{
    if (!opt_showDialogFunction) {
        opt_showDialogFunction = OverlayDialog.dialog;
    }
    return opt_showDialogFunction((props)=>{
        return <TrackInfoDialog
            {...info}
            {...props}/>
    });
}

export default TrackInfoDialog;