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
import {propsToDefs} from "../components/Button";
import keys from "../util/keys";
// @ts-ignore
import RouteEdit,{StateHelper} from "../nav/routeeditor";
// @ts-ignore
import anchorWatch,{AnchorWatchKeys,isWatchActive} from "../components/AnchorWatchDialog";
// @ts-ignore
import {CenterActionButton} from "../components/FeatureInfoDialog";
// @ts-ignore
import RemoteChannelDialog from '../components/RemoteChannelDialog';
// @ts-ignore
import FullScreen from '../components/Fullscreen';
// @ts-ignore
import Dimmer from '../util/dimhandler';
const activeRoute=new RouteEdit(RouteEdit.MODES.ACTIVE);
export default propsToDefs([
    {
        name:"ZoomIn",
        displayName:"zoom in",
        localOnly: true,
    },
    {
        name:"ZoomOut",
        displayName:"zoom out",
        localOnly: true,
    },
    {
        name:'LockPos',
        localOnly: true,
        displayName:"lock to gps",
        storeKeys:{
            toggle: keys.map.lockPosition
        },
        editDisable:true
    },
    {
        name: "LockMarker",
        displayName:"start wp",
        localOnly: true,
        storeKeys: activeRoute.getStoreKeys(AnchorWatchKeys),
        updateFunction: (state) => {
            return {visible: !StateHelper.hasActiveTarget(state) && !isWatchActive(state)}
        },
        editDisable: true
    },
        anchorWatch(true),
    {
        name: "StopNav",
        displayName:"end nav",
        storeKeys: activeRoute.getStoreKeys(),
        updateFunction:(state)=>{
            return {visible:StateHelper.hasActiveTarget(state)};
        },
        toggle:true,
        editDisable:true
    },
    {
        name: "CourseUp",
        displayName:"course up",
        localOnly:true,
        storeKeys:{
            toggle: keys.map.courseUp
        },
        editDisable:true
    },
    {
        name: "ShowRoutePanel",
        displayName:"edit route",
        overflow: true

    },
    {
        name: "NavOverlays",
        displayName:"edit overlays",
        localOnly:true,
        overflow: true,
        storeKeys:{
            visible:keys.gui.capabilities.uploadOverlays
        }
    },
    {
        name:'GpsCenter',
        displayName:"center to gps",
        localOnly:true,
        overflow: true,
        editDisable: true
    },
    {
        name: 'Night',
        displayName:"night mode",
        storeKeys: {
            toggle: keys.properties.nightMode,
            visible: keys.properties.nightModeNavPage
        },
        overflow: true
    },
    CenterActionButton,
    RemoteChannelDialog({
        overflow:true,
        displayName: 'remote control'
    }),
    FullScreen.fullScreenDefinition,
    Dimmer.buttonDef(),
])
