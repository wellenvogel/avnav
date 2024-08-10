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

export const SortModes={
    horizontal: 0,
    vertical:1
}

const percentOverlap=(itstart,itext,cmpstart,cmpext)=>{
    const itend=itstart+itext;
    const cmpend=cmpstart+cmpext;
    if (itext === 0) return 0;
    if (itstart > cmpend) return 0;
    if (itend< cmpstart) return 0;
    let ext=0;
    if (itstart < cmpstart){
        ext=(cmpend > itend)?itend-cmpstart:cmpend-cmpstart;
    }
    else{
        ext=(cmpend > itend)?itend-itstart:cmpend-itstart;
    }
    return 100*ext/itext;
}
class SortHandler{
    constructor() {
        this.refs={};
        this.dragging=undefined;
    }
    ref(id,el){
        id=parseInt(id);
        if (el) this.refs[id]=el;
        else delete this.refs[id];
    }
    findPosition(dragRect,id,mode){
        let bestMatching=[];
        let maxv=undefined;
        let minv=undefined;
        let minid=undefined;
        let maxid=undefined;
        let itemstart=(mode===SortModes.vertical)?dragRect.top:dragRect.left;
        let itemext=(mode===SortModes.vertical)?dragRect.height:dragRect.width;
        const se=(rect)=>{
            if (mode===SortModes.vertical){
                return {start:rect.top,ext:rect.height};
            }
            else{
                return{start:rect.left,ext:rect.width};
            }
        }
        const d=(rect)=>{
            const {start,ext}=se(rect);
            if (minv === undefined || start < minv ) minv=start;
            if (maxv === undefined || (start+ext) > maxv) maxv=start+ext;
            return percentOverlap(itemstart,itemext,start,ext);
        }
        for (let k in this.refs){
            k=parseInt(k);
            if (minid === undefined || k < minid) minid=k;
            if (maxid === undefined || k > maxid) maxid=k;
            if (k === id) continue;
            const el=this.refs[k];
            if (! el){
                continue;
            }
            const elrect=el.getBoundingClientRect();
            const match=d(elrect);
            if (match > 0) bestMatching.push({match:match,id:k});
        }
        if (bestMatching.length < 1) {
            //check above/below
            if (itemstart <= minv) return minid;
            if ((itemstart + itemext) > maxv) return maxid + 1;
            return undefined;
        }
        bestMatching.sort((a,b)=>{
            return b.match - a.match;
        });
        if (bestMatching[0].match < 50){
            //check if we are more after
            if (bestMatching[0].id === maxid && (itemstart+itemext) > maxv){
                return maxid+1;
            }
        }
        return bestMatching[0].id;
    }
}
const SortContextImpl=createContext({
    id:undefined,
    mode:SortModes.vertical,
    onDragEnd:undefined,
    handler:undefined
});

export const SortableProps={
    dragId: PropTypes.string
}

const ATTR='data-dragid';
const CATTR='data-dragctx';
const TYPE='application-x-avnav-dnd';
export const useAvNavSortable=(id)=>{
    const context= useContext(SortContextImpl);
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
        draggable: true,
        ref: (el)=>{
            context.handler.ref(id,el);
        }
    }
    rt[ATTR]=id;
    return rt;
}

export const useAvNavSortFrame=()=>{
    const context= useContext(SortContextImpl);
    let rt={
        onDragOver:(ev)=>{
            let ta=ev.target.getAttribute(CATTR);
            if ( ta !== undefined) {
                const tdatas=ev.dataTransfer.getData(TYPE);
                if (tdatas !== undefined) {
                    ev.preventDefault();
                }
            }
        },
        onDrop: (ev)=>{
            ev.preventDefault();
            let dids=ev.dataTransfer.getData(TYPE);
            let tdata=JSON.parse(dids);
            if (tdata.ctxid !== context.id) return;
            let bestMatching=context.handler.findPosition({
                left:ev.clientX-tdata.offset.x,
                top:ev.clientY-tdata.offset.y,
                height: tdata.rect.height,
                width: tdata.rect.width
            },tdata.id,context.mode);
            //console.log("best matching",bestMatching);
            if (bestMatching !== undefined && bestMatching !== tdata.id && context.onDragEnd){
                context.onDragEnd(tdata.id,bestMatching);
            }
        }
    }
    rt[CATTR]=context.id;
    return rt;
}


export const SortContext=({onDragEnd,id,mode,children})=>{
    return <SortContextImpl.Provider value={{
        onDragEnd: onDragEnd,
        id:id,
        mode:mode,
        handler: new SortHandler()
    }}>
        {children}
    </SortContextImpl.Provider>
}
