
/**
 * # Copyright (c) 2012-2025 Andreas Vogel andreas@wellenvogel.net
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
 */
import React from 'react';
import {ButtonDef} from "./Button";
import {IHistory} from "../util/history";
 export interface PageFrameProps{
    className?: string;
    autoHideButtons?: number;
    hideCallback?: ()=>void;
    editingChanged?: ()=>void;
    id: string;
    children?: React.ReactNode;
}
export interface PageLeftProps{
     className?: string;
     title?: string;
     children?: React.ReactNode;
}

export interface PageBaseProps{
    className?: string;
    style?: Record<string, any>;
    options?: Record<string, any>;
    location: string;
    small: boolean;
}
export interface PageProps extends PageBaseProps{
     id: string;
    title?: string;
    mainContent?: React.ReactNode;
    floatContent?: React.ReactNode;
    bottomContent?: React.ReactNode;
    buttonList?: ButtonDef[]|Record<string, any>[];
    style?: Record<string, any>;
    buttonWidthChanged?: ()=>void;
    autoHideButtons?: number; //ms or undefined
    windowDimensions?: any;
    history: IHistory
}

export declare function PageFrame(iprops:PageFrameProps,ref:any):JSX.Element;

export declare function PageLeft(iprops:PageLeftProps):JSX.Element;