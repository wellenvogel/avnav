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
 * display the infos of a feature
 */

import React from 'react';
import PropTypes from 'prop-types';
import Formatter from '../util/formatter';
import DB from './DialogButton';
import history from "../util/history";
import OverlayDialog from "./OverlayDialog";
const InfoItem=(props)=>{
    return <div className={"dialogRow "+props.className}>
        <span className={"inputLabel"}>{props.label}</span>
        <span className={"itemInfo"}>{props.value}</span>
    </div>
}

const INFO_ROWS=[
    {label:'description',value:'info'},
    {label:'overlay',value:'overlayName'},
    {label: 'position',value:'coordinates',formatter:(v)=>Formatter.formatLonLats({lon:v[0],lat:v[1]})}
];

class FeatureInfoDialog extends React.Component{
    constructor(props) {
        super(props);
        this.linkAction=this.linkAction.bind(this);
    }
    linkAction(){
        if (! this.props.link) return;
        this.props.closeCallback();
        history.push('viewpage',{url:this.props.link});
    }
    render(){
        let link=this.props.link;
        return (
            <div className="FeatureInfoDialog flexInner">
                <h3 className="dialogTitle">
                    {this.props.icon &&
                        <span className="icon" style={{backgroundImage:"url('"+this.props.icon+"')"}}/>
                    }
                    Feature Info
                </h3>
                {INFO_ROWS.map((row)=>{
                    let v=this.props[row.value];
                    if (v === undefined) return null;
                    if (row.formatter) v=row.formatter(v);
                    return <InfoItem label={row.label} value={v}/>
                })}
                <div className={"dialogButtons"}>
                    {link && <DB
                        name="info"
                        onClick={this.linkAction}
                        >Info</DB>}
                    <DB name={"ok"}
                        onClick={this.props.closeCallback}
                        >Ok</DB>
                </div>
            </div>
        );
    }
}

FeatureInfoDialog.propTypes={
    info: PropTypes.string,
    link: PropTypes.string,
    position: PropTypes.array
}

FeatureInfoDialog.showDialog=(info,opt_showDialogFunction)=>{
    if (!opt_showDialogFunction) {
        opt_showDialogFunction = OverlayDialog.dialog;
    }
    return opt_showDialogFunction((props)=>{
            return <FeatureInfoDialog
                {...info}
                {...props}/>
        });
}

export default FeatureInfoDialog;