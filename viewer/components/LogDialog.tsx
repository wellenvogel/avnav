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
import React, {useEffect, useRef, useState} from "react";
// @ts-ignore
import Requests from "../util/requests";
import Toast from "./Toast";
import DB from "./DialogButton";
// @ts-ignore
import Formatter from "../util/formatter";
import {useTimer} from "../util/UiHelper";
// @ts-ignore
import {DialogButtons, DialogFrame} from "./OverlayDialog";
import DownloadButton from "./DownloadButton";
export interface LogDialogProps{
    baseUrl: string;
    title?: string;
    maxBytes?: number;
    dlname?:string;
    autoreload?: boolean;
}
const LogDialog=(props:LogDialogProps)=> {
    const [log,setLog]=useState();
    const [autoreload,setAutoReload]=useState(props.autoreload);
    const mainref=useRef<HTMLDivElement>();
    const timer= useTimer((seq)=> {
        if (autoreload) {
            getLog().then(() => timer.startTimer(seq));
            return;
        }
        timer.startTimer(seq)
    },5000,true);
    useEffect(() => {
        getLog().then(()=>{},()=>{});
    }, []);
    useEffect(() => {
        if (mainref.current) {
            mainref.current.scrollTop = mainref.current.scrollHeight
        }
    });
    const getLog=()=>{
        return Requests.getHtmlOrText(props.baseUrl, {useNavUrl:false},{
            maxBytes:props.maxBytes||500000
        })
            .then((data:any)=>{
                setLog(data);
                return data;
            })
            .catch((e:any)=>Toast(e))
    }
    return <DialogFrame className="selectDialog LogDialog" title={props.title||'AvNav log'}>
            <div className="logDisplay dialogRow" ref={mainref}>
                {log||''}
            </div>
            <DialogButtons>
                <DB name="autoreload"
                    close={false}
                    onClick={()=>
                        setAutoReload((old)=>!old)
                    }
                    toggle={autoreload}
                >Auto</DB>
                <DownloadButton
                    name={"download"}
                    useDialogButton={true}
                    url={()=>{
                        const name=props.dlname?props.dlname:"avnav-"+Formatter.formatDateTime(new Date()).replace(/[: /]/g,'-').replace(/--/g,'-')+".log";
                        return props.baseUrl+"&filename="+encodeURIComponent(name);
                    }}
                    close={false}
                >
                    Download
                </DownloadButton>
                <DB name="reload"
                    close={false}
                    onClick={getLog}>
                    Reload
                </DB>
                <DB
                    name="ok"
                >
                    Ok
                </DB>
            </DialogButtons>
        </DialogFrame>
}

export default LogDialog;