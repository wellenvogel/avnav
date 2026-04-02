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

export default GeneralButtons.concat(propsToDefs([
    {
        name: 'SectionView',
        displayName: 'settings sections',
    },
    {
        name: 'ItemsView',
        displayName: 'list tracks/logs',
    },
    {
        name: 'SettingsLoad',
        storeKeys: {
            editing: keys.gui.global.layoutEditing,
            connected: keys.properties.connectedMode,
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
        storeKeys: {
            editing: keys.gui.global.layoutEditing,
            connected: keys.properties.connectedMode,
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
        name: 'SettingsReload',
        storeKeys: {
            visible: keys.gui.global.layoutEditing,
        },
        updateFunction: (state: Record<string, any>) => {
            return {
                visible: !state.visible
            }
        },
    },
    {
        name: 'DownloadPageUpload',
        displayName: 'import',
        localOnly: true,
    },
    {
        name: 'SettingsSplitReset',
        storeKeys: {
            editing: keys.gui.global.layoutEditing
        },
        updateFunction: (state: Record<string, any>) => {
            return {visible: !state.editing && localStorageManager.hasPrefix()}
        },
    },
    {
        name: 'SettingsAddons',
        storeKeys: {
            visible: keys.properties.connectedMode
        }
    },
]))

