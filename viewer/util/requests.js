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
let RequestHandler={
    /**
     * do a json get request
     * @param url
     * @param options:
     *        useNavUrl - (default: true) - prepend the navUrl to the provided url
     *        checkOk   - (default: true) - check if the response has a status field and this is set to "OK"
     *        noCache   - (default: true) - prevent caching
     *        timeout   - (default: statusQueryTimeout) - timeout
     *        sequenceFunction - if set: a function to return a sequence - if the one returned from start
     *                           does not match the on at the result we reject
     */
    getJson:(url,options)=>{
        let [rurl,requestOptions]=prepare(url,options);
        return handleJson(rurl,requestOptions,options);
    },

    postJson:(url,body,options)=>{
        let [rurl,requestOptions]=prepare(url,options);
        requestOptions.method='POST';
        if (!requestOptions.headers) requestOptions.headers=new Headers();
        requestOptions.headers.append('content-type','application/json');
        let encodedBody=JSON.stringify(body);
        requestOptions.body=encodedBody;
        return handleJson(rurl,requestOptions,options);
    },
    postJsonForm:(url,formData,options)=>{
        let [rurl,requestOptions]=prepare(url,options);
        requestOptions.method='POST';
        if (formData instanceof FormData) {
            requestOptions.body = formData;
        }
        else{
            let requestData=new FormData();
            for (let k in formData){
                requestData.append(k,formData[k]);
            }
            requestOptions.body=requestData;
        }
        return handleJson(rurl,requestOptions,options);
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
          let sequence=undefined;
          if (options && options.sequenceFunction) sequence=options.sequenceFunction();
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
                  if (sequence !== undefined){
                      if (sequence != options.sequenceFunction()) {
                          reject("sequence changed");
                          return;
                      }
                  }
                 resolve(text);
              },(error)=>{
                  reject(error);
              });
      });
    }
};
Object.freeze(RequestHandler);

module.exports=RequestHandler;