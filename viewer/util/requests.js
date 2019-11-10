import PropertyHandler from './propertyhandler.js';
import Promise from 'promise';
import assign from 'object-assign';
'use strict';

const prepare=(url,options,defaults)=>{
    if (!url) {
        return [undefined,undefined];
    }
    let ioptions=assign({},defaults,options);
    if ( !(ioptions && ioptions.useNavUrl !== undefined && !ioptions.useNavUrl)){
        url=PropertyHandler.getProperties().navUrl+url;
    }
    if (ioptions.timeout === undefined) ioptions.timeout=PropertyHandler.getProperties().statusQueryTimeout;
    let headers=undefined;
    if ( !(ioptions && ioptions.noCache !== undefined && !ioptions.noCache)){
        headers=new Headers();
        headers.append('pragma', 'no-cache');
        headers.append('cache-control', 'no-cache');
    }
    let requestOptions={};
    if (headers) requestOptions.headers=headers;
    requestOptions.timeout=ioptions.timeout;
    return [url,requestOptions];
};
let RequestHandler={
    /**
     * do a json get request
     * @param url
     * @param options:
     *        useNavUrl - (default: true) - prepend the navUrl to the provided url
     *        checkOk   - (default: true) - check if the response has a status field and this is set to "OK"
     *        noCache   - (default: true) - prevent caching
     *        timeout   - (default: statusQueryTimeout) - timeout
     */
    getJson:(url,options)=>{
        let [rurl,requestOptions]=prepare(url,options);
        return new Promise((resolve,reject)=>{
            if (!rurl) {
                reject("missing url");
                return;
            }
           fetch(rurl,requestOptions).then(
                (response)=>{
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
    },
    /**
     * do a json get request
     * @param url
     * @param options:
     *        useNavUrl - (default: true) - prepend the navUrl to the provided url
     *        checkOk   - (default: true) - check if the response has a status field and this is set to "OK"
     *        noCache   - (default: true) - prevent caching
     */
    getHtmlOrText:(url,options)=>{
        let [rurl,requestOptions]=prepare(url,options,{useNavUrl:false,noCache:false});
        return new Promise((resolve,reject)=>{
          if (!rurl) {
              reject("missing url");
              return;
          }
          fetch(rurl,requestOptions).then(
              (response)=>{
                  if (response.ok){
                      return response.text();
                  }
                  else{
                      reject(response.statusText);
                  }
              },
              (error)=>{
                  reject(error.message);
              }).then((text)=>{
                 resolve(text);
              },(error)=>{
                  reject(error);
              });
      });
    }
};
Object.freeze(RequestHandler);

module.exports=RequestHandler;