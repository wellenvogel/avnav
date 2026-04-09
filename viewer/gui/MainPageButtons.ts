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
import {propsToDefs, updateButtons} from "../components/Button";
import keys from "../util/keys";
import LayoutHandler from '../util/layouthandler';
// @ts-ignore
import RemoteChannelDialog from '../components/RemoteChannelDialog';
import FullScreen from '../util/Fullscreen';
// @ts-ignore
import splitsupport from '../util/splitsupport';
import GeneralButtons, {Connected} from "./GeneralButtons";

export default updateButtons(GeneralButtons.concat(propsToDefs([
    {
        name: 'ShowStatus',
        displayName: 'status',
        editDisable: true
    },
    {
        name: 'ShowDownload',
        displayName: 'download',
        editDisable: true,
        overflow: true
    },
    Connected,
    {
        name: 'ShowGps',
        displayName: 'dashboard',
    },
    {
        name: 'Night',
        displayName: 'night mode',
        storeKeys: {toggle: keys.properties.nightMode},
    },
    LayoutHandler.revertButtonDef(),

    {
        name: 'NavOverlays',
        displayName: 'overlays',
        editDisable: true,
        overflow: true,
        storeKeys: {
            visible: keys.gui.capabilities.uploadOverlays,
            connected: keys.properties.connectedMode
        },
        updateFunction: (state)=>{
            return {
                visible: state.visible && state.connected
            }
        }
    },
    RemoteChannelDialog({overflow:true}),
    FullScreen.fullScreenDefinition,
    splitsupport.buttonDef({overflow:true}),

])),{
    Cancel:{
        //@ts-ignore
        visible:!!window.avnavAndroid
    }
});
