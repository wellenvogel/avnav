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
 * select an icon
 */
import {DBCancel, DialogButtons, DialogFrame, DialogRow, useDialogContext} from "./OverlayDialog";
import PropTypes from "prop-types";
import {Checkbox} from "./Inputs";
import React,{useEffect, useState} from "react";
import Requests from "../util/requests";
import GuiHelpers from "../util/GuiHelpers";
import Helper from "../util/helper";
import UploadHandler from "./UploadHandler";
import Toast from "./Toast";
import globalStore from "../util/globalstore";
import keys from "../util/keys";
import {SelectList} from "./BasicDialogs";

const IMAGES_FLAG=1;
const SOURCES=[
    {
        flag: IMAGES_FLAG,
        label: 'images',
        type: 'images'
    },
    {
        flag: 2,
        label: 'files',
        type:'user'
    },
    {
        flag: 4,
        label: 'builtin',
        type: 'icons'
    }
];

const changeFlag=(old,flag,value)=>{
    if (! value) return old & ~flag;
    else return old | flag;
}
const contains = (list, url, opt_key) => {
    if (opt_key === undefined) opt_key = "url";
    for (let k = 0; k < list.length; k++) {
        if (list[k][opt_key] === url) return true;
    }
    return false;
}
export const IconDialog=(props)=>{
    const dialogContext=useDialogContext();
    const onChange=props.resolveFunction||props.onChange;
    const [sources,setSources]=useState(0xff); //all
    const [iconList,setIconList]=useState([]);
    const [uploadSequence,setUploadSequence]=useState(0);
    const loadIcons = (opt_active,opt_activeType) => {
        setIconList(props.addEmpty?[{label:'--- none ---',value:undefined}]:[]);
        SOURCES.forEach((src) => {
            const active=!!(sources & src.flag);
            if (! active) return;
            Requests.getJson("", undefined, {
                request: 'list',
                type: src.type
            })
                .then((data) => {
                        if (data.items) {
                            let allIcons = [];
                            data.items.forEach((el) => {
                                if (GuiHelpers.IMAGES.indexOf(Helper.getExt(el.name)) >= 0) {
                                    if (!contains(allIcons, el.url)) {
                                        el.label = el.name;
                                        el.value = el.url;
                                        el.icon= el.url;
                                        if (el.url === props.value) el.selected=true;
                                        if (opt_active !== undefined){
                                            if (el.name === opt_active && (opt_activeType === undefined || opt_activeType === src.type)){
                                                dialogContext.closeDialog();
                                                onChange(el);
                                            }
                                        }
                                        allIcons.push(el);
                                    }
                                }
                            })
                            setIconList((old)=>{
                                return old.concat(allIcons);
                            });
                        }
                    }
                )
                .catch((e) => {})
                })
        }
    useEffect(() => {
        loadIcons();
    }, [sources]);
    return <DialogFrame
        title={"Select Icon"}
        className="selectIconDialog"
        >
        <DialogRow>
            {SOURCES.map((src)=>{
                const active=!!(sources & src.flag);
                return <Checkbox
                    className="checkBoxRow"
                    label={src.label}
                    value={active}
                    key={src.flag}
                    onChange={(nv)=>{
                        setSources(changeFlag(sources,src.flag,nv));
                    }}/>
            })}
        </DialogRow>
        <SelectList list={iconList} onClick={(icon)=>{
            dialogContext.closeDialog();
            onChange(icon);
        }}/>
        <DialogButtons
            buttonList={[
                {
                    name:'upload',
                    label:'New',
                    onClick:()=>setUploadSequence(uploadSequence+1),
                    close:false,
                    visible: (props.allowUpload === undefined|| props.allowUpload) && globalStore.getData(keys.gui.capabilities.uploadImages),
                    disabled: ! (sources & IMAGES_FLAG)
                },
                DBCancel()
            ]}
        >
        </DialogButtons>
        <UploadHandler
            local={false}
            type={'images'}
            doneCallback={(param)=>loadIcons(param.param.name,'images')}
            errorCallback={(err) => {
                if (err) Toast(err);
            }}
            uploadSequence={uploadSequence}
            checkNameCallback={(name)=>{
                return new Promise((resolve,reject)=>{
                    if (contains(iconList, name, "name")) {
                        reject(name + " already exists");
                        return;
                    }
                    let ext = Helper.getExt(name);
                    let rt = {name: name};
                    if (GuiHelpers.IMAGES.indexOf(ext) < 0) {
                        reject("only images of types " + GuiHelpers.IMAGES.join(","));
                        return;
                    }
                    resolve(rt);
                })
            }}
        />
    </DialogFrame>
}
IconDialog.propTypes={
    onChange: PropTypes.func,
    resolveFunction: PropTypes.func,
    allowUpload: PropTypes.bool,
    addEmpty: PropTypes.bool,
    value: PropTypes.string
}