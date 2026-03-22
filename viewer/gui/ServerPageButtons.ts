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
 */ import GeneralButtons from "./GeneralButtons";
import {propsToDefs} from "../components/Button";

export default GeneralButtons.concat(propsToDefs([
    {
        name: 'MainInfo',
        displayName:'license info',
        overflow:true
    },
    {
        name:'StatusAll',
        displayName:'show all',
        overflow: true
    },
    {
        name: 'StatusWpa',
        displayName:'wifi connections',
        localOnly: true,
        overflow:true,
    },
    {
        name:'StatusAddresses',
        displayName: 'own networks',
        localOnly:true,
        overflow:true,
    },
    {
        name: 'StatusAndroid',
        displayName:'android',
        //@ts-ignore
        visible:!!window.avnavAndroid
    },
    {
        name: 'AndroidBrowser',
        displayName:'open browser',
        localOnly:true,
        overflow:true,
        //@ts-ignore
        visible:!!window.avnavAndroid
    },
    {
        name:'StatusShutdown',
        displayName:'shutdown server',
        localOnly:true,
    },
    {
        name: 'StatusRestart',
        displayName:'restart avnav',
        localOnly:true,
    },
    {
        name:'StatusLog',
        displayName:'show log',
        localOnly:true,
        overflow: true
    },
    {
        name:'StatusDebug',
        displayName:'debug server',
        localOnly:true,
        overflow: true
    },
    {
        name: 'StatusAdd',
        displayName:'add connection',
        localOnly:true,
        visible:false,
    }

]))
