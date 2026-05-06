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
import {DynamicProps} from "../hoc/Dynamic";
import ButtonDefs from "../components/ButtonDefs";
import {ShutdownButton} from "./MainActionButtons";

export default GeneralButtons.concat(propsToDefs([
    {
        ...ButtonDefs.MainInfo,
        overflow:true
    },
    {
        ...ButtonDefs.StatusAll,
        overflow: true
    },
    {
        ...ButtonDefs.StatusWpa,
        localOnly: true,
        overflow:true,
    },
    {
        ...ButtonDefs.StatusAddresses,
        localOnly:true,
        overflow:true,
    },
    {
        ...ButtonDefs.StatusAndroid,
        //@ts-ignore
        visible:!!window.avnavAndroid
    },
    {
        ...ButtonDefs.AndroidBrowser,
        overflow:true,
        //@ts-ignore
        visible:!!window.avnavAndroid
    },
    ShutdownButton,
    {
        ...ButtonDefs.StatusRestart,
        localOnly:true,
    },
    {
        ...ButtonDefs.StatusLog,
        storeKeys:{
            visible: keys.gui.capabilities.log
        },
        overflow: true
    },
    {
        ...ButtonDefs.StatusDebug,
        localOnly:true,
        overflow: true,
        storeKeys:{
            visible: keys.gui.capabilities.debugLevel,
            connected: keys.gui.global.connectedMode
        },
        updateFunction:(state:DynamicProps)=>{
            return {
                visible: state.visible && state.connected,
                connected: undefined
            }
        }
    },
    {
        ...ButtonDefs.StatusAdd,
        localOnly:true,
        visible:false,
    }

]))
