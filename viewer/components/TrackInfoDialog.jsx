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
import OverlayDialog from "./OverlayDialog";
import Requests from '../util/requests';
import Toast from "./Toast";
import Helper from "../util/helper";
import navobjects from "../nav/navobjects";
import NavCompute from "../nav/navcompute";
import Formatter from '../util/formatter';
import assign from 'object-assign';

const InfoItem=(props)=>{
    return <div className={"dialogRow "+props.className}>
        <span className={"inputLabel"}>{props.label}</span>
        <span className={"itemInfo"}>{props.value}</span>
    </div>
}

export const INFO_ROWS=[
    {label:'name',value:'name'},
    {label:'points',value:'numPoints'},
    {label:'length',value:'distance',formatter:(v)=>{
        return Formatter.formatDistance(v)+" nm";
        }},
    {label:'average',value:'avgSpeed', formatter:(v)=>{
        return Formatter.formatSpeed(v)+" kn";
        }},
    {label:'start',value:'startTime',formatter:(v)=>Formatter.formatDateTime(v)},
    {label:'end',value:'endTime',formatter:(v)=>Formatter.formatDateTime(v)},
    ];

export const getTrackInfo = (trackName) => {
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
                let points = [];
                let distance = 0;
                let lastPoint = undefined;
                let startTime = undefined;
                let endTime = undefined;
                let hasTimeErrors = false;
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
                        let newPoint = new navobjects.Point(lon, lat);
                        let timev = tpoint.getElementsByTagName('time')[0];
                        let validTime = false;
                        if (timev && timev.textContent) {
                            let time = new Date(timev.textContent);
                            if (!isNaN(time)) {
                                newPoint.time = time;
                                validTime = true;
                                if (startTime === undefined || time.getTime() < startTime.getTime()) {
                                    startTime = time;
                                }
                                if (endTime === undefined || time.getTime() > endTime.getTime()) {
                                    endTime = time;
                                }
                            }
                        }
                        if (!validTime) hasTimeErrors = true;
                        points.push(newPoint);
                        if (lastPoint) {
                            let dts = NavCompute.computeDistance(lastPoint, newPoint);
                            distance += dts.dts;
                        }
                        lastPoint = newPoint;
                    }
                }
                if (points.length < 2) {
                    reject("no points parsed from track");
                    return;
                }
                let avgSpeed = undefined;
                let MINDIFF = 1000;//ms
                if (endTime && startTime && endTime.getTime() > (startTime.getTime() + MINDIFF)) {
                    avgSpeed = distance / (endTime.getTime() - startTime.getTime()) * 1000; //m/s
                }
                resolve({
                    points: points,
                    distance: distance,
                    numPoints: points.length,
                    timeErrors: hasTimeErrors,
                    avgSpeed: avgSpeed,
                    startTime: startTime,
                    endTime: endTime
                });
            })
            .catch((error) => reject(error))
    })
}
class TrackInfoDialog extends React.Component{
    constructor(props) {
        super(props);
        this.state={
            points:[],
            loaded:false,
            name:this.props.name
        }
    }

    componentDidMount() {
        getTrackInfo(this.props.name)
            .then((values)=>{
                this.setState(assign({loaded: true},values));
            })
            .catch((error)=>Toast(error));
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