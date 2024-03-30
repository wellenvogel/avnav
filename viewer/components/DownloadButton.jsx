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
import React from 'react';
import PropTypes from 'prop-types';
import DB from './DialogButton';
import Button from './Button';

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

class DownloadButton extends React.Component{
    constructor(props) {
        super(props);
        this.hiddenA=undefined
    }
    saveLocal(){
        if (! this.hiddenA) return;
        if (!this.props.localData) return false;
        let data=this.props.localData;
        if (typeof this.props.localData === 'function'){
            data=this.props.localData();
        }
        let dataUrl="data:application/octet-stream;base64,"+toBase64(data);
        this.hiddenA.href=dataUrl;
    }
    render() {
        let {useDialogButton,url,localData,fileName,type,androidUrl,...forward}=this.props;
        let Bt = useDialogButton ? DB : Button;
        if (!url && ! localData) return null;
        return (
            <React.Fragment>
                <a download={fileName||"file.txt"}
                   className="hidden"
                   ref={(el) => this.hiddenA = el}
                   href={url||""}
                   onClick={(ev)=>ev.stopPropagation()}
                />
                    <Bt
                        {...forward}
                        onClick={(ev) =>{
                            ev.stopPropagation();
                            if (! this.hiddenA) return;
                            if (!url) this.saveLocal();
                            this.hiddenA.click();
                            if (this.props.onClick) this.props.onClick(ev);
                        }}
                    >
                        {this.props.children}
                    </Bt>
            </React.Fragment>
        )
    }
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