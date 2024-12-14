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
import PropTypes from 'prop-types';
import DB from './DialogButton';
import Button from './Button';
import {useDialogContext} from "./OverlayDialog";

const toBase64=(val)=>{
    if (typeof(val) === 'string'){
        val=new TextEncoder().encode(val);
        const binString=Array.from(val,(byte)=>{
            return String.fromCodePoint(byte)
        }).join("");
        return window.btoa(binString);
    }
    return window.btoa(val);
}

const DownloadButton=(props)=>{
    const hiddenA=useRef();
    const saveLocal=(fileName)=>{
        if (! hiddenA.current) return;
        if (!props.localData) return false;
        let data=props.localData;
        if (typeof data === 'function'){
            data=data();
        }
        let dataUrl="data:application/octet-stream;base64,"+toBase64(data);
        if (window.avnav.android && window.avnav.android.dataDownload){
           window.avnav.android.dataDownload(dataUrl,fileName,"application/octet-stream");
        }
        else {
            hiddenA.current.href = dataUrl;
            hiddenA.current.click();
        }
    }
    let {useDialogButton,url,localData,fileName,type,androidUrl,...forward}=props;
    let Bt = useDialogButton ? DB : Button;
    if (!url && ! localData) return null;
        return (
            <React.Fragment>
                <a download={fileName||"file.txt"}
                   className="hidden"
                   ref={hiddenA}
                   href={url||""}
                   onClick={(ev)=>ev.stopPropagation()}
                />
                    <Bt
                        {...forward}
                        onClick={(ev) =>{
                            ev.stopPropagation();
                            if (! hiddenA.current) return;
                            if (!url) saveLocal(fileName);
                            else hiddenA.current.click();
                            if (props.onClick) props.onClick(ev);
                        }}
                    >
                        {props.children}
                    </Bt>
            </React.Fragment>
        )
}

DownloadButton.propTypes={
    localData: PropTypes.any,
    url: PropTypes.string,
    className: PropTypes.string,
    useDialogButton: PropTypes.bool,
    fileName:  PropTypes.string,
    type: PropTypes.string,
    onClick: PropTypes.func,
    androidUrl: PropTypes.string //optional url for android downloads
}

export default DownloadButton;