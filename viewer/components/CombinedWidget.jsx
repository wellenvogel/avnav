/*
###############################################################################
# Copyright (c) 2024, Andreas Vogel andreas@wellenvogel.net

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
#  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
#  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
#  DEALINGS IN THE SOFTWARE.
###############################################################################
*/
import {useKeyEventHandler} from "../util/GuiHelpers";
import {moveItem, useAvNavSortable, useAvnavSortContext} from "../hoc/Sortable";
import {WidgetProps} from "./WidgetBase";
import PropTypes from "prop-types";
import React, {useState} from "react";
import theFactory from "./WidgetFactory";
import ItemList from "./ItemList";
import DialogButton from "./DialogButton";
import {DialogButtons, useDialogContext} from "./OverlayDialog";
import EditWidgetDialog from "./EditWidgetDialog";
import keys from "../util/keys";
import {EditableParameter} from "../util/EditableParameter";
import Helper from "../util/helper";

const ChildWidget=(props)=>{
    const dd=useAvNavSortable(props.dragId);
    return <div className={'dialogRow row'} {...dd}>
        <span className="inputLabel">{"sub"+props.index}</span>
        <div className="input" onClick={props.onClick}>{props.name}</div>
    </div>
}

const updateChildren=(children,index,data)=>{
    if (index === undefined) return;
    let next=[...children];
    if (data !== undefined) {
        next[index] = data;
    }
    else{
        next.splice(index,1);
    }
    return next;
}

const RenderChildParam=({currentValues,initialValues,onChange,className})=>{
    //TODO: changed handling
    const dialogContext=useDialogContext();
    if (! currentValues) return null;
    const children=currentValues.children||[];
    const setChildren=(ch)=>{
        if (ch === undefined) return;
        onChange({children:ch});
    }
    return <div className={Helper.concatsp('childWidgets',className)}>
        <ItemList
            itemList={children}
            itemClass={ChildWidget}
            dragdrop={true}
            onSortEnd={(currentId,newId)=>{
                let next=moveItem(currentId,newId,children);
                if (next !== undefined) {
                    setChildren(next);
                }
            }}
            onItemClick={(item,data)=>{
                dialogContext.showDialog((dprops)=>{
                    return <EditWidgetDialog
                        {...dprops}
                        title={"Sub Widget "+item.index}
                        current={item}
                        weight={true}
                        updateCallback={(udata)=>{
                            setChildren(updateChildren(children,item.index,udata));
                        }}
                        removeCallback={()=> {
                            setChildren(updateChildren(children,item.index));
                        }}
                    />
                })
            }}
        />
        <DialogButtons>
            <DialogButton
                name={'add'}
                close={false}
                onClick={()=>{
                    dialogContext.showDialog((props)=>{
                        return <EditWidgetDialog
                            {...props}
                            title="Add Sub"
                            current={{}}
                            weight={true}
                            insertCallback={(data)=>{
                               setChildren([...children,data]);
                            }}
                        />
                    })
                }}
            >
                +Sub</DialogButton>
        </DialogButtons>
    </div>
}
class ChildrenParam extends EditableParameter {
    constructor() {
        super({name:'children',default:[]}, -1,true);
        this.render=this.render.bind(this)
        Object.freeze(this);
    }
    render({currentValues,initialValues,className,onChange}){
        return <RenderChildParam
            className={className}
            onChange={onChange}
            currentValues={currentValues}
            initialValues={initialValues}
            />
    }
}

const getWeight=(item)=>{
    if (! item) return 0;
    if (item.weight === undefined) return 1;
    return parseFloat(item.weight);
}

const DEFAULT_NAME="CombinedWidget";
export const CombinedWidget=(props)=>{
    useKeyEventHandler(props,"widget")
    let {wclass,locked,editing,sequence,editableParameters,nightMode,children,onClick,childProperties,dragId,className,vertical,mode,...forwardProps}=props;
    const sortContext=useAvnavSortContext();
    const ddProps = useAvNavSortable(locked?dragId:undefined);
    const cl=(ev)=>{
        if (onClick) onClick(ev);
    }
    let cidx = 0;
    if (childProperties) delete childProperties.style;
    className = (className || '') + " widget";
    if (props.name !== DEFAULT_NAME) className+=" "+DEFAULT_NAME;
    if (vertical) className+=" vertical";
    let weightSum=0;
    (children||[]).forEach((child)=>{
        weightSum+=getWeight(child);
    });
    const dragFrame=sortContext.id+":"+dragId;
    const itemClick=editing?undefined:cl;
    return <div  {...forwardProps}  {...ddProps} className={className} onClick={cl}>
        { (editing && locked) && <div className="icon locked">Locked</div>}
        <ItemList
            dragdrop={editing && ! locked}
            dragFrame={dragFrame}
            allowOther={true}
            horizontal={!vertical}
            onSortEnd={(oldIndex,newIndex,oldFrame,targetFrame)=>{
                sortContext.onDragEnd(oldIndex,newIndex,oldFrame,targetFrame);
            }}
            itemList={children||[]}
            itemCreator={(item)=>{
                let weight=getWeight(item);
                let percent=(weightSum !== 0)?100*weight/weightSum:undefined;
                let style={};
                if (percent !== undefined){
                    if (vertical) style.height=percent+"%";
                    else style.width=percent+"%";
                }
                let Item = theFactory.createWidget(item, {...childProperties,style:style});
                cidx++;
                return (iprops)=>{
                    return  <Item key={cidx} {...iprops} mode={mode} editing={editing} />
            }}
            }
            onItemClick={itemClick}

        />
    </div>
}
CombinedWidget.propTypes={
    ...WidgetProps,
    children: PropTypes.array,
    vertical: PropTypes.bool,
    editableParameters: PropTypes.object
}
CombinedWidget.editableParameters={
    formatter: false,
    unit: false,
    formatterParameters: false,
    value: false,
    caption: false,
    vertical: {type:'BOOLEAN',default: false},
    locked: {type: 'BOOLEAN', default: true},
    children: new ChildrenParam()
}
CombinedWidget.storeKeys={
    editing: keys.gui.global.layoutEditing,
    sequence: keys.gui.global.layoutSequence
}
