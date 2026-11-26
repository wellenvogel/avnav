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
let mvar={};
export const __init=(module)=>{
    mvar=module;
    Children = module.Children;
    Component = module.Component;
    Fragment = module.Fragment;
    Profiler = module.Profiler;
    PureComponent = module.PureComponent;
    StrictMode = module.StrictMode;
    Suspense = module.Suspense;
    __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = module.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
    act = module.act;
    cloneElement = module.cloneElement;
    createContext = module.createContext;
    createElement = module.createElement;
    createFactory = module.createFactory;
    createRef = module.createRef;
    forwardRef = module.forwardRef;
    isValidElement = module.isValidElement;
    lazy = module.lazy;
    memo = module.memo;
    startTransition = module.startTransition;
    unstable_act = module.unstable_act;
    useCallback = module.useCallback;
    useContext = module.useContext;
    useDebugValue = module.useDebugValue;
    useDeferredValue = module.useDeferredValue;
    useEffect = module.useEffect;
    useId = module.useId;
    useImperativeHandle = module.useImperativeHandle;
    useInsertionEffect = module.useInsertionEffect;
    useLayoutEffect = module.useLayoutEffect;
    useMemo = module.useMemo;
    useReducer = module.useReducer;
    useRef = module.useRef;
    useState = module.useState;
    useSyncExternalStore = module.useSyncExternalStore;
    useTransition = module.useTransition;
    version = module.version;


}
export {mvar as default };
export let Children;
export let Component;
export let Fragment;
export let Profiler;
export let PureComponent;
export let StrictMode;
export let Suspense;
export let __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
export let act;
export let cloneElement;
export let createContext;
export let createElement;
export let createFactory;
export let createRef;
export let forwardRef;
export let isValidElement;
export let lazy;
export let memo;
export let startTransition;
export let unstable_act;
export let useCallback;
export let useContext;
export let useDebugValue;
export let useDeferredValue;
export let useEffect;
export let useId;
export let useImperativeHandle;
export let useInsertionEffect;
export let useLayoutEffect;
export let useMemo;
export let useReducer;
export let useRef;
export let useState;
export let useSyncExternalStore;
export let useTransition;
export let version;