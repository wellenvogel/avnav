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
 * function in a stack of such functions.
 * All show/replace/close functions will always work with the topmost
 * stack entry. When adding a new entry closeDialog will be called at
 * entry below.
 * The z-Index is alos maintained inside this context class.
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



import {createContext, useContext} from "react";

/**
 * the basic overlay dialog elements
 */


const DIALOG_Z = 120;
let dialogCtxId = 0;
const getCtxId = () => {
    dialogCtxId++;
    return dialogCtxId;
}

class DialogDisplayEntry {
    constructor(setDialog) {
        this.setDialog = setDialog;
        this.id = getCtxId();
    }

}

export class DialogContextImpl {
    constructor(parent) {
        this.displayStack = [];
        if (!parent) {
            this.zIndex = DIALOG_Z;
        } else {
            this.zIndex = parent.zIndex + 10;
            this.parent = parent;
        }
        this.displayStack.push(new DialogDisplayEntry(() => {
        }));
        this.closeDialog = this.closeDialog.bind(this);
        this.showDialog = this.showDialog.bind(this);
        this.replaceDialog = this.replaceDialog.bind(this);
    }

    _getTop() {
        return this.displayStack[this.displayStack.length - 1];
    }

    showDialog(content, opt_closeCb, opt_options) {
        return this._getTop().setDialog(content, opt_closeCb, opt_options);
    }

    closeDialog() {
        //only go up to first parent
        //we cannot call closeDialog at the parent as this would potentially
        //go up further
        if (this.parent) return this.parent._getTop().setDialog();
        return this._getTop().setDialog();
    }

    replaceDialog(content, opt_closeCb, opt_options) {
        if (this.parent) return this.parent.showDialog(content, opt_closeCb, opt_options);
        return this.showDialog(content, opt_closeCb, opt_options);
    }

    setDisplay(setDialogFunction) {
        const current = this._getTop();
        current.setDialog(); //cleanup any dialog if we change the display
        this.displayStack.push(new DialogDisplayEntry(setDialogFunction));
        return this._getTop().id;
    }

    removeDisplay(id) {
        //never remove the first entry from the stack
        for (let idx = 1; idx < this.displayStack.length; idx++) {
            if (this.displayStack[idx].id === id) {
                this.displayStack.splice(idx, 1);
                return true;
            }
        }
        return false;
    }

}

export const globalContext = new DialogContextImpl();
export const ReactDialogContextImpl = createContext(globalContext);
export const useDialogContext = () => useContext(ReactDialogContextImpl);