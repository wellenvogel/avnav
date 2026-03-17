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
import {createContext, ReactNode, useContext} from "react";
import React from 'react';
import History, {HistoryEntry, HistoryOptions, IHistory} from "../util/history";


class IHistoryImpl implements IHistory {
    private history: History;
    constructor(history: History) {
        this.history = history;
    }

    currentLocation(opt_includeOptions?: boolean | undefined): string | HistoryEntry {
        if (! this.history) return;
        return this.history.currentLocation(opt_includeOptions);
    }

    pop(): void {
        if (! this.history) return;
        this.history.pop();
    }

    push(location: string, options: HistoryOptions | undefined): void {
        if (! this.history) return;
        this.history.push(location, options);
    }

    replace(location: string, options: HistoryOptions | undefined): void {
        if (! this.history) return;
        this.history.replace(location, options);
    }

    reset(): void {
        if (! this.history) return;
        this.history.reset();
    }

    setOptions(options: HistoryOptions | undefined): void {
        if (! this.history) return;
        this.history.setOptions(options);
    }

}
const buildContext=(history?:History):IHistory=>{
    return new IHistoryImpl(history);
}
const HistoryContextImpl=createContext(buildContext());
export const useHistory=()=>useContext(HistoryContextImpl);
export interface HistoryContextParameters{
    history:History;
    children: ReactNode;
}
export const HistoryContext=({history,children}:HistoryContextParameters)=>{
    return <HistoryContextImpl.Provider value={buildContext(history)}>
        {children}
    </HistoryContextImpl.Provider>
}
