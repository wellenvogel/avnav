/**
 *###############################################################################
 # Copyright (c) 2012-2021 Andreas Vogel andreas@wellenvogel.net
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
 #  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 #  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 #  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 #  DEALINGS IN THE SOFTWARE.
 #
 ###############################################################################
 * dialog for log file display
 */
import React from "react";
import Requests from "../util/requests";
import Toast from "./Toast";
import DB from "./DialogButton";
import Formatter from "../util/formatter";
import PropTypes from 'prop-types';
import GuiHelpers from "../util/GuiHelpers";

export default class LogDialog extends React.Component{
    constructor(props) {
        super(props);
        this.state={
            log:undefined,
            loading: true,
            autoreload: props.autoreload
        };
        this.downloadFrame=null;
        this.mainref=null;
        this.getLog=this.getLog.bind(this);
        this.timer=new GuiHelpers.lifecycleTimer(this,(seq)=>{
            if (this.state.autoreload){
                this.getLog().then(()=>this.timer.startTimer(seq));
                return;
            }
            this.timer.startTimer(seq);
        },5000,true)
    }
    componentDidMount() {
        this.getLog().then(()=>{})
    }
    componentDidUpdate(prevProps, prevState, snapshot) {
        if (this.mainref) {
            this.mainref.scrollTop = this.mainref.scrollHeight
        }
    }

    getLog(){
        return Requests.getHtmlOrText(this.props.baseUrl, {useNavUrl:false},{
            maxBytes:this.props.maxBytes||500000
        })
            .then((data)=>{
                this.setState({log:data});
                return data;
            })
            .catch((e)=>Toast(e))
    }
    render(){
        return <div className="selectDialog LogDialog">
            <h3 className="dialogTitle">{this.props.title||'AvNav log'}</h3>
            <div className="logDisplay dialogRow" ref={(el)=>this.mainref=el}>
                {this.state.log||''}
            </div>
            <div className="dialogButtons">
                <DB name="autoreload"
                    onClick={()=>
                        this.setState((old)=>{
                        return {autoreload:!old.autoreload};
                        })
                    }
                    toggle={this.state.autoreload}
                >Auto</DB>
                <DB
                    name="download"
                    onClick={()=>{
                        let name=this.props.dlname?this.props.dlname:"avnav-"+Formatter.formatDateTime(new Date()).replace(/[: /]/g,'-').replace(/--/g,'-')+".log";
                        let url=this.props.baseUrl+"&filename="+encodeURIComponent(name);
                        if (this.downloadFrame){
                            this.downloadFrame.src=url;
                        }
                    }}
                >
                    Download
                </DB>
                <DB name="reload"
                    onClick={this.getLog}>
                    Reload
                </DB>
                <DB
                    name="ok"
                    onClick={this.props.closeCallback}
                >
                    Ok
                </DB>
            </div>
            <iframe
                className="downloadFrame"
                onLoad={(ev)=>{
                    let txt=ev.target.contentDocument.body.textContent;
                    if (! txt) return;
                    Toast(txt);
                }}
                src={undefined}
                ref={(el)=>this.downloadFrame=el}/>
        </div>
    }
}

LogDialog.propTypes={
    baseUrl: PropTypes.string.isRequired,
    title: PropTypes.string,
    maxBytes: PropTypes.number,
    dlname:PropTypes.string,
    autoreload: PropTypes.bool
}