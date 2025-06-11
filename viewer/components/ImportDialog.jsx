/**
 *###############################################################################
 # Copyright (c) 2012-2024 Andreas Vogel andreas@wellenvogel.net
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
import React, {useState} from 'react';
import PropTypes from 'prop-types';
import {Checkbox, Input, InputReadOnly} from "./Inputs";
import helper from '../util/helper'
import keys from "../util/keys";
import Requests from "../util/requests";
import {DialogButtons, DialogFrame} from "./OverlayDialog";
import DB from "./DialogButton";
import globalStore from "../util/globalstore";
const ImportDialog =(props)=>{
        const [subdir,setSubdir]=useState(props.subdir);
        const [useSubdir,setUseSubdir]=useState(props.subdir?true:false);
        const [name,setName]=useState(()=> {
            let iname=props.name;
            let iext=helper.getExt(iname);
            return iname.substring(0, iname.length - iext.length - 1)
        });
        const [ext,setExt]=useState(()=>helper.getExt(props.name));
        return (
                <DialogFrame className="importDialog" title={"Upload Chart to Importer"}>
                    {!props.allowNameChange && <InputReadOnly
                        dialogRow={true}
                        label="name"
                        value={name}>
                        <span className="ext">.{ext}</span>
                    </InputReadOnly>
                    }
                    {
                        props.allowNameChange && <Input
                            dialogRow={true}
                            value={name}
                            onChange={(nv)=>{
                                setName(nv)
                            }}
                            label="name">
                            <span className="ext">.{ext}</span>
                        </Input>
                    }
                    {props.allowSubDir && <Checkbox
                        dialogRow={true}
                        label="use set name"
                        value={useSubdir}
                        onChange={(nv)=>setUseSubdir(nv)}
                    />}
                    {props.allowSubDir && useSubdir?<Input
                            dialogRow={true}
                            label="set name"
                            value={subdir}
                            onChange={(nv)=>{setSubdir(nv)}}
                        />
                        :
                        null}

                    <DialogButtons className="dialogButtons">
                        <DB name="cancel"
                        >Cancel</DB>
                        <DB name="ok"
                            onClick={()=>{
                                props.resolveFunction({...props,name:name+"."+ext},useSubdir?subdir:undefined);
                            }}
                            disabled={useSubdir && !subdir}
                        >OK</DB>
                    </DialogButtons>
                </DialogFrame>
        );
}
ImportDialog.propTypes={
    resolveFunction: PropTypes.func.isRequired,
    subdir: PropTypes.string,
    name: PropTypes.string.isRequired,
    allowSubDir: PropTypes.bool,
    allowNameChange: PropTypes.bool
};

export const readImportExtensions=()=>{
    return new Promise((resolve,reject)=>{
        if (!globalStore.getData(keys.gui.capabilities.uploadImport)) resolve([]);
        Requests.getJson({
            request:'api',
            type:'import',
            command:'extensions'
        })
            .then((data)=>{
                resolve(data.items);
            })
            .catch(()=>{
                resolve([])
            });
    })
}
export const checkExt=(ext,extensionList)=>{
    if (!ext || ! extensionList) return {allow:false,subdir:false}
    ext=ext.toUpperCase();
    if (! helper.startsWith(ext,'.')) ext='.'+ext;
    for (let i=0;i<extensionList.length;i++){
        if (extensionList[i].ext === ext) return {allow:true,subdir:extensionList[i].sub}
    }
    return {allow:false,sub:false}
}

export default ImportDialog;