/**
 * Created by andreas on 02.05.14.
 */


import Button from '../components/Button';
import React, {useCallback, useEffect, useState} from 'react';
import {PageFrame, PageLeft, PageProps} from '../components/Page';
import Requests from '../util/requests';
import keys from '../util/keys';
import globalStore from '../util/globalstore';
import PropertyHandler from '../util/propertyhandler';
import LayoutHandler from "../util/layouthandler";
import Toast from "../components/Toast";
import LocalStorage, {STORAGE_NAMES} from '../util/localStorageManager';
import Helper from "../util/helper";
import base from "../base";

import {loadSettings, LoadSettingsDialog} from "../components/Settings";
import {useDialogContext} from "../components/exports";
import {useHistory} from "../components/HistoryProvider";
import {getPageTitle, PAGEIDS} from "../util/pageids";
import ButtonList from "../components/ButtonList";

const WarningPage = (props: PageProps) => {
    const dialogContext = useDialogContext();
    const history = useHistory();
    const [warning, setWarning] = useState("");
    const gotoNav=()=>{
        history.replace(PAGEIDS.NAV,{initial:true});
    }
    useEffect(() => {
        Requests.getHtmlOrText('warning.html').then((text) => setWarning(text));
    }, []);

    const okFunction = useCallback(() => {
        if (LocalStorage.hasStorage()) {
            LocalStorage.setItem(STORAGE_NAMES.LICENSE, undefined, "true");
        }
        const prefSettings = Helper.getParam("defaultSettings");
        PropertyHandler.listSettings()
            .then(
                (settings) => {
                    if (prefSettings && settings && settings.length > 0) {
                        try {
                            for (let i = 0; i < settings.length; i++) {
                                if (settings[i].name.match(prefSettings)) {
                                    //if we found a matching setting, just load this one without dialog
                                    return loadSettings(
                                        {
                                            name: settings[i].name,
                                            scope: settings[i].scope,
                                            dialogContext: dialogContext,
                                        })
                                }
                            }
                        } catch (e) {
                            base.log("unable to check for preferred settings: " + e);
                        }
                    }
                    if (settings && settings.length > 1) {
                        dialogContext.showDialog(() => <LoadSettingsDialog
                            force={true}
                            title={'Select initial settings to load'}
                        />,()=>{
                            gotoNav();
                        })
                            .then(() => {
                            })

                    } else {
                        return Promise.reject();
                    }
                },
                (error) => {
                    return Promise.reject(error);
                })
            .then((values) => {
                if (values) {
                    if (values[keys.properties.layoutName] !== globalStore.getData(keys.properties.layoutName)) {
                        if (!LayoutHandler.hasLoaded(values[keys.properties.layoutName])) {
                            Promise.reject("layout not loaded, cannot activate it");
                            return 0;
                        }
                        LayoutHandler.activateLayout();
                    }
                    globalStore.storeMultiple(values);
                    return 0;
                }
                return 1;
            })
            .then((r    ) => {
                if (r == 0) gotoNav();
            })
            .catch((e) => {
                if (e) Toast(e);
                gotoNav();
            })
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
                        ></Button>
                    </div>
                </div>
            </PageLeft>
            <ButtonList itemList={[
                {
                    name: 'Cancel',
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