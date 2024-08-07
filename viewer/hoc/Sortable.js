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

import React from 'react';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import PropTypes from "prop-types";

export const useAvNavSortableO=(id,ref)=>{
   if (id === undefined) return {};
   const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({id:id});

  const nstyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const setRef=(e)=>{
      if (typeof(ref) === 'function') ref(e);
      setNodeRef(e);
  }
  return {ref:setRef,style:nstyle,...attributes,...listeners};
}

export const SortableProps={
    dragId: PropTypes.string
}

export const useAvNavSortable=(id,ref)=>{
    const ATTR='data-dragid';
    if (id === undefined) return {};
    let rt={
        onDragStart:(ev)=>{
            let data={
                rect: ev.currentTarget.getBoundingClientRect(),
                id: id,
                client: {x:ev.clientX,y:ev.clientY}
            };
            data.offset={x:data.client.x-data.rect.left,y:data.client.y-data.rect.top}
            ev.dataTransfer.setData("text",JSON.stringify(data));
        },
        onDragOver:(ev)=>{
            let ta=ev.target.getAttribute(ATTR);
            if ( ta !== undefined) {
                ev.preventDefault();
            }
        },
        onDrop: (ev)=>{
            ev.preventDefault();
            let dids=ev.dataTransfer.getData("text");
            let tdata=JSON.parse(dids);
            let tid=ev.currentTarget.getAttribute(ATTR);
            if (tid === tdata.id) return;
            let trect=ev.currentTarget.getBoundingClientRect();
            let toffset={x:ev.clientX-trect.left,y:ev.clientY-trect.top};
            let dragupperleft={x:toffset.x-tdata.offset.x,y:toffset.y-tdata.offset.y}
            let mode="after";
            if (dragupperleft.y < 0 ) mode="before";
            console.log("drop from ",tdata.id,"to ",tid,"mode",mode,tdata,trect,dragupperleft);
        },
        draggable: true,
        droppable: true
    }
    rt[ATTR]=id;
    return rt;
}
