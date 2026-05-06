/**
 * # Copyright (c) 2012-2025 Andreas Vogel andreas@wellenvogel.net
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
 */
 
import React, {useCallback, useRef, useState} from 'react';
import globalstore from "../util/globalstore";
import keys from "../util/keys";
import {ChildStatus, ChildStatusProps, StatusItem, statusTextToImageUrl} from "./StatusItems";
import {useDialogContext} from "./exports";
import {DialogButtons, DialogFrame, showDialog} from "./OverlayDialog";
import DB from './DialogButton';
import Requests, {prepareUrl} from "../util/requests";
import Toast from "./Toast";
import DownloadButton from "./DownloadButton";
import LogDialog from "./LogDialog";
import ItemList from "./ItemList";
import {useTimer} from "../util/UiHelper";
import EditHandlerDialog from "../components/EditHandlerDialog";
import Helper from "../util/helper";
import ButtonDefs from "./ButtonDefs";

const HANDLER_NAME='AVNImporter';
interface MainStatusProps{
    converter?:ChildStatusProps
    main?:ChildStatusProps;

}
const MainStatus=(props:MainStatusProps)=>{
    const canEdit=globalstore.getData(keys.gui.global.connectedMode);
    const dialogContext=useDialogContext()
    return <div className="status" >
        <StatusItem name={'Converter'}
                    canEdit={true}
                    allowEdit={true}
                    connected={canEdit}
                    showEditDialog={()=>showDialog(
                        dialogContext,
                        ()=><EditHandlerDialog
                            handlerName={HANDLER_NAME}
                            title={"Edit Importer Settings"}
                        />)
                    }
        />
        {props.main && <ChildStatus
            {...props.main}
            name='scanner'
            forceEdit={true}
            sub={true}
            showEditDialog={()=>showDialog(dialogContext,
                ()=><ScannerDialog {...(props.main as ScannerDialogProps)}/>)}
        />}
        {props.converter && <ChildStatus
            {...props.converter}
            connected={true}
            forceEdit={canEdit}
            showEditDialog={()=>showDialog(dialogContext,
            ()=><ConverterDialog {...(props.main as ConverterDialogProps)}/>)}
            sub={true}
        />}
    </div>
}
interface ImporterProps extends ChildStatusProps{
    name:string,
    basename:string,
    realname?:string,
    converter?:string
    className?:string
    selected?:boolean
}
const ImporterItem=(props:ImporterProps)=>{
    if (!props.name || !props.name.match(/^conv:/)) return null;
    const canEdit=globalstore.getData(keys.gui.global.connectedMode);
    const dialogContext=useDialogContext();
    const showEditDialog=useCallback((_handlerId:string|number, _id:string)=> {
                showDialog(dialogContext, () => <ImportStatusDialog
                    {...props}
                />);
    },[]);
    return <div className={Helper.concatsp("status",props.className,props.selected?'activeEntry':undefined)} >
        <ChildStatus
            showEditDialog={showEditDialog}
            {...props}
            forceEdit={canEdit}
            connected={true}
            id={props.name}
            name={props.name.replace(/^conv:/,'')}
        />
        <div className="itemInfo">{props.basename}</div>
        {props.converter &&
            <div className="itemInfo">
                <span className="label">converter:</span>
                <span className="value">{props.converter}</span>
            </div>
        }
        {(props.realname !== undefined) &&
            <div className="itemInfo">
                <span className="label">linked name:</span>
                <span className="value">{props.realname}</span>
            </div>

        }
    </div>
};

interface ImporterStatusDialogProps{
    name:string;
    status:string;
    info?:string;
    basename:string;
    converter?:string;
    canDownload?:boolean;
    hasLog?:boolean;
}
export const ImportStatusDialog=(props:ImporterStatusDialogProps)=>{
    const dialogContext=useDialogContext();
    const isRunning=props.status === 'NMEA';
    return <DialogFrame className="importStatusDialog" title={props.name}>
        <div className="dialogRow">
            <span className="inputLabel"></span>
            <span className="itemInfo">{props.info}</span>
        </div>
        <div className="dialogRow">
            <span className="inputLabel">file</span>
            <span className="itemInfo">{props.basename}</span>
        </div>
        {props.converter &&
            <div className="dialogRow">
                <span className="inputLabel">converter:</span>
                <span className="itemInfo">{props.converter}</span>
            </div>
        }
        <DialogButtons >
            <DB {...ButtonDefs.DBDelete}
                onClick={() => {
                    Requests.getJson({
                        request:'api',
                        type:'import',
                        command:'delete',
                        name:props.name
                    })
                        .then(()=>{
                            dialogContext.closeDialog()
                        })
                        .catch((e:any)=>Toast("unable to delete "+e,5000));
                }}
                close={false}
            />
            {!isRunning && <DB {...ButtonDefs.DBDisable}
                               onClick={() => {
                                   Requests.getJson({
                                       type:'import',
                                       request:'api',
                                       command:'disable',
                                       name: props.name
                                   })
                                       .then(()=>{
                                           dialogContext.closeDialog()
                                       })
                                       .catch((e:any)=>Toast("unable to disable "+e,5000));
                               }}
                               close={false}
            />}
            {isRunning && <DB {...ButtonDefs.DBStop}
                              onClick={() => {
                                  Requests.getJson({
                                      type:'import',
                                      request:'api',
                                      command:'cancel',
                                      name: props.name
                                  })
                                      .then(()=>{
                                          dialogContext.closeDialog()
                                      })
                                      .catch((e:any)=>Toast("unable to stop "+e,5000));
                              }}
                              close={false}
            />}
            {!isRunning && <DB {...ButtonDefs.DBRestart}
                               onClick={() => {
                                   Requests.getJson({
                                       type:'import',
                                       request:'api',
                                       command:'restart',
                                       name: props.name
                                   })
                                       .then(()=>{
                                           dialogContext.closeDialog()
                                       })
                                       .catch((e:any)=>Toast("unable to restart "+e,5000));
                               }}
                               close={false}
            />}
            {props.canDownload && <DownloadButton
                                                  close={false}
                                                  useDialogButton={true}
                                                  url={prepareUrl({
                                                      type:'import',
                                                      command:'download',
                                                      name: props.name
                                                  })}
            >Download</DownloadButton>
            }
            {props.hasLog &&
                <DB {...ButtonDefs.DBLog}
                    onClick={() => {
                        const url= prepareUrl({
                            type: 'import',
                            command:'getlog',
                            name:props.name
                        });
                        dialogContext.replaceDialog((dlprops)=>{
                            return <LogDialog
                                baseUrl={url}
                                title={props.name}
                                {...dlprops}
                            />
                        })
                    }}
                    close={false}
                />
            }
            <DB {...ButtonDefs.DBCancel}/>
        </DialogButtons>
    </DialogFrame>
}

interface ConverterDialogProps {
    status:string;
    info:string;
}

const ConverterDialog=(props:ConverterDialogProps)=>{
    const dialogContext=useDialogContext();
    const isRunning=props.status === 'NMEA';
    return <DialogFrame className="importConverterDialog" title={'Converter'}>
        <div className="dialogRow childStatus">
            <img src={statusTextToImageUrl(props.status)}/>
            <span className="itemInfo">{props.info}</span>
        </div>

        <div className="dialogButtons">
            {isRunning && <DB name="stop"
                              onClick={() => {
                                  Requests.getJson({
                                      type:'import',
                                      request:'api',
                                      command:'cancel'
                                  })
                                      .then(()=>{
                                          dialogContext.closeDialog();
                                      })
                                      .catch((e:any)=>Toast("unable to stop "+e,5000));
                              }}
                              close={false}
            >
                Stop
            </DB>}
            {isRunning &&
                <DB name="log"
                    onClick={() => {
                        const url= prepareUrl({
                            type:'import',
                            command:'getlog',
                            name:'_current'
                        });
                        dialogContext.replaceDialog((dlprops)=>{
                            return <LogDialog
                                baseUrl={url}
                                title={"Converter"}
                                {...dlprops}
                            />
                        })
                    }}
                    close={false}
                >Log</DB>
            }
            <DB name="cancel"
            >Cancel</DB>
        </div>
    </DialogFrame>
}
interface ScannerDialogProps{
    status:string;
    info:string
}
const ScannerDialog=(props:ScannerDialogProps)=>{
    const dialogContext=useDialogContext();
    return <DialogFrame className="importScannerDialog" title={'Scanner'}>
        <div className="dialogRow childStatus">
            <img src={statusTextToImageUrl(props.status)}/>
            <span className="itemInfo">{props.info}</span>
        </div>

        <DialogButtons >
            <DB {...ButtonDefs.DBReload}
                onClick={()=>{
                    Requests.getJson({
                        type:'import',
                        request:'api',
                        command:'rescan'
                    })
                        .then(()=>{
                            dialogContext.closeDialog()
                        })
                        .catch((e:any)=>Toast("unable to trigger rescan "+e,5000));
                }}
                close={false}
            />
            <DB {...ButtonDefs.DBCancel}/>
        </DialogButtons>
    </DialogFrame>
}

export interface ImporterViewProps {
    changeActive?:(b:boolean) => void;
    selected?:string;
}

export const ImporterView = (props:ImporterViewProps) => {
    useDialogContext();
    const [items,setItems]=useState([]);
    const [disabled, setDisabled] = useState(true);
const [mainStatus,setMainStatus]=useState<Record<string,any>>({});
const lastActive=useRef(false);
const [selectedIdx,setSelectedIdx]=useState(-1);
let idx=0;
const handleStatus=(items:any[],error?:boolean)=>{
    const mainStatusr:Record<string,any> = {};
    setItems(items||[]);
    setSelectedIdx(-1);
    (items || []).forEach((st) => {
        if (st.name === 'main' || st.name === 'converter') {
            mainStatusr[st.name] = st;
        }
        if (props.selected && st.basename===props.selected) {
            setSelectedIdx(idx);
        }
        idx++;
    })
    setMainStatus(mainStatusr);
    setDisabled(error)
    const isActive=!error && !!mainStatusr.main;
    if (isActive !== lastActive.current){
        if (props.changeActive) props.changeActive(isActive);
        lastActive.current=isActive;
    }
}
const timer = useTimer((seq) => {
    Requests.getJson({
        request:'api',
        command: 'list',
        type: 'import'
    }).then((json:Record<string,any>) => {
        handleStatus(json.items);
        timer.startTimer(seq);
    })
        .catch(() => {
            handleStatus(undefined,true);
            timer.startTimer(seq)
        })
}, 1000, true);

const isActive=!disabled && !!(mainStatus.main);
if(!isActive) return <div className="importerInfo">Importer inactive</div>;
return <div className="importerView">
    <MainStatus
        {...mainStatus}
    />
    <ItemList
        scrollable={true}
        itemList={items}
        selectedIndex={selectedIdx}
        scrollSelected={selectedIdx}
        itemClass={ImporterItem}
    />
</div>
}