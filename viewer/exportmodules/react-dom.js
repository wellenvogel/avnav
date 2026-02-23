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
let module={};
export const __init = (mvalue) => {
    module = mvalue;
    __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = module.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
    createPortal = module.createPortal;
    createRoot = module.createRoot;
    findDOMNode = module.findDOMNode;
    flushSync = module.flushSync;
    hydrate = module.hydrate;
    hydrateRoot = module.hydrateRoot;
    render = module.render;
    unmountComponentAtNode = module.unmountComponentAtNode;
    unstable_batchedUpdates = module.unstable_batchedUpdates;
    unstable_renderSubtreeIntoContainer = module.unstable_renderSubtreeIntoContainer;
    version = module.version;
}
export {module as default};
export let __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
export let createPortal;
export let createRoot;
export let findDOMNode;
export let flushSync;
export let hydrate;
export let hydrateRoot;
export let render;
export let unmountComponentAtNode;
export let unstable_batchedUpdates;
export let unstable_renderSubtreeIntoContainer;
export let version;