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
/**
 * new dialog concept 2026/02
 * we need 2 modes of the dialog context:
 * (1) when not inside a dialog:
 *   - showDialog - normal
 *   - replaceDialog - similar to show
 *   - closeDialog - close the current dialog
 *
 *  (2) when inside a dialog
 *   - showDialog: show new dialog, keep existing open
 *   - replaceDialog: replace the current dialog
 *   - closeDialog: close the current dialog
 *
 * So (1) and (2) should be handled by a parent relationship.
 * The child should the one being returned from useDialogContext
 * when within a dialog.
 * Beside the parent-child for nested dialogs we need a way to control the display
 * that is used for a dialog (and at the same time the state object).
 * This needs to ensure that e.g. a dialog is closed when leaving a page.
 *
 * Concept:
 * (A) There will be a dialogContext class that implements the methods
 * showDialog, replaceDialog, closeDialog. Additionally it will have
 * the methods setDisplay,resetDisplay that stores/removes a setDialog
 * function. Each display must have a unique id.
 * Whenever a setDisplay is called and there is currently another display
 * already active the dialog at the old display will be closed.
 * Multiple set/reset calls with the same id will do nothing but just exchange
 * the setDialog/resetDialog functions.
 * So at any point in time there is at most one DialogDisplay being active
 * at a dialog context. Normally this is either the PageLeft or an existing
 * dialog for nested dialogs.
 * The z-Index is also maintained inside this context class.
 * (B) An instance of this class is created globally and is used for
 * all showDialog functions without an explicit context.
 * (C) The App will be the first calling setDisplay so that there
 * is always a DialogDisplay - even if no other object is there.
 * (D) PageLeft will be the next calling setDisplay. This ensures
 * dialogs to be shown at the left part only and additionally
 * automatic removal of dialogs when leaving a page.
 * (E) When creating a dialog a new instance of the DialogContextImpl
 * class is created, forwarding replaceDialog to the parent.
 */


import React, {createContext, useContext} from "react";
import base from "../base";

/**
 * the basic overlay dialog elements
 */


const DIALOG_Z = 120;

export type DialogCallback=()=>(Promise<void>|void);
export interface SetDialogOptions extends Record<string, any> {
    dialogClassName?: string;
    coverClassName?: string;
}
export type SetDialogFunction=(dialog?:React.ElementType,closeCallback?:DialogCallback,options?:SetDialogOptions) => Promise<DialogCallback>;
class DialogDisplayEntry {
    setDialog:SetDialogFunction;
    closeDialog:DialogCallback;
    id:string;
    constructor(id:string,setDialog?:SetDialogFunction,closeDialog?:DialogCallback) {
        this.setDialog = setDialog|| (():Promise<DialogCallback>=>{
            return Promise.resolve(()=>{})
        });
        this.closeDialog = closeDialog|| (() => {}) ;
        this.id = id;
    }

}
export interface IDialogContext {
    showDialog: SetDialogFunction;
    closeDialog: DialogCallback;
    replaceDialog: SetDialogFunction;
    getId():number;
}
export class DialogContextImpl implements IDialogContext {
    display:DialogDisplayEntry;
    zIndex:number;
    parent:DialogContextImpl;
    private readonly idx:number;
    constructor(id:number,parent?:DialogContextImpl) {
        this.idx=id;
        if (!parent) {
            this.zIndex = DIALOG_Z;
        } else {
            this.zIndex = parent.zIndex + 10;
            this.parent = parent;
        }
        this.closeDialog = this.closeDialog.bind(this);
        this.showDialog = this.showDialog.bind(this);
        this.replaceDialog = this.replaceDialog.bind(this);
        this.getId = this.getId.bind(this);
    }
    getId():number {
        return this.idx;
    }

    _getDisplay():DialogDisplayEntry {
        if (this.display) return this.display;
        return {
            closeDialog(): Promise<void> | void {
                return undefined;
            },
            id: undefined,
            setDialog(): Promise<DialogCallback> {
                return Promise.resolve(undefined);
            }

        }
    }

    showDialog(content:React.ElementType, closeCallback?:DialogCallback, options?:any) {
        return this._getDisplay().setDialog(content, closeCallback, options);
    }

    async closeDialog() {
        //only go up to first parent
        //we cannot call closeDialog at the parent as this would potentially
        //go up further
        if (this.parent) await this.parent._getDisplay().closeDialog();
        await this._getDisplay().closeDialog();
    }

    replaceDialog(content:React.ElementType, closeCallback?:DialogCallback, options?:any) {
        if (this.parent) return this.parent.showDialog(content, closeCallback, options);
        return this.showDialog(content, closeCallback, options);
    }

    setDisplay(id:string,setDialogFunction:SetDialogFunction,closeDialog:DialogCallback) {
        const current = this._getDisplay();
        if (current.id !== id) {
            current.closeDialog(); //cleanup any dialog if we change the display
        }
        this.display=new DialogDisplayEntry(id, setDialogFunction, closeDialog);
        return this._getDisplay().id;
    }

    removeDisplay(id:string) {
        if (this.display?.id === id) {
            this.display=undefined;
            return true;
        }
        return false;
    }

}
export const globalContext = new DialogContextImpl(0);
export const ReactDialogContextImpl = createContext(globalContext);
export const useDialogContext = () => useContext(ReactDialogContextImpl);

/**
 * we must manage the close callbacks of dialogs outside of the
 * rendering itself
 * the original idea to close dialogs (i.e. call closing callbacks) when a display
 * detaches does not work as useEffect can at least run multiple times during the
 * lifecycle of a display
 * so we manage here a hierarchical list of the open callbacks
 * each callback ist identified by 3 ids:
 * (1) id of the parent dialog (the one that is used by the dialog display
 *     that shows the dialog
 * (2) a display id. In theory there could be more than one display for a
 *     dialog context (in practice not used). But to be on the safe side we handle
 *     this.
 * (3) The dialog id of the dialog that this callback belongs to. Alls children of this
 *     dialog will have this idea as their (1) identifier
 *
 * When a dialog is created a new entry is stored (with our without a callback).
 * When a dialog is explictly closed (a) or whe a dialog display renders without an active
 * dialog (b) the resetDialog is called. For (a) with 3 parameters, for (b) oly with the parent
 * dialog id and the display id (this handling all potentially open dialogs for this display).
 *
 * By considering the relationship between (1) and (3) we can handle a situation when a nested dialog
 * disappears without rendering once without dialog. At least the default dialog will be available
 * as long as the application is running. And a render of this display without any know dialog
 * will clean up everything.
 */
interface DisplayEntry{
    id:number;
    callback:DialogCallback;
}
type ContextEntry=Record<string, DisplayEntry>;
class DialogCloseManager{
    private dialogs:Record<number,ContextEntry>={}
    constructor() {}
    cleanup(ctxId:number,displayId:string){
        base.log("cleanup",ctxId,displayId);
        //build a list of all cleanups
        const cleanups:Record<number, DialogCallback> = {};
        const cleanPart=(ctxId:number,displayId?:string)=>{
            base.log("cleanPart",ctxId,displayId);
            const existing = this.dialogs[ctxId];
            if (!existing) return;
            const displays=displayId?[displayId]:Object.keys(existing);
            for (const display of displays) {
                const existingDisplay = existing[display];
                if (!existingDisplay) continue;
                if (existingDisplay.callback){
                    cleanups[existingDisplay.id]=existingDisplay.callback;
                }
                if (existingDisplay.id !== ctxId) {
                    cleanPart(existingDisplay.id);
                }
                delete existing[display];
            }
            if (Object.keys(existing).length < 1){
                delete this.dialogs[ctxId];
            }
        }
        cleanPart(ctxId,displayId);
        window.requestAnimationFrame(()=>{
            for (const callback of Object.entries(cleanups)){
                base.log("cleanup callback for",callback[0]);
                callback[1]();
            }
        });

    }
    setDialog(ctxId:number,displayId:string,childId:number,closeAction?:DialogCallback):void {
        base.log("setDialog",ctxId,displayId,childId);
        let old=this.dialogs[ctxId];
        if (old){
            const oldEntry=old[displayId];
            if (oldEntry){
                if (oldEntry.id !== childId){
                    this.cleanup(ctxId,displayId);
                }
            }
        }
        //any cleanup done
        old=this.dialogs[ctxId];
        if (!old) {
            old = {};
            this.dialogs[ctxId] = old;
        }
        old[displayId]={
            id:childId,
            callback:closeAction
        }
    }
    resetDialog(ctxId:number,displayId:string,childId?:number):void {
        base.log("resetDialog",ctxId,displayId,childId);
        const old=this.dialogs[ctxId];
        if (!old) return;
        const oldEntry=old[displayId];
        if (!oldEntry) return;
        if (childId !== undefined && oldEntry.id !== childId) return;
        this.cleanup(ctxId,displayId);
    }
}

export const dialogManager=new DialogCloseManager();