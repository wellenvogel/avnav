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
import {DBCancel, DialogButtons, DialogFrame, DialogRow, SelectList, useDialogContext} from "./OverlayDialog";
import PropTypes from "prop-types";
import {Checkbox} from "./Inputs";
import React,{useEffect, useState} from "react";
import Requests from "../util/requests";
import GuiHelpers from "../util/GuiHelpers";
import Helper from "../util/helper";

const SOURCES=[
    {
        flag: 1,
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
    const [currentUrl,setCurrentUrl]=useState(props.value);
    const loadIcons = () => {
        setIconList([]);
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
                                        if (el.url === currentUrl) el.selected=true;
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
                DBCancel()
            ]}
        >
        </DialogButtons>
    </DialogFrame>
}
IconDialog.propTypes={
    onChange: PropTypes.func,
    resolveFunction: PropTypes.func
}