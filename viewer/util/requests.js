import PropertyHandler from './propertyhandler.js';
import Promise from 'promise';
'use strict';
let RequestHandler={
    /**
     * do a json get request
     * @param url
     * @param options:
     *        useNavUrl - (default: true) - prepend the navUrl to the provided url
     *        checkOk   - (default: true) - check if the response has a status field and this is set to "OK"
     *        noCache   - (default: true) - prevent caching
     */
    getJson:(url,options)=>{
        return new Promise((resolve,reject)=>{
           if (!url) {
               reject("missing url");
               return;
           }
           if ( !(options && options.useNavUrl !== undefined && !options.useNavUrl)){
               url=PropertyHandler.getProperties().navUrl+url;
           }
           let headers=undefined;
           if ( !(options && options.noCache !== undefined && !options.noCache)){
               headers=new Headers();
               headers.append('pragma', 'no-cache');
               headers.append('cache-control', 'no-cache');
           }
           let requestOptions={};
           if (headers) requestOptions.headers=headers;
           fetch(url,requestOptions).then(
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
                       if (! json.status || json.status !== 'OK'){
                           reject("status: "+json.status);
                           return;
                       }
                   }
                   resolve(json);
               },(jsonError)=>{
                   reject(jsonError);
               });
        });
    }
};
Object.freeze(RequestHandler);

module.exports=RequestHandler;