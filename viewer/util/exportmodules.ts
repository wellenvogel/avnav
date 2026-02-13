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
const avnav=Symbol("avnav");
const avnmod=Symbol("modules");
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

const buildExport=(name:string):string=>{
    let rt:string='';
    // @ts-ignore
    const module=modules[name];
    if (typeof(module) === 'function'){
        return `export default window.${String(avnav)}.${String(avnmod)}.${name}`;
    }
    else {
        for (const k of Object.keys(module)) {
            if (module[k] != null) {
                rt += `
                export const ${k}=window.${String(avnav)}.${String(avnmod)}.${name}.${k}\n
                `
            }
        }
    }
    return rt;
}

export default ()=>{
    const importmap:Record<string, Record<string, string>> = {
        imports: {
        }
    }
    for (const name of Object.keys(modules)){
        importmap.imports[name] = `data:text/javascript,${buildExport(name)}`;
    }
    const m=document.createElement('script');
    m.setAttribute('type','importmap');
    m.textContent=JSON.stringify(importmap);
    document.head.appendChild(m);
}