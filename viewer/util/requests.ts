/*
# Copyright (c) 2022,2025 Andreas Vogel andreas@wellenvogel.net

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
#  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
#  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
#  DEALINGS IN THE SOFTWARE.
*/

import globalStore from './globalstore';
import keys from './keys';
import globalstore from "./globalstore";
import base from "../base";

class ResponseError extends Error {
    code: number;
    txt: string;
    constructor(response:{status: number, statusText: string}) {
        super();
        this.code=response.status;
        this.txt=response.statusText;
    }
    toString() {
        return this.txt;
    }
}
export interface RequestOptions{
    resolveObject?: boolean; //include the Response
    checkOk?: boolean;  //default true
    sequenceFunction?: ()=>number;
    useNavUrl?:boolean; //default true
    timeout?:number;
    noCache?: boolean;
}
export type UrlType=URL|string|Record<string, any>;
export type HeaderType=Record<string, any>;
export interface FetchOptions extends RequestInit{
    timeout?:number;
    headers?:Record<string, string>
}
/**
 *
 * @param url either a string or a dict with request parameters
 *            if it is a dict it's treated as an api request using the api url
 *            if it is a string it depends on the flag useNavUrl in options - if not set or true the navurl will be prepended
 * @param options
 * @returns {string}
 */
export const prepareUrl=(url:UrlType, options?:RequestOptions)=>{
    if (url === undefined) {
        return undefined;
    }
    let rurl="";
    if (url instanceof URL){
        url=url.toString();
    }
    if (typeof(url) === 'string') {
        rurl=url;
        if ( options && options.useNavUrl !== false ) {
            rurl = globalStore.getData(keys.gui.global.navUrl) + rurl;
        }
        return rurl;
    }
    //new syntax for parameter object instead of url
    if (typeof(url) === 'object'){
        rurl=globalStore.getData(keys.gui.global.navUrl);
        const {request,type,command,...other} = url;
        if (request && request !== 'api'){
            throw new Error("invalid request "+request);
        }
        if ((type !== undefined) && (command !== undefined)){
            rurl=addParameters(rurl+'/'+type+'/'+command,other);
        }
        else {
            rurl = addParameters(rurl, url);
        }
        //always add a _ parameter with the current date to API requests
        //to avoid any caching
        rurl=addParameters(rurl,{'_':(new Date()).getTime()});
    }
    return rurl;

};

export const buildProxyUrl=(url:URL|string, baseUrl:URL|string,headers:HeaderType,parameters:Record<string,any>)=>{
    if (! (url instanceof URL)){
        url=new URL(url,baseUrl||window.location.href);
    }
    if (url.origin === window.location.origin){
        return url.toString();
    }
    const proxyUrl=new URL("/proxy/"+encodeURIComponent(url.toString()),window.location.href);
    if (headers){
        for (const k in headers){
            proxyUrl.searchParams.append("h:"+k, headers[k]);
        }
    }
    if (parameters){
        for (const k in parameters){
            proxyUrl.searchParams.append(k, parameters[k]);
        }
    }
    return proxyUrl.toString();
}

const prepareInternal=
    (url:UrlType, options:RequestOptions):[url:string,options:FetchOptions]=>{
    if (url === undefined) {
        return [undefined,undefined];
    }
    const ioptions={...options};
    const rurl=prepareUrl(url, ioptions);
    if (ioptions.timeout === undefined) ioptions.timeout=parseInt(globalStore.getData(keys.properties.networkTimeout));
    let headers:HeaderType=undefined;
    if ( !(ioptions && ioptions.noCache !== undefined && !ioptions.noCache)){
        headers={};
        headers['pragma']='no-cache';
        headers['cache-control']='no-cache';
    }
    const requestOptions:FetchOptions={};
    if (headers) requestOptions.headers=headers;
    requestOptions.timeout=ioptions.timeout;
    return [rurl,requestOptions];
}


export const fetchWithTimeout=(url:string|URL,options?:FetchOptions)=>{
    const timeout=(options||{}).timeout;
    if (timeout === undefined){
        return fetch(url,options);
    }
    const foptions={...options};
    if (typeof(AbortSignal.timeout) === 'function'){
        foptions.signal=AbortSignal.timeout(timeout);
    }
    else{
        const controller = new AbortController();
        foptions.signal=controller.signal;
        self.setTimeout(()=>controller.abort(),timeout);
    }
    return fetch(url,foptions);
}


const handleJson=(
    rurl:string|URL,
    requestOptions:FetchOptions,
    options?:RequestOptions):Promise<Record<string,any>> => {
    return new Promise((resolve,reject)=>{
        if (!rurl) {
            reject("missing url");
            return;
        }
        let sequence=undefined;
        if (options && options.sequenceFunction) sequence=options.sequenceFunction();
        fetchWithTimeout(rurl,requestOptions).then(
            (response)=>{
                if (response.status < 200 || response.status >= 300){
                    reject(new ResponseError(response));
                    return;
                }
                if (response.ok){
                    return response.json();
                }
                else{
                    reject(new ResponseError(response));
                }
            },
            (error)=>{
                reject(error.message);
            }).then((json)=>{
                if (sequence !== undefined){
                    if (sequence != options.sequenceFunction()) {
                        reject("sequence changed");
                        return;
                    }
                }
                if (! json){
                    reject("empty response");
                    return;
                }
                if ( ! (options && options.checkOk !== undefined && ! options.checkOk)){
                    if (! json.status || (json.status !== 'OK' && json.status != 'ok')){
                        reject("status: "+json.status);
                        return;
                    }
                }
                resolve(json);
            },(jsonError)=>{
                reject(jsonError);
            });
    });
};

const addParameters=(url:string,parameters:Record<string, any>)=>{
    if (!parameters) return url;
    for (const k in parameters){
        const v=parameters[k];
        if (v === undefined) continue;
        if (typeof(v) == 'function' || typeof(k) == 'object') continue;
        if (url.match(/\?/)) url+="&";
        else url+="?";
        url+=encodeURIComponent(k)+"="+encodeURIComponent(v);
    }
    return url;
};
const handleAndroidPost=(url:string|URL,body:string)=>{
    return new Promise((resolve,reject)=> {
        //we need to build the full url here
        //as the navUrl could just be relative
        const fullUrl=new URL(url,window.location.href);
        // @ts-ignore
        const res=JSON.parse(window.avnavAndroid.handleUpload(fullUrl.toString(), body));
        if (res.status === 'OK'){
            resolve(res);
            return;
        }
        else{
            reject(res.info||res.status);
            return;
        }
    });
};
export type TextResponse=Promise<{data:string,response:Response}>
export interface UploadFileParam{
    starthandler:(param:UploadFileParam,xhr:XMLHttpRequest)=>void;
    progresshandler:(param:UploadFileParam,event:ProgressEvent)=>void;
    errorhandler:(param:UploadFileParam,error:string)=>void;
    okhandler:(param:UploadFileParam,result:Record<string,any>)=>void;
}
const RequestHandler={
    /**
     * do a json get request
     * @param url - either string or object with request parameters
     *        useNavUrl - (default: true) - prepend the navUrl to the provided url
     *        checkOk   - (default: true) - check if the response has a status field and this is set to "OK"
     *        noCache   - (default: true) - prevent caching
     *        timeout   - (default: statusQueryTimeout) - timeout
     *        sequenceFunction - if set: a function to return a sequence - if the one returned from start
     *                           does not match the on at the result we reject
     *        opt_parameter - object with request parameters
     * @param options
     * @param opt_parameter
     */
    getJson:(url:UrlType,options?:RequestOptions,opt_parameter?:Record<string,any>)=>{
        const [rurl,requestOptions]=prepareInternal(url,options);
        return handleJson(addParameters(rurl,opt_parameter),requestOptions,options);
    },
    postJson:(url:UrlType,body:any,options?:RequestOptions,opt_parameters?:Record<string, any>)=>{
        // eslint-disable-next-line prefer-const
        let [rurl,requestOptions]=prepareInternal(url,options);
        requestOptions.method='POST';
        rurl=addParameters(rurl,opt_parameters);
        if (!requestOptions.headers) requestOptions.headers={};
        requestOptions.headers['content-type']='application/json';
        const encodedBody=JSON.stringify(body);
        // @ts-ignore
        if (window.avnavAndroid){
            return handleAndroidPost(rurl,encodedBody)
        }
        requestOptions.body=encodedBody;
        return handleJson(rurl,requestOptions,options);
    },

    postPlain:(url:UrlType,body:any,options?:RequestOptions,opt_parameters?:Record<string, any>)=>{
        // eslint-disable-next-line prefer-const
        let [rurl,requestOptions]=prepareInternal(url,options);
        rurl=addParameters(rurl,opt_parameters);
        requestOptions.method='POST';
        if (!requestOptions.headers) requestOptions.headers={};
        requestOptions.headers['content-type']='application/octet-string';
        // @ts-ignore
        if (window.avnavAndroid){
            return handleAndroidPost(rurl,body);
        }
        requestOptions.body=body;
        return handleJson(rurl,requestOptions,options);
    },
    /**
     * do a json get request
     * @param url either string or object with request parameters
     *        useNavUrl - (default: false) - prepend the navUrl to the provided url
     *        noCache   - (default: false) - prevent caching
     * @param options
     * @param opt_parameter request parameters
     */

    getHtmlOrTextWithResponse:(url:UrlType,options?:RequestOptions,opt_parameter?:Record<string,any>):TextResponse=>{
        // eslint-disable-next-line prefer-const
        let [rurl,requestOptions]=prepareInternal(url,{...options,useNavUrl:false,noCache:false});
        return new Promise((resolve,reject)=>{
          rurl=addParameters(rurl,opt_parameter)
          if (!rurl) {
            reject("missing url");
            return;
          }
          let sequence=undefined;
          if (options && options.sequenceFunction) sequence=options.sequenceFunction();
          let finalResponse:Response;
          fetchWithTimeout(rurl,requestOptions).then(
              (response)=>{
                  if (response.status < 200 || response.status >= 300){
                      reject(new ResponseError(response));
                  }
                  if (response.ok){
                      finalResponse=response;
                      return response.text();
                  }
                  else{
                      reject(new ResponseError(response));
                  }
              },
              (error)=>{
                  reject(error.message);
              }).then((text:string)=> {
              if (sequence !== undefined) {
                  if (sequence != options.sequenceFunction()) {
                      reject("sequence changed");
                      return;
                  }
              }
              resolve({data: text, response: finalResponse});
              },(error)=>{
                  reject(error);
              });
        });
    },

    getHtmlOrText:(url:UrlType,options?:RequestOptions,opt_parameter?:Record<string,any>):Promise<string> => {
        return RequestHandler.getHtmlOrTextWithResponse(url,options,opt_parameter).then((response)=>{
            return response.data;
        })
    },

    /**
     * @param url {string}
     * @param file {File}
     * @param param parameter object
     *        all handlers get the param object as first parameter
     *        starthandler: will get the xhdr as second parameter - so it can be used for interrupts
     *        progresshandler: progressfunction
     *        okhandler: called when done
     *        errorhandler: called on error
     *        see https://mobiarch.wordpress.com/2012/08/21/html5-file-upload-with-progress-bar-using-jquery/
     */

    uploadFile: (url:string|URL, file:File, param:UploadFileParam)=> {
        const type = "application/octet-stream";
        try {
            const xhr=new XMLHttpRequest();
            xhr.open('POST',url,true);
            xhr.setRequestHeader('Content-Type', type);
            xhr.addEventListener('load',()=>{
                if (xhr.status != 200){
                    if (param.errorhandler) param.errorhandler(param,xhr.statusText);
                    return;
                }
                let json=undefined;
                try {
                    json = JSON.parse(xhr.responseText);
                    if (! json.status || json.status != 'OK'){
                        if (param.errorhandler) param.errorhandler(param,"invalid status: "+json.status);
                        return;
                    }
                }catch (e){
                    if (param.errorhandler) param.errorhandler(param,e);
                    return;
                }
                if (param.okhandler) param.okhandler(param,json);
            });
            xhr.upload.addEventListener('progress',(event)=>{
                if (param.progresshandler) param.progresshandler(param,event);
            });
            xhr.addEventListener('error',()=>{
               if (param.errorhandler) param.errorhandler(param,"upload error");
            });
            if (param.starthandler) param.starthandler(param,xhr);
            xhr.send(file);
        } catch (e) {
            if (param.errorhandler) param.errorhandler(param,e);
        }
    },
    getLastModified:(url:string|URL)=>{
        if (! globalstore.getData(keys.gui.capabilities.fetchHead,false)){
            return Promise.resolve(0);
        }
        const options={
            timeout: parseInt(globalStore.getData(keys.properties.networkTimeout)),
            method:'HEAD'
        }
        return fetchWithTimeout(url,options)
            .then((response)=>{
                    return response.headers.get('last-modified')
                }
                ,(err)=>{
                base.log("error getLastModified "+url+": "+err);
                return 0;
                })
    }
};
Object.freeze(RequestHandler);

export default RequestHandler;