/**
 *###############################################################################
 # Copyright (c) 2012-2025 Andreas Vogel andreas@wellenvogel.net
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
import {createContext, useContext} from "react";
import React from 'react';
import PropTypes from "prop-types";

const buildContext=(history)=>{
    const f=(name)=> (...args)=>{
        if (history) return history[name](...args);
    }
    const rt={};
    for ( const n of ['replace','push','pop','reset','setOptions','currentLocation']){
        rt[n]=f(n)
    }
    return rt;
}
const HistoryContextImpl=createContext(buildContext());
export const useHistory=()=>useContext(HistoryContextImpl);
export const HistoryContext=({history,children})=>{
    return <HistoryContextImpl.Provider value={buildContext(history)}>
        {children}
    </HistoryContextImpl.Provider>
}
HistoryContext.propTypes={
    history:PropTypes.object,
    children:PropTypes.node,
}