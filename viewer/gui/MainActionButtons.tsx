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
import {ButtonEvent, DynamicButtonProps} from "../components/Button";
import keys from "../util/keys";
import globalstore from "../util/globalstore";
import RemoteChannelDialog, {RemoteDialog} from "../components/RemoteChannelDialog";
import Helper, {getav} from "../util/helper";
import FullScreen from "../util/Fullscreen";
import leavehandler from "../util/leavehandler";
import React from "react";
import splitsupport from '../util/splitsupport';
import {exitAndroidApp} from "./MainNav";
import dimhandler from "../util/dimhandler";
import ButtonDefs from "../components/ButtonDefs";
import {IDialogContext} from "../components/DialogContext";
import {showDialog, showPromiseDialog} from "../components/OverlayDialog";
import {AlertDialog, ConfirmDialog} from "../components/BasicDialogs";
import Requests from "../util/requests";
import Toast from "../components/Toast";

export const actionButtons=(): DynamicButtonProps[] => [
    {
        ...ButtonDefs.Night,
        storeKeys: {toggle: keys.properties.nightMode},
        onClick: () => {
            let mode = globalstore.getData(keys.properties.nightMode, false);
            mode = !mode;
            globalstore.storeData(keys.properties.nightMode, mode);
        }
    },
    dimhandler.buttonDef()
    ,
    RemoteChannelDialog({
        onClick: (ev: ButtonEvent) => {
            const dialogContext = getav(ev).dialogContext;
            dialogContext.showDialog(() => <RemoteDialog/>, () => dialogContext.closeDialog());
        },
        close: false
    }),
    FullScreen.fullScreenDefinition(),
    splitsupport.buttonDef({
        overflow: true
    }),
    {
        ...ButtonDefs.ReloadUI,
        storeKeys: {
            visible: keys.gui.global.layoutEditing,
        },
        updateFunction: (state: Record<string, any>) => {
            return {
                visible: !state.visible
            }
        },
        onClick: () => {
            leavehandler.stop();
            Helper.reloadPage();
        }
    },
    {
        ...ShutdownButton,
        close:false,
        onClick:(ev:ButtonEvent)=>{
            const dialogContext=getav(ev).dialogContext;
            shutdownServer(dialogContext ).then(()=>{
                dialogContext.closeDialog();
            },
                ()=>{
                dialogContext.closeDialog();
                })
        }
    },
    {
        ...ButtonDefs.MainExit,
        storeKeys:{
            visible:keys.gui.global.onAndroid
        },
        onClick:()=>{
            exitAndroidApp();
        }
    }
]
export const shutdownServer = (dialogContext?: IDialogContext) => {
    return showPromiseDialog(dialogContext, (props: any) => <ConfirmDialog {...props}
                                                                    text={"really shutdown the server computer?"}/>).then(function () {
        return Requests.getJson({
            request: 'api',
            type: 'command',
            command: 'runCommand',
            name: 'shutdown'
        }).then(
            () => {
                Toast("shutdown started");
            },
            (error: any) => {
                showDialog(dialogContext, () => <AlertDialog
                    text={"unable to trigger shutdown: " + error}/>);
            });

    })
        .catch(() => {
        });
}
export const ShutdownButton = {
    ...ButtonDefs.StatusShutdown,
    storeKeys: {
        visible: keys.gui.capabilities.shutdown,
        connected: keys.gui.global.connectedMode
    },
    updateFunction: (state: Record<string, any>) => {
        return {
            visible: state.visible && state.connected
        }
    }
}