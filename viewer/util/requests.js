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

import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import assign from 'object-assign';
import 'whatwg-fetch-timeout';
import globalstore from "./globalstore";
import base from "../base";


const prepare=(url,options,defaults)=>{
    if (url === undefined) {
        return [undefined,undefined];
    }
    let rurl="";
    if (typeof(url) === 'string') rurl=url;
    let ioptions=assign({},defaults,options);
    if ( ioptions.useNavUrl !== false){
        rurl=globalStore.getData(keys.properties.navUrl)+rurl;
    }
    //new syntax for parametr object instead of url
    if (typeof(url) === 'object'){
        rurl=addParameters(rurl,url);
    }
    if (ioptions.timeout === undefined) ioptions.timeout=parseInt(globalStore.getData(keys.properties.networkTimeout));
    let headers=undefined;
    if ( !(ioptions && ioptions.noCache !== undefined && !ioptions.noCache)){
        headers={};
        headers['pragma']='no-cache';
        headers['cache-control']='no-cache';
    }
    let requestOptions={};
    if (headers) requestOptions.headers=headers;
    requestOptions.timeout=ioptions.timeout;
    return [rurl,requestOptions];
};

const handleJson=(rurl,requestOptions,options)=>{
    return new Promise((resolve,reject)=>{
        if (!rurl) {
            reject("missing url");
            return;
        }
        let sequence=undefined;
        if (options && options.sequenceFunction) sequence=options.sequenceFunction();
        fetch(rurl,requestOptions).then(
            (response)=>{
                if (response.status < 200 || response.status >= 300){
                    reject(response.statusText);
                    return;
                }
                if (response.ok){
                    return response.json();
                }
                else{
                    reject(response.statusText);
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

const addParameters=(url,parameters)=>{
    if (!parameters) return url;
    for (let k in parameters){
        let v=parameters[k];
        if (v === undefined) continue;
        if (typeof(v) == 'function' || typeof(k) == 'object') continue;
        if (url.match(/\?/)) url+="&";
        else url+="?";
        url+=encodeURIComponent(k)+"="+encodeURIComponent(v);
    }
    return url;
};
const handleAndroidPost=(url,body)=>{
    return new Promise((resolve,reject)=> {
        let res=JSON.parse(avnav.android.handleUpload(url, body));
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
let RequestHandler={
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
    getJson:(url,options,opt_parameter)=>{
        let [rurl,requestOptions]=prepare(url,options);
        return handleJson(addParameters(rurl,opt_parameter),requestOptions,options);
    },
    postJson:(url,body,options,opt_parameters)=>{
        let [rurl,requestOptions]=prepare(url,options);
        requestOptions.method='POST';
        rurl=addParameters(rurl,opt_parameters);
        if (!requestOptions.headers) requestOptions.headers={};
        requestOptions.headers['content-type']='application/json';
        let encodedBody=JSON.stringify(body);
        if (avnav.android){
            return handleAndroidPost(rurl,encodedBody)
        }
        requestOptions.body=encodedBody;
        return handleJson(rurl,requestOptions,options);
    },

    postPlain:(url,body,options,opt_parameters)=>{
        let [rurl,requestOptions]=prepare(url,options);
        rurl=addParameters(rurl,opt_parameters);
        requestOptions.method='POST';
        if (!requestOptions.headers) requestOptions.headers={};
        requestOptions.headers['content-type']='application/octet-string';
        if (avnav.android){
            return handleAndroidPost(rurl,body);
        }
        requestOptions.body=body;
        return handleJson(rurl,requestOptions,options);
    },
    /**
     * do a json get request
     * @param url either string or object with request parameters
     * @param options:
     *        useNavUrl - (default: false) - prepend the navUrl to the provided url
     *        noCache   - (default: false) - prevent caching
     * @param opt_parameter request parameters
     */
    getHtmlOrText:(url,options,opt_parameter)=>{
        let [rurl,requestOptions]=prepare(url,options,{useNavUrl:false,noCache:false});
        return new Promise((resolve,reject)=>{
          rurl=addParameters(rurl,opt_parameter)
          if (!rurl) {
            reject("missing url");
            return;
          }
          let sequence=undefined;
          if (options && options.sequenceFunction) sequence=options.sequenceFunction();
          let finalResponse;
          fetch(rurl,requestOptions).then(
              (response)=>{
                  if (response.status < 200 || response.status >= 300){
                      reject(response.statusText);
                  }
                  if (response.ok){
                      finalResponse=response;
                      return response.text();
                  }
                  else{
                      reject(response.statusText);
                  }
              },
              (error)=>{
                  reject(error.message);
              }).then((text)=>{
                  if (sequence !== undefined){
                      if (sequence != options.sequenceFunction()) {
                          reject("sequence changed");
                          return;
                      }
                  }
                 resolve(text,finalResponse);
              },(error)=>{
                  reject(error);
              });
        });
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
    uploadFile: (url, file, param)=> {
        let type = "application/octet-stream";
        try {
            let xhr=new XMLHttpRequest();
            xhr.open('POST',url,true);
            xhr.setRequestHeader('Content-Type', type);
            xhr.addEventListener('load',(event)=>{
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
            xhr.addEventListener('error',(event)=>{
               if (param.errorhandler) param.errorhandler(param,"upload error");
            });
            if (param.starthandler) param.starthandler(param,xhr);
            xhr.send(file);
        } catch (e) {
            if (param.errorhandler) param.errorhandler(param,e);
        }
    },
    getLastModified:(url)=>{
        if (! globalstore.getData(keys.gui.capabilities.fetchHead,false)){
            return Promise.resolve(0);
        }
        const options={
            timeout: parseInt(globalStore.getData(keys.properties.networkTimeout)),
            method:'HEAD'
        }
        return fetch(url,options)
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