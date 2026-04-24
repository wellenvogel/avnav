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
import {DynamicButtonProps, propsToDefs} from "../components/Button";
import layouthandler from "../util/layouthandler";
// @ts-ignore
import AnchorWatchButton from '../components/AnchorWatchDialog';
import {RawButtonDef as EditPageButton} from "../components/EditPageDialog";
import Dimmer from '../util/dimhandler';
import keys from "../util/keys";

export default ()=>{
    const num=layouthandler.getDashboardNum();
    const btProps:DynamicButtonProps[]=[
        {
            name:'Cancel',
            displayName:'go back',
            localOnly: true
        },
        AnchorWatchButton(),
    ];
    for (let idx=1;idx<=num;idx++){
        btProps.push({
            name:'Gps'+idx,
            overflow:true,
            displayName:`dashboard ${idx}`,
            storeKeys: {
                pageNum: keys.gui.gpspage.pageNumber
            },
            updateFunction:(state:Record<string,any>)=>{
                return {
                    toggle: state.pageNum === idx,
                }
            }
        })
    }
    return GeneralButtons.concat(propsToDefs(
        btProps.concat([
        EditPageButton,
        Dimmer.buttonDef()
    ])))
}

