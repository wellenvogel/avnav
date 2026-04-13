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
import React, {ReactElement} from 'react';
import {useDialogContext} from "./DialogContext";
import {DBCancel, DialogButtons, DialogFrame} from "./OverlayDialog";
import {ListFrame} from "./ListItems";
import {ButtonEvent, ButtonRow, DynamicButtonProps} from "./Button";
import Helper from "../util/helper";

export interface ActionDialogProps{
    actionButtons:DynamicButtonProps[]
    className?:string;
    title?:ReactElement;
}

export const ActionDialog = (props:ActionDialogProps) => {
    const dialogContext = useDialogContext();
    return <DialogFrame
        className={Helper.concatsp('MainActionDialog',props.className)}
            title={props.title||'Actions'}>
        <ListFrame className={'ButtonList'}>
            {props.actionButtons.map((bt: DynamicButtonProps) => {
                return <ButtonRow
                    key={bt.name}
                    {...bt}
                    close={undefined}
                    onClick={(ev: ButtonEvent) => {
                        bt.onClick(ev);
                        if (bt.close !== false) {
                            dialogContext.closeDialog();
                        }
                    }}
                />
            })
            }
        </ListFrame>
        <DialogButtons buttonList={DBCancel()}/>
    </DialogFrame>
}