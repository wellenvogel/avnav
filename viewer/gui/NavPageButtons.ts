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
import Dimmer from '../util/dimhandler';
import GeneralButtons from "./GeneralButtons";
import ButtonDefs from "../components/ButtonDefs";
const activeRoute=new RouteEdit(RouteEdit.MODES.ACTIVE);
export default GeneralButtons.concat(propsToDefs([
    {
        ...ButtonDefs.NavOverlays,
    },
    {
        ...ButtonDefs.ZoomIn,
        localOnly: true,
    },
    {
        ...ButtonDefs.ZoomOut,
        localOnly: true,
    },
    {
        ...ButtonDefs.LockPos,
        localOnly: true,
        storeKeys:{
            toggle: keys.map.lockPosition
        },
        editDisable:true
    },
    {
        ...ButtonDefs.LockMarker,
        localOnly: true,
        storeKeys: activeRoute.getStoreKeys(AnchorWatchKeys),
        updateFunction: (state) => {
            return {visible: !StateHelper.hasActiveTarget(state) && !isWatchActive(state)}
        },
        editDisable: true
    },
        anchorWatch(true),
    {
        ...ButtonDefs.StopNav,
        storeKeys: activeRoute.getStoreKeys(),
        updateFunction:(state)=>{
            return {visible:StateHelper.hasActiveTarget(state)};
        },
        toggle:true,
        editDisable:true
    },
    {
        ...ButtonDefs.CourseUp,
        localOnly:true,
        storeKeys:{
            toggle: keys.map.courseUp
        },
        editDisable:true
    },
    {
        ...ButtonDefs.ShowRoutePanel,
        overflow: true

    },
    {
        ...ButtonDefs.GpsCenter,
        localOnly:true,
        overflow: true,
        editDisable: true
    },
    CenterActionButton,
    Dimmer.buttonDef(),
]))
