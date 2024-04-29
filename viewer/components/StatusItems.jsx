import globalStore from "../util/globalstore";
import keys from "../util/keys";
import Button from "./Button";
import React from 'react';

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

export const statusTextToImageUrl=(text)=>{
    let rt=globalStore.getData(keys.properties.statusIcons[text]);
    if (! rt) rt=globalStore.getData(keys.properties.statusIcons.INACTIVE);
    return rt;
};
export const EditIcon=(props)=>{
    return <Button
        name="Edit" className="Edit smallButton editIcon" onClick={props.onClick}/>

}
export const ChildStatus=(props)=>{
    let canEdit=props.canEdit && props.connected;
    let sub=props.sub || (props.name && props.name.match(/:#:/));
    let name=sub?props.name.replace(/^.*:#:/,''):props.name;
    let clName="childStatus";
    if (sub) clName+=" sub";
    return (
        <div className={clName} onClick={props.onClick}>
            <img src={statusTextToImageUrl(props.status)}/>
            <span className="statusName">{name}</span>
            <span className="statusInfo">{props.info}</span>
            {(props.forceEdit || (canEdit && ! sub))  && <EditIcon onClick={
                ()=>props.showEditDialog(props.handlerId,props.id,props.finishCallback)
            }/>}
        </div>
    );
};
export const StatusItem=(props)=>{
    let canEdit=props.canEdit && props.connected && props.allowEdit;
    let isDisabled=props.disabled;
    let name=props.name.replace(/\[.*\]/, '');
    if (props.id !== undefined){
        name="["+props.id+"]"+name;
    }
    let cl="status";
    if (props.requestFocus){
        cl+=" requestFocus";
    }
    let children=(props.info && props.info.items)?props.info.items:[];
    children.sort((a,b)=>{
        if (a.name>b.name) return 1;
        if (a.name < b.name) return -1;
        return 0;}
    );
    return(
        <div className={cl}  key={props.id}>
            <div className={"statusHeading"+ (isDisabled?" disabled":"")}>
                <span className="statusName">{name}</span>
                {isDisabled && <span className="disabledInfo">[disabled]</span> }
                {canEdit && <EditIcon
                    onClick={
                        () => props.showEditDialog(props.id,undefined,props.finishCallback)
                    }/>}
            </div>
            {children.map(function(el){
                return <ChildStatus
                    {...el}
                    key={props.name+el.name}
                    connected={props.connected}
                    handlerId={props.id}
                    finishCallback={props.finishCallback}
                    showEditDialog={props.showEditDialog}
                />
            })}
        </div>

    );
};
