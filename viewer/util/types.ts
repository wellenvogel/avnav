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

import PropTypes from "prop-types";
import {SyntheticEvent} from "react";

export type InternalWidgetDefinition = Record<string, any>

export interface IWidgetProps extends SortableProps {
    onClick?: (ev: SyntheticEvent) => void,
    style?: Record<string, any>,
    className?: string,
    name: string,
    mode?: string, //display info side by side if small
    caption?: string,
    nightMode?: boolean,
}

export const WidgetProps: Record<keyof IWidgetProps, any> = {
    dragId: PropTypes.any,
    name: PropTypes.any,
    onClick: PropTypes.any,
    style: PropTypes.any,
    className: PropTypes.any,
    mode: PropTypes.any,
    caption: PropTypes.any,
    nightMode: PropTypes.any
}

export interface SortableProps {
    dragId: number
}