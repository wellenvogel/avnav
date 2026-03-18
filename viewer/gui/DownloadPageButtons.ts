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
import {DynamicButtonProps, propsToDefs} from "../components/Button";
import GeneralButtons from "./GeneralButtons";
// @ts-ignore
import keys from "../util/keys";

const getButtonParam=(name:string,type:string,overflow?:boolean,displayName?:string):DynamicButtonProps=>{
    const rt:DynamicButtonProps={
        name:name,
        type:type,
        displayName:displayName||type,
        overflow:!!overflow,
    }
    return rt;
}
export default GeneralButtons.concat(propsToDefs([
    getButtonParam('DownloadPageCharts','chart'),
    {
        name: 'DownloadPageImporter',
        displayName: 'chart import',
        storeKeys: {
            visible: keys.gui.capabilities.uploadImport
        }
    },
    getButtonParam('DownloadPageTracks','track'),
    getButtonParam('DownloadPageRoutes','route'),
    getButtonParam('DownloadPageLayouts','layout'),
    getButtonParam('DownloadPageSettings','settings',true,keys.gui.capabilities.uploadSettings),
    getButtonParam('DownloadPageUser','user',true),
    getButtonParam('DownloadPageImages','images',true),
    getButtonParam('DownloadPageOverlays','overlay',true),
    getButtonParam('DownloadPagePlugins','plugins',true,keys.gui.capabilities.uploadPlugins),
    {
        name:'DownloadPageUpload',
        displayName:'upload',
        localOnly:true
    },
]))