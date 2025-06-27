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
 */
import React from 'react';
import PropertyHandler from "../util/propertyhandler";
import RequestHandler from "../util/requests";
import {showPromiseDialog} from "./OverlayDialog";
import {ConfirmDialog, SelectDialog} from "./BasicDialogs";
/**
 * will return a promise that reolves to the loaded settings
 * or rejects with undefined of abort - or an error string
 * @param currentValues
 * @param defaultName
 * @param opt_title
 * @param opt_preventDialog
 */
export const loadSettings = (currentValues, defaultName, opt_title, opt_preventDialog) => {
    const setSettings = (checkedValues) => {
        return PropertyHandler.importSettings(checkedValues, currentValues, true);
    }
    let settings=[];
    let selectedEntry=undefined;
    return PropertyHandler.listSettings()
        .then((settingslist)=> {
            settings=settingslist;
            let displayList=[];
            let prefSettings=undefined;
            settingslist.forEach((s)=>{
                let selected=false;
                if (s.name === defaultName){
                    prefSettings=s.name;
                    selected=true;
                }
                displayList.push({label:s.name,value:s.name,selected:selected});
            })
            if (! prefSettings || ! opt_preventDialog) {
                return showPromiseDialog(undefined,(dprops)=><SelectDialog
                    {...dprops}
                    title={opt_title ? opt_title : 'Select Settings to load'}
                    list={displayList}
                />)
                    .then((res)=>res.value)
            }
            else{
                return new Promise((resolve,reject)=>{
                    resolve(prefSettings);
                })
            }
        })
        .then(
            (selected) => {
                settings.forEach((s)=>{
                    if (s.name === selected) selectedEntry=s;
                })
                return RequestHandler.getJson({
                        request: 'download',
                        type: 'settings',
                        noattach: true,
                        name: selected
                    },
                    {
                        checkOk: false
                    }
                )
            },
            (error) => Promise.reject()
        )
        .then(
            (settings) => {
                let replacements;
                if (selectedEntry && selectedEntry.scopePrefix){
                    replacements={prefix:selectedEntry.scopePrefix};
                }
                return PropertyHandler.verifySettingsData(settings, false, false,replacements)
            },
            (error) => Promise.reject(error?"unable to download settings from server: " + error:error)
        )
        .then((result) => {
            if (result.warnings && result.warnings.length) {
                return showPromiseDialog(undefined,(dprops)=><ConfirmDialog {...dprops} text={result.warnings.join('\n')} title={'Import anyway?'}/>)
                    .then(
                        () => setSettings(result.data),
                        () => Promise.reject()
                    )
            } else {
                return setSettings(result.data);
            }
        })

}

export default loadSettings;