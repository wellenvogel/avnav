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

import React, {createContext, DragEvent, useContext} from 'react';
import PropTypes from "prop-types";

export enum SortModes{
    horizontal=0,
    vertical=1
}

export type OnDragEnd=(oldIndex:number,newIndex:number,oldFrame:number|string,targetFrame:number|string) => void;

let sid=0;
const uniqId=()=>{
    sid++;
    return sid;
}

const percentOverlap=(itstart:number,itext:number,cmpstart:number,cmpext:number)=>{
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
interface Rectangle{
    top:number;
    left:number;
    height:number;
    width:number;
}
export type DragId=string|number
class SortHandler{
    private mode:SortModes;
    private reverse: boolean;
    private refs:Record<number, HTMLElement>;

    constructor(mode: SortModes, reverse?: boolean) {
        this.refs = {};
        this.mode=mode;
        this.reverse=reverse;
    }
    ref(id:DragId,el:HTMLElement):void{
        id=parseInt(id as string);
        if (el) this.refs[id]=el;
        else delete this.refs[id];
    }
    findPosition(dragRect:Rectangle){
        const bestMatching=[];
        let maxv:number=undefined;
        let minv:number=undefined;
        let minid=undefined;
        let maxid=undefined;
        const itemstart=(this.mode===SortModes.vertical)?dragRect.top:dragRect.left;
        const itemext=(this.mode===SortModes.vertical)?dragRect.height:dragRect.width;
        const se=(rect:Rectangle)=>{
            if (this.mode===SortModes.vertical){
                return {start:rect.top,ext:rect.height};
            }
            else{
                return{start:rect.left,ext:rect.width};
            }
        }
        const d=(rect:Rectangle)=>{
            const {start,ext}=se(rect);
            if (minv === undefined || start < minv ) minv=start;
            if (maxv === undefined || (start+ext) > maxv) maxv=start+ext;
            return percentOverlap(itemstart,itemext,start,ext);
        }
        for (const idx in this.refs){
            const k=parseInt(idx as string);
            if (minid === undefined || k < minid) minid=k;
            if (maxid === undefined || k > maxid) maxid=k;
            const el=this.refs[k];
            if (! el){
                continue;
            }
            const elrect=el.getBoundingClientRect();
            const match=d(elrect);
            if (match > 0) bestMatching.push({match:match,id:k});
        }
        if (bestMatching.length < 1) {
            if (minid === undefined){
                //no elements at all
                return 0;
            }
            //check above/below
            if (itemstart <= minv) return this.reverse?maxid+1:minid;
            if ((itemstart + itemext) > maxv) return this.reverse?minid:maxid + 1;
            return undefined;
        }
        bestMatching.sort((a,b)=>{
            return b.match - a.match;
        });
        if (bestMatching[0].match < 50){
            //check if we are more after
            if (this.reverse){
                if (bestMatching[0].id === maxid && itemstart < minv) {
                    return minid;
                }
            }
            else {
                if (bestMatching[0].id === maxid && (itemstart + itemext) > maxv) {
                    return maxid + 1;
                }
            }
        }
        return bestMatching[0].id;
    }
}
interface SortContextImplProps extends SortContextProps{
    handler:any,
    uniqId:number|string
}
const DefaultSortContext:SortContextImplProps={
    id:undefined,
        onDragEnd:undefined as OnDragEnd,
        handler:undefined,
        allowOther: false,
        uniqId: undefined,
        mode:SortModes.vertical
}
const SortContextImpl=createContext(DefaultSortContext);

export const SortableProps={
    dragId: PropTypes.number
}

const ATTR='data-dragid';
const CATTR='data-dragctx';
const TYPE='application-x-avnav-dnd';
interface Offset{x:number; y:number}
export const useAvNavSortable=(id:DragId,opt_nodrag?:boolean)=>{
    const context= useContext(SortContextImpl);
    if (id === undefined || context.uniqId === undefined) return {};
    const rt={
        onDragStart:(ev:DragEvent)=>{
            const data={
                rect: (ev.currentTarget as Element).getBoundingClientRect(),
                id: id,
                client: {x:ev.clientX,y:ev.clientY},
                ctxid: context.id,
                uniqId: context.uniqId,
                offset: undefined as Offset,
            };
            data.offset={x:data.client.x-data.rect.left,y:data.client.y-data.rect.top}
            ev.dataTransfer.setData(TYPE,JSON.stringify(data));
        },
        ref: (el:HTMLElement)=>{
            context.handler.ref(id,el);
        },
        draggable:false,
        [ATTR]:id
    }
    if (opt_nodrag !== true){
        rt.draggable=true;
    }
    return rt;
}
const isSet=(val:any)=>val !== null && val !== undefined;
export const useAvNavSortFrame=()=>{
    const context= useContext(SortContextImpl);
    const rt={
        onDragOver:(ev:DragEvent)=>{
            const ta=(ev.currentTarget as Element).getAttribute(CATTR);
            if ( ta !== undefined) {
                const tdatas=ev.dataTransfer.getData(TYPE);
                if (tdatas !== undefined) {
                    ev.preventDefault();
                }
            }
        },
        onDrop: (ev:DragEvent)=>{
            ev.preventDefault();
            ev.stopPropagation();
            const dids=ev.dataTransfer.getData(TYPE);
            const tdata=JSON.parse(dids);
            const other=tdata.uniqId !== context.uniqId;
            if (other) {
                if (!context.allowOther) return;
                //moving between frames requires the id's to be set
                if (!isSet(context.id) || !isSet(tdata.id)) return;
            }
            const bestMatching=context.handler.findPosition({
                left:ev.clientX-tdata.offset.x,
                top:ev.clientY-tdata.offset.y,
                height: tdata.rect.height,
                width: tdata.rect.width
            },tdata.id,context.mode);
            //console.log("best matching",bestMatching);
            if (bestMatching !== undefined && (other || (bestMatching !== tdata.id)) && context.onDragEnd){
                context.onDragEnd(tdata.id,bestMatching,tdata.ctxid,context.id);
            }
        },
        [CATTR]:context.uniqId
    }
    return rt;
}

export const useAvnavSortContext=()=>useContext(SortContextImpl);

export interface SortContextProps{
    onDragEnd?: OnDragEnd
    id:number,
    mode: SortModes,
    children?: React.ReactNode,
    allowOther?: boolean,
    reverse?: boolean
}
export const SortContext=({onDragEnd,id,mode,children,allowOther,reverse}:SortContextProps)=>{
    return <SortContextImpl.Provider value={{
        onDragEnd: onDragEnd,
        id:id,
        handler: new SortHandler(mode,reverse),
        allowOther: allowOther,
        uniqId: uniqId(),
        mode:mode
    }}>
        {children}
    </SortContextImpl.Provider>
}

export const moveItem=(oldIndex:number,newIndex:number,list:any[])=>{
    if (oldIndex < 0 || oldIndex >= list.length) return;
    if (newIndex < 0 ) return;
    const next=[...list];
    const item=next[oldIndex];
    next.splice(oldIndex,1);
    next.splice(newIndex,0,item);
    return next;
}
