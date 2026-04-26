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
import GeneralButtons from "./GeneralButtons";
import {propsToDefs} from "../components/Button";
import keys from "../util/keys";
import localStorageManager from "../util/localStorageManager";
import {DynamicProps} from "../hoc/Dynamic";
import {iconClasses} from '../components/Icons';

export default GeneralButtons.concat(propsToDefs([
    {
        name: 'SectionView',
        iconClass: iconClasses.Section,
        displayName: 'settings sections',
    },
    {
        name: 'ItemsView',
        iconClass: iconClasses.Items,
        displayName: 'stored settings',
    },
    {
        name: 'SettingsDefaults',
        iconClass: iconClasses.Reset,
        displayName: 'reset to defaults',

    },
    {
        name: 'SettingsLoad',
        displayName: 'load settings',
        iconClass: iconClasses.Open,
        storeKeys: {
            editing: keys.gui.global.layoutEditing,
            connected: keys.gui.global.connectedMode,
            allowed: keys.gui.capabilities.uploadSettings
        },
        updateFunction: (state: Record<string, any>) => {
            return {
                visible: !state.editing && state.connected && state.allowed
            }
        },
        overflow: true
    },
    {
        name:'SettingsSave',
        displayName: 'save settings',
        iconClass: iconClasses.Save,
        storeKeys: {
            editing: keys.gui.global.layoutEditing,
            connected: keys.gui.global.connectedMode,
            allowed: keys.gui.capabilities.uploadSettings
        },
        updateFunction: (state: Record<string, any>) => {
            return {
                visible: !state.editing && state.connected && state.allowed
            }
        },
        overflow: true
    },
    {
        name: 'DownloadPageUpload',
        iconClass: iconClasses.Upload,
        displayName: 'import',
        localOnly: true,
        storeKeys:{
            visible: keys.gui.capabilities.uploadSettings,
            connected: keys.gui.global.connectedMode,
        },
        updateFunction:(state:DynamicProps)=>{
            return {
                visible: state.visible & state.connected,
                connected: undefined
            }
        }

    },
    {
        name: 'SettingsSplitReset',
        iconClass: iconClasses.SplitReset,
        displayName: 'reset split settings',
        storeKeys: {
            editing: keys.gui.global.layoutEditing
        },
        updateFunction: (state: Record<string, any>) => {
            return {visible: !state.editing && localStorageManager.hasPrefix()}
        },
    }
]))

