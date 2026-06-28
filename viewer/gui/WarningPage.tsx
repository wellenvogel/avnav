/**
 * Created by andreas on 02.05.14.
 */


import Button from '../components/Button';
import React, {useCallback, useEffect, useState} from 'react';
import {PageFrame, PageLeft, PageProps} from '../components/Page';
import Requests from '../util/requests';
import keys from '../util/keys';
import PropertyHandler from '../util/propertyhandler';
import LocalStorage, {STORAGE_NAMES} from '../util/localStorageManager';
import Helper from "../util/helper";
import base from "../base";

import {loadSettings, LoadSettingsDialog, SelectLayoutDialog} from "../components/Settings";
import {useDialogContext} from "../components/exports";
import {useHistory} from "../components/HistoryProvider";
import {getPageTitle, PAGEIDS} from "../util/pageids";
import ButtonList from "../components/ButtonList";
import ButtonDefs from "../components/ButtonDefs";
import {IDialogContext} from "../components/DialogContext";
import {IHistory} from "../util/history";

const loadSettingsOrLayouts=async (dialogContext:IDialogContext,history:IHistory) => {
    const gotoNav=()=>{
        history.replace(PAGEIDS.NAV,{initial:true});
    }
    const prefSettings = Helper.getParam("defaultSettings");
    const settings = await PropertyHandler.listSettings();
    let selectLayout=true;
    let hasLoaded=false;
    if (settings && settings.length > 0) {
        try {
            for (let i = 0; i < settings.length; i++) {
                const match= prefSettings && settings[i].name.match(prefSettings);
                if (match || settings.length === 1) {
                    if (match) selectLayout = false;
                    //if we found a matching setting or there is just one setting just load this one without dialog
                    await loadSettings(
                        {
                            name: settings[i].name,
                            scope: settings[i].scope,
                            dialogContext: dialogContext,
                        })
                    hasLoaded = true;
                    if (!selectLayout) {
                        gotoNav();
                        return;
                    }
                    break;
                }
            }
        } catch (e) {
            base.log("unable to check for preferred settings: " + e);
        }
    }
    if (settings && settings.length > 1 && !hasLoaded) {
        await dialogContext.showDialog(() => <LoadSettingsDialog
            force={true}
            title={'Select initial settings to load'}
        />, () => {
            gotoNav();
        })
        return;
    }
    //only default settings, select the layout
    await dialogContext.showDialog(()=><SelectLayoutDialog
        allowUnchanged={true}
        okCallback={() => gotoNav()}
        noEdit={true}
        title={'Select Layout to use'}
    />);
}

const WarningPage = (props: PageProps) => {
    const dialogContext = useDialogContext();
    const history = useHistory();
    const [warning, setWarning] = useState("");

    useEffect(() => {
        Requests.getHtmlOrText('warning.html').then((text) => setWarning(text));
    }, []);

    const okFunction = useCallback(() => {
        if (LocalStorage.hasStorage()) {
            LocalStorage.setItem(STORAGE_NAMES.LICENSE, undefined, "true");
        }
        loadSettingsOrLayouts(dialogContext,history).then(() => {});
    }, []);

    return (
        <PageFrame id={props.id}>
            <PageLeft
                id={props.id}
                title={getPageTitle(props.id)}>
                <div className="listContainer scrollable">
                    <div className="warningFrame">
                        <div className="warningText" dangerouslySetInnerHTML={{__html: warning}}>
                        </div>
                    </div>
                    <div className="warningButtonContainer">
                        <Button
                            name="WarningOK"
                            onClick={() => {
                                okFunction()
                            }
                            }
                        ><span className={'buttonText'}>Accept/Akzeptieren</span> </Button>
                    </div>
                </div>
            </PageLeft>
            <ButtonList itemList={[
                {
                    ...ButtonDefs.MainExit,
                    storeKeys: {visible: keys.gui.global.onAndroid},
                    onClick: () => {
                        // @ts-ignore
                        window.avnavAndroid.goBack()
                    }

                }
            ]}/>
        </PageFrame>
    );
}

export default WarningPage;