/**
 * Created by andreas on 02.05.14.
 */

import {useStore, useStoreState} from '../hoc/Dynamic';
import keys from '../util/keys';
import React, {useEffect, useRef} from 'react';
import {PageBaseProps, PageFrame, PageLeft} from '../components/Page';
import Toast from '../components/Toast';
// @ts-ignore
import Requests, {prepareUrl} from '../util/requests';
import {DBCancel, DBOk, DialogButtons, DialogFrame, showDialog, showPromiseDialog} from '../components/OverlayDialog';
import {createAddDialog} from "../components/EditHandlerDialog";
import {Checkbox, Input} from "../components/Inputs";
import LogDialog from "../components/LogDialog";
import Helper from "../util/helper";
import {ConfirmDialog} from "../components/BasicDialogs";
import {useDialogContext} from '../components/DialogContext';
import ButtonList from '../components/ButtonList';
import {PAGEIDS} from "../util/pageids";
import StatusView, {ChannelKinds} from "../components/StatusView";
import {useHistory} from "../components/HistoryProvider";
import {ButtonDef, updateButtons} from "../components/Button";
import ServerPageButtons from "./ServerPageButtons";
import {InjectMainMenu, useInitialButton} from "./MainNav";
import {ShutdownButton, shutdownServer} from "./MainActionButtons";
import ButtonDefs from "../components/ButtonDefs";

interface DebugDialogProps{
    title?: string;

}
const DebugDialog=(props:DebugDialogProps)=> {
    const [isDebug,setDebug]=React.useState(false);
    const [pattern,setPattern]=React.useState('');
    const [timeout,setTimeout]=React.useState(60);
    const dialogContext=useDialogContext();
    useEffect(()=> {
        Requests.getJson({
            request: 'api',
            type: 'config',
            command: 'currentLogLevel'
        })
            .then((data:any) => {
                setDebug(data.level && data.level.match(/debug/i));
                setPattern(data.filter || '');
            })
            .catch((e:any) => Toast(e))
    },[]);

    const save=()=> {
        Requests.getJson({
            request: 'api',
            type: 'config',
            command: 'loglevel',
            level: isDebug ? 'debug' : 'info',
            timeout: timeout,
            filter: pattern || ''
        })
            .then(() => dialogContext.closeDialog())
            .catch((e:any) => Toast(e));
    }
        return <DialogFrame className="selectDialog DebugDialog" title={props.title||'Enable/Disable Debug'}>
            <Checkbox
                dialogRow={true}
                label={'debug'}
                value={isDebug}
                onChange={(nv:boolean)=>setDebug(nv)}
                />
            <Input
                type={'number'}
                label={'timeout(s)'}
                dialogRow={true}
                value={timeout}
                onChange={(nv:number)=>setTimeout(nv)}/>
            <Input
                label={'pattern'}
                dialogRow={true}
                value={pattern}
                onChange={(nv:string)=>setPattern(nv)}/>
            <DialogButtons buttonList={[
                DBCancel(),
                DBOk(()=>save())
                ]}/>
        </DialogFrame>
}





const restartServer=()=> {
    showPromiseDialog(undefined, (props: any) => <ConfirmDialog
        {...props}
        text={"really restart the AvNav server software?"}/>)
        .then(() => {
            Requests.getJson({
                request: 'api',
                type: 'config',
                command: 'restartServer'
            })
                .then(() => Toast("restart triggered"))
                .catch((e: any) => Toast(e))
        })
        .catch(() => {
        })
}

const ServerPage = (iprops: PageBaseProps) => {
    const history = useHistory();
    const props = useStore(iprops, {
        storeKeys: {
            connected: keys.gui.global.connectedMode,
            android: keys.gui.global.onAndroid,
            config: keys.gui.capabilities.config,
            log: keys.gui.capabilities.log,
            debugLevel: keys.gui.capabilities.debugLevel
        }
    });
    const [showAll, setShowAll] = React.useState(false);
    const [hasAddresses, setHasAddresses] = React.useState(false);
    const [serverError, setServerError] = React.useState(0);
    const [wpa, setWpa] = React.useState(false);
    const [focusId, setFocusId] = React.useState<string | number>();
    const currentButtons = useRef<ButtonDef[]>();
    useStoreState(keys.gui.global.reloadSequence);
    const buttonConfig = {
        [ButtonDefs.StatusWpa.name]: {
            visible: wpa && props.connected,
            onClick: () => {
                history.push(PAGEIDS.WPA);
            }
        },
        [ButtonDefs.StatusAddresses.name]: {
            visible: hasAddresses,
            onClick: () => {
                history.push(PAGEIDS.ADDR);
            }
        },
        [ButtonDefs.StatusAndroid.name]: {
            onClick: () => { // @ts-ignore
                window.avnavAndroid.showSettings();
            }
        },
        [ButtonDefs.AndroidBrowser.name]: {
            visible: props.android && hasAddresses,
            onClick: () => { // @ts-ignore
                window.avnavAndroid.launchBrowser();
            }
        },
        [ButtonDefs.MainInfo.name]: {
            onClick: () => {
                history.push(PAGEIDS.INFO)
            },
        },
        [ShutdownButton.name]: {
            //visible: !props.android && shutdown && props.connected,
            onClick: () => {
                shutdownServer();
            }

        },
        [ButtonDefs.StatusRestart.name]: {
            onClick: () => restartServer()
        },
        [ButtonDefs.StatusLog.name]: {
            onClick: () => {
                showDialog(undefined, (props: any) => {
                    return <LogDialog
                        {...props}
                        baseUrl={prepareUrl({
                            type: 'config',
                            command: 'download',
                        })}
                        title={'AvNav Log'}
                    />
                });
            },
        },
        [ButtonDefs.StatusDebug.name]: {
            onClick: () => {
                showDialog(undefined, DebugDialog);
            },
        },
        [ButtonDefs.StatusAdd.name]: {
            visible: props.config && props.connected && showAll,
            onClick: () => {
                createAddDialog((id: string | number) => setFocusId(id));
            }
        },
        Cancel: {
            onClick: () => {
                history.pop()
            }
        },
        [ButtonDefs.StatusAll.name]: {
            toggle: showAll,
            onClick: () => {
                setShowAll(!showAll);
            },
        }
    };
    currentButtons.current = InjectMainMenu(
        PAGEIDS.SERVER
        ,updateButtons(ServerPageButtons, buttonConfig));
    useInitialButton(currentButtons)
    const className = Helper.concatsp(props.className,
        (serverError > 4) ? "serverError" : undefined);
    const title="Server"+(showAll?" [All]":"");
    return (
        <PageFrame id={PAGEIDS.SERVER} className={className}>
            <PageLeft id={PAGEIDS.SERVER} title={serverError ? "Server Connection lost" : title}>
                <StatusView
                    focusItem={focusId}
                    allowEdit={true}
                    kinds={showAll?undefined:[ChannelKinds.OTHER]}
                    callback={(handlerList?: any[]) => {
                        if (!handlerList) {
                            setServerError((old) => old + 1)
                            return;
                        } else {
                            setServerError(0);
                        }
                        for (const handler of handlerList) {
                            if (handler.properties && handler.properties.addresses) {
                                setHasAddresses(true);
                            }
                            if (handler.configname === "AVNWpaHandler") {
                                setWpa(true);
                            }
                        }
                    }}
                ></StatusView>
            </PageLeft>
            <ButtonList page={PAGEIDS.SERVER} itemList={currentButtons.current}></ButtonList>
        </PageFrame>

    )
};

export default ServerPage