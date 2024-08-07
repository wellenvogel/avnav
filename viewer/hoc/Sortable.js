/*
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
*/

import React, {createContext, useContext} from 'react';
import PropTypes from "prop-types";


export const SortableProps={
    dragId: PropTypes.string
}

export const useAvNavSortable=(id,ref)=>{
    const ATTR='data-dragid';
    const TYPE='application-x-avnav-dnd';
    const context= useContext(SortContext);
    if (id === undefined || context.id === undefined) return {};
    let rt={
        onDragStart:(ev)=>{
            let data={
                rect: ev.currentTarget.getBoundingClientRect(),
                id: id,
                client: {x:ev.clientX,y:ev.clientY},
                ctxid: context.id
            };
            data.offset={x:data.client.x-data.rect.left,y:data.client.y-data.rect.top}
            ev.dataTransfer.setData(TYPE,JSON.stringify(data));
        },
        onDragOver:(ev)=>{
            let ta=ev.target.getAttribute(ATTR);
            if ( ta !== undefined) {
                const tdatas=ev.dataTransfer.getData(TYPE);
                if (tdatas !== undefined) {
                    //const tdata=JSON.parse(tdatas);
                    //if (tdata.ctxid === context.id) {
                        ev.preventDefault();
                    //}
                }
            }
        },
        onDrop: (ev)=>{
            ev.preventDefault();
            let dids=ev.dataTransfer.getData(TYPE);
            let tdata=JSON.parse(dids);
            if (tdata.ctxid !== context.id) return;
            let tid=parseInt(ev.currentTarget.getAttribute(ATTR));
            if (tid === tdata.id) return;
            let trect=ev.currentTarget.getBoundingClientRect();
            let toffset={x:ev.clientX-trect.left,y:ev.clientY-trect.top};
            let dragupperleft={x:toffset.x-tdata.offset.x,y:toffset.y-tdata.offset.y}
            let after=true;
            if (context.mode === SortModes.vertical){
                if (dragupperleft.y < 0) after=false;
            }
            else{
                if (dragupperleft.x < 0) after=false;
            }
            if (context.onDragEnd){
                context.onDragEnd(tdata.id,tid,after);
            }
        },
        draggable: true,
        droppable: true
    }
    rt[ATTR]=id;
    return rt;
}

export const SortModes={
    horizontal: 0,
    vertical:1
}
export const SortContext=createContext({id:undefined,mode:SortModes.vertical,onDragEnd:undefined});

