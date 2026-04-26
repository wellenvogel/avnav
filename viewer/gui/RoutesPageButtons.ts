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
import GeneralButtons, {Connected} from "./GeneralButtons";
import {propsToDefs} from "../components/Button";
import keys from "../util/keys";
import {DynamicProps} from "../hoc/Dynamic";
import {iconClasses} from '../components/Icons';

export default GeneralButtons.concat(propsToDefs([
    {
        name:'StatusAdd',
        iconClass: iconClasses.Plus,
        displayName:'new route',
        storeKeys: {
            upload: keys.gui.capabilities.uploadRoute,
            connected: keys.gui.global.connectedMode
        },
        updateFunction:(state:DynamicProps)=>{
            return {
                disabled: !state.upload && state.connected,
                connected: undefined
            }
        }
    },
    {
        name: 'SyncRoutes',
        displayName:'sync to server',
        iconClass: iconClasses.Sync,
        overflow: true,
        editDisable: true,
        storeKeys: {
            enabled: keys.gui.global.connectedMode,
            visible: keys.gui.capabilities.uploadRoute
        },
        updateFunction:(state)=>{
            return {
                disabled: !state.enabled,
                visible: state.visible
            }
        },
    },
    Connected,
    {
        name:'ServerView',
        iconClass: iconClasses.Server,
        displayName: 'server settings',
    },
    {
        name:'ItemsView',
        iconClass: iconClasses.Items,
        displayName: 'stored routes',
    },
    {
        name:'DownloadPageUpload',
        iconClass: iconClasses.Upload,
        displayName: 'import',
        localOnly:true,
        storeKeys: {
            upload: keys.gui.capabilities.uploadRoute,
            connected: keys.gui.global.connectedMode
        },
        updateFunction:(state:DynamicProps)=>{
            return {
                disabled: !state.upload && state.connected,
                connected: undefined
            }
        }

    },
    {
        name: 'ShowSettings',
        iconClass: iconClasses.Settings,
        displayName:'display settings'
    }
]))

