import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import assign from 'object-assign';
import 'whatwg-fetch-timeout';


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
let RequestHandler={
    /**
     * do a json get request
     * @param url - either string or object with request parameters
     * @param options:
     *        useNavUrl - (default: true) - prepend the navUrl to the provided url
     *        checkOk   - (default: true) - check if the response has a status field and this is set to "OK"
     *        noCache   - (default: true) - prevent caching
     *        timeout   - (default: statusQueryTimeout) - timeout
     *        sequenceFunction - if set: a function to return a sequence - if the one returned from start
     *                           does not match the on at the result we reject
     *        opt_parameter - object with request parameters
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
            return new Promise((resolve,reject)=> {
                let status=avnav.android.handleUpload(rurl, encodedBody);
                if (status == 'OK'){
                    resolve({status:status});
                    return;
                }
                else{
                    reject(status);
                    return;
                }
            });
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
            return new Promise((resolve,reject)=> {
                let status=avnav.android.handleUpload(rurl, body);
                if (status == 'OK'){
                    resolve({status:status});
                    return;
                }
                else{
                    reject(status);
                    return;
                }
            });
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
    }
};
Object.freeze(RequestHandler);

export default RequestHandler;