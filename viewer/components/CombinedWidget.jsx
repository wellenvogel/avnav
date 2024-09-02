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
import {moveItem, SortableProps, useAvNavSortable} from "../hoc/Sortable";
import {WidgetProps} from "./WidgetBase";
import PropTypes from "prop-types";
import React, {useState} from "react";
import theFactory from "./WidgetFactory";
import {EditableParameter} from "./EditableParameters";
import ItemList from "./ItemList";
import DialogButton from "./DialogButton";
import {useDialog} from "./OverlayDialog";
import EditWidgetDialog from "./EditWidgetDialog";

const ChildWidget=(props)=>{
    const dd=useAvNavSortable(props.dragId);
    return <div className={'dialogRow row'} {...dd}>
        <span className="inputLabel">{"sub"+props.index}</span>
        <div className="input" onClick={props.onClick}>{props.name}</div>
    </div>
}

const RenderChildParam=(props)=>{
    if (! props.currentValues) return null;
    const [Dialog,setDialog]=useDialog();
    const [children,setChildrenImpl]=useState(props.currentValues.children||[])
    const setChildren=(ch)=>{
        setChildrenImpl(ch);
        props.onChange({children:ch});
    }
    return <div className={'childWidgets'}>
        <Dialog/>
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
                setDialog((props)=>{
                    return <EditWidgetDialog
                        title={"Sub Widget "+item.index}
                        current={item}
                        weight={true}
                        closeCallback={()=>setDialog()}
                        updateCallback={(data)=>{
                            if (item.index === undefined) return;
                            let next=[...children];
                            next[item.index]=data;
                            setChildren(next);
                        }}
                        removeCallback={()=> {
                            if (item.index === undefined) return;
                            let next=[...children];
                            next.splice(item.index,1);
                            setChildren(next);
                        }}
                    />
                })
            }}
        />
        <div className={'row dialogButtons insertButtons'}>
            <DialogButton
                name={'add'}
                onClick={()=>{
                    setDialog((props)=>{
                        return <EditWidgetDialog
                            title="Add Sub"
                            current={{}}
                            weight={true}
                            insertCallback={(data)=>{
                               setChildren([...children,data]);
                            }}
                            closeCallback={()=>setDialog()}
                        />
                    })
                }}
            >
                +Sub</DialogButton>
        </div>
    </div>
}
class ChildrenParam extends EditableParameter {
    constructor() {
        super('children', -1);
        this.default=[];
    }
    render(props){
        return <RenderChildParam
            {...props}
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
    let {editableParameters,children,onClick,childProperties,style,dragId,className,vertical,...forwardProps}=props;
    const ddProps = useAvNavSortable(dragId);
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

    return <div  {...forwardProps}  {...ddProps} className={className} onClick={cl} style={{...style,...ddProps.style}}>
        {(children||[] ).map((item) => {
            let weight=getWeight(item);
            let percent=(weightSum !== 0)?100*weight/weightSum:undefined;
            let style={};
            if (percent !== undefined){
                if (vertical) style.height=percent+"%";
                else style.width=percent+"%";
            }
            let Item = theFactory.createWidget(item, {...childProperties,style:style});
            cidx++;
            return <Item key={cidx}/>
        })}
    </div>
}
CombinedWidget.propTypes={
    ...WidgetProps,
    ...SortableProps,
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
    children: new ChildrenParam()
}
