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
 
import React, {useRef} from 'react';
import {PageFrame, PageLeft, PageProps} from "../components/Page";
import {ButtonDef, updateButtons} from "../components/Button";
import {InjectMainMenu, useInitialButton} from "./MainNav";
import PluginsPageButtons from "./PluginsPageButtons";
import {getPageTitle} from "../util/pageids";
import ButtonList from "../components/ButtonList";
import {DownloadItemList} from "../components/DownloadItemList";
import {useUploadHelper} from "../components/UploadHandler";

export const PluginsPage = (props:PageProps) => {
    const currentButtons=useRef<ButtonDef[]>();
    const [uploadProps,uploadAction]=useUploadHelper("plugins");
    const buttonActions={
        DownloadPageUpload:{
            onClick:uploadAction,
        }
    }
    currentButtons.current=InjectMainMenu(props.id,updateButtons(PluginsPageButtons,buttonActions));
    useInitialButton(currentButtons);
    return <PageFrame id={props.id}>
        <PageLeft id={props.id} title={getPageTitle(props.id)} >
            <DownloadItemList
                {...uploadProps}
                type={'plugins'}
                autoreload={3000}
                scrollSelected={1}
            >

            </DownloadItemList>
        </PageLeft>
        <ButtonList page={props.id} itemList={currentButtons.current}/>
    </PageFrame>
}