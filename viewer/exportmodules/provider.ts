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
import {modules} from '../util/api.impl';
import base from "../base";
const URL_PREFIX="/modules/";

const checkModule=(api:Record<string, any>,module:any,name:string):boolean => {
    if (! api.default) throw new Error(`missing default for module "${name}"`);
    if (typeof(module) === 'object'){
        const errors:string[]=[];
        for (const k of Object.keys(module)) {
            if (module[k] != null && api[k] == null) {
                errors.push(k);
            }
        }
        if (errors.length > 0) {
            let errstr="";
            errors.forEach((e:string)=>{
                errstr+=`${e} = module.${e};\n`
            })
            errstr+="\n"
            errors.forEach((e:string)=>{
                errstr+=`export let ${e};\n`
            })
            base.error(`missing exports for ${name}:\n${errstr}`);
            return false;
        }
        return true;
    }
}
const nameToModule=(name: string,url:boolean=true)=>{
    const rt=name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    if (url) return URL_PREFIX+rt+'.js';
    return rt;
}

export default async ()=>{
    for (const name of Object.keys(modules)){
        const murl=nameToModule(name)
        try {
            // @ts-ignore
            const moduleApi = await import(/* webpackIgnore: true */murl);
            if (typeof(moduleApi.__init) !== 'function'){
                throw new Error(`Module '${murl}' has no __init`);
            }
            // @ts-ignore
            moduleApi.__init(modules[name]);
            // @ts-ignore
            if (checkModule(moduleApi,modules[name],murl)){
                base.log("loaded module",murl,name);
            }
        }catch (e){
            base.error("unable to load module ",murl,e);
        }
    }
}