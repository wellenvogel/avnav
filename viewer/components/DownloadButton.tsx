/**
 *###############################################################################
 # Copyright (c) 2012-2020 Andreas Vogel andreas@wellenvogel.net
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
 ###############################################################################
 */
import React, {useRef} from 'react';
import DB from './DialogButton';
import Button, {ButtonEvent} from './Button';
import Toast from "./Toast";

const toBase64=(val:any)=>{
    if (typeof(val) === 'string'){
        const aval =new TextEncoder().encode(val);
        const binString=Array.from(aval,(byte)=>{
            return String.fromCodePoint(byte)
        }).join("");
        return window.btoa(binString);
    }
    return window.btoa(val);
}

export interface DownloadButtonProps{
    localData?: any|Promise<any>|(()=>any);
    url: string|(()=>string);
    className?: string;
    useDialogButton?: boolean;
    fileName?:  string;
    onClick?: (ev:ButtonEvent) => void;
    children?: React.ReactNode;
    name?:string;
    close?:boolean;
}
const DownloadButton=(props:DownloadButtonProps)=>{
    const hiddenA=useRef<HTMLAnchorElement>();
    const downloadFrame=useRef<HTMLIFrameElement>();
    const saveLocal=async (fileName:string)=>{
        if (! hiddenA.current) return;
        if (!props.localData) return false;
        let data=props.localData;
        if (typeof data === 'function'){
            data=data();
        }
        if (data instanceof Promise){
            data=await data;
        }
        const dataUrl="data:application/octet-stream;base64,"+toBase64(data);
        // @ts-ignore
        if (window.avnavAndroid && window.avnavAndroid.dataDownload){
           // @ts-ignore
            window.avnavAndroid.dataDownload(dataUrl,fileName,"application/octet-stream");
        }
        else {
            hiddenA.current.href = dataUrl;
            hiddenA.current.click();
        }
    }
    const {useDialogButton,url,localData,fileName,...forward}=props;
    const Bt = useDialogButton ? DB : Button;
    if (!url && ! localData) return null;
        return (
            <React.Fragment>
                {localData &&
                    <a download={fileName || "file.txt"}
                       className="hidden"
                       ref={hiddenA}
                       href={""}
                       onClick={(ev) => ev.stopPropagation()}
                    />
                }
                {!localData && <iframe
                    className="downloadFrame"
                    onLoad={(ev) => {
                        let txt;
                        // @ts-ignore
                        const doc= ev.target.contentDocument;
                        if (doc.body) txt=doc.body.textContent;
                        if (!txt) {
                            return;
                        }
                        Toast(txt);
                    }}
                    src={undefined}
                    ref={downloadFrame}/>
                }
                <Bt
                    name={props.name||'download'}
                    {...forward}
                    close={useDialogButton?false:undefined}
                    onClick={(ev) => {
                        ev.stopPropagation();
                        if (localData) {
                            saveLocal(fileName).then(()=>{},(err)=>{
                                Toast(err);
                            });
                        }
                        else {
                            if (downloadFrame.current) {
                                if (typeof(url) === 'function') {
                                    downloadFrame.current.src=url();
                                }
                                else {
                                    downloadFrame.current.src=url;
                                }

                            }
                        }
                        if (props.onClick) props.onClick(ev);
                        }}
                    >
                        {props.children}
                    </Bt>
            </React.Fragment>
        )
}


export default DownloadButton;