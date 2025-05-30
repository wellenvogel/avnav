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

import React, {useState} from 'react';
import PropTypes from 'prop-types';
import {DialogButtons, DialogFrame, DialogRow, showPromiseDialog} from './OverlayDialog.jsx';
import {Input, InputSelect} from './Inputs.jsx';
import DB from './DialogButton.jsx';

const nameToExternalName=(name,fixedPrefix)=>{
    if (fixedPrefix) return fixedPrefix+name;
    return name;
}
const externalNameToName=(name,fixedPrefix)=>{
    if (fixedPrefix){
        let l=fixedPrefix.length;
        if (name.substr(0,l) === fixedPrefix) return name.substr(l);
        return name;
    }
    return name;
}
const SaveItemDialog = (props) => {
    const [value, setValue] = useState(externalNameToName(props.value, props.fixedPrefix));
    const [existingActive, setExistingActive] = useState(props.checkFunction(nameToExternalName(value, props.fixedPrefix)));
    let info = "New ";
    if (existingActive.active) {
        info = "Active ";
    } else {
        if (existingActive.existing) {
            info = "Existing ";
        }
    }
    info += props.itemLabel;
    return (
        <div className={props.className + " inner saveItemDialog"}>
            <h3 className="dialogTitle">{props.title || ('Select ' + props.itemLabel + ' Name')}</h3>
            {props.subTitle ? <p>{props.subTitle}</p> : null}
            <div>
                <DialogRow><span className="wideLabel">{info}</span></DialogRow>
                <Input
                    dialogRow={true}
                    className="saveName"
                    label={props.fixedPrefix || ''}
                    value={value} onChange={(nv) => {
                    setValue(nv);
                    setExistingActive(props.checkFunction(nameToExternalName(nv, props.fixedPrefix)))
                }}/>
            </div>
            <DialogButtons>
                <DB name="cancel">Cancel</DB>
                <DB name="ok" onClick={() => {
                    props.okCallback(nameToExternalName(value, props.fixedPrefix));
                }}
                    disabled={existingActive.existing && !props.allowOverwrite}
                >{(existingActive.existing && props.allowOverwrite) ? "Overwrite" : "Ok"}</DB>
            </DialogButtons>
        </div>
    );

}

SaveItemDialog.propTypes={
    title: PropTypes.string,
    subTitle: PropTypes.string,
    className: PropTypes.string,
    fixedPrefix: PropTypes.string,
    checkFunction: PropTypes.func.isRequired, //return an object with existing, active
    itemLabel: PropTypes.string.isRequired,
    allowOverwrite: PropTypes.bool,
    value: PropTypes.string,
    okCallback: PropTypes.func.isRequired,
};
/**
 *
 * @param name
 * @param checkFunction
 * @param properties object with: title, itemLabel, subtitle, fixedPrefix
 * @return {*}
 */
SaveItemDialog.createDialog=(name,checkFunction,properties,opt_dialogContext)=>{
    if (! properties) properties={}
    return showPromiseDialog(opt_dialogContext,(dprops)=>{
            return <SaveItemDialog
                {...properties}
                {...dprops}
                value={name}
                okCallback={(newName)=>{
                        dprops.resolveFunction(newName)
                   }}
                checkFunction={(cname)=>{
                        if (checkFunction){
                            return checkFunction(cname);
                        }
                        return false;
                    }
                }
                />
    });
};

const LoadItemDialog=(props)=>{
        const [value,setValue]=useState(props.value);
        return (
            <DialogFrame className={props.className+" loadItemDialog"} title={props.title||('Select '+props.itemLabel)}>
                {props.subTitle?<p>{props.subTitle}</p>:null}
                        <InputSelect
                            dialogRow={true}
                            className="loadName"
                            label={props.itemLabel}
                            value={value}
                            itemList={props.itemList}
                            onChange={(nv)=>setValue(nv)}
                            changeOnlyValue={true}
                        />
                <DialogButtons >
                    <DB name="cancel" >Cancel</DB>
                    <DB name="ok" onClick={() => {
                        props.okCallback(value);
                    }}>Ok</DB>
                </DialogButtons>
            </DialogFrame>
        );
}

LoadItemDialog.propTypes={
    title: PropTypes.string,
    subTitle: PropTypes.string,
    className: PropTypes.string,
    itemLabel: PropTypes.string.isRequired,
    value: PropTypes.string,
    itemList: PropTypes.any.isRequired,
    okCallback: PropTypes.func.isRequired
};

LoadItemDialog.createDialog=(name,itemList,properties,opt_dialogContext)=>{
    if (! properties) properties={}
    return showPromiseDialog(opt_dialogContext,(props)=>{
            return <LoadItemDialog
                {...properties}
                {...props}
                value={name}
                okCallback={(newName)=>{
                    props.resolveFunction(newName)
                }}
                itemList={itemList}
            />
        })
};

export {
    SaveItemDialog,
    LoadItemDialog
};