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
import {modules} from './api.impl';
const ts=((new Date()).getTime()+"").replace(/[^0-9a-zA-Z]/g, '');
const avnav="avnav"+ts;
const avnmod="modules";
// @ts-ignore
if (! window[avnav]) {
    // @ts-ignore
    window[avnav] = {};
}
// @ts-ignore
if (! window[avnav][avnmod]) {
    // @ts-ignore
    window[avnav][avnmod] = {};
}
// @ts-ignore
window[avnav][avnmod]=modules;

// @ts-ignore
Object.freeze(window[avnav][avnmod]);

const buildExport=(name:string):string=>{
    let rt:string='';
    // @ts-ignore
    const module=modules[name];
    if (typeof(module) === 'object'){
        for (const k of Object.keys(module)) {
            if (module[k] != null) {
                rt += `
                export const ${k}=window.${avnav}.${avnmod}.${name}.${k}\n
                `
            }
        }
    }
    rt+=`export default window.${avnav}.${avnmod}.${name}`;
    return rt;
}

export default ()=>{
    const importmap:Record<string, Record<string, string>> = {
        imports: {
        }
    }
    for (const name of Object.keys(modules)){
        const mname=name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
        const mexports=`data:text/javascript,${buildExport(name)}`
        importmap.imports[name] = mexports;
        importmap.imports[mname]=mexports
    }
    const m=document.createElement('script');
    m.setAttribute('type','importmap');
    m.textContent=JSON.stringify(importmap);
    document.head.appendChild(m);
}