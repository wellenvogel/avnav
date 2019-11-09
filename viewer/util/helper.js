/**
 * Created by andreas on 04.05.14.

 */

let compare=require('./shallowcompare');
/**
 *
 * @constructor
 */
var Helper=function(){};

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
Helper.uploadFile=function(url,file,param){
    var type=file.type;
    if (! type || type == "") type="application/octet-stream";
    try {
        $.ajax({
            url: url,
            type: "POST",
            data: file,
            dataType: "json",
            processData: false, //Work around #1
            contentType: type, //Work around #2
            beforeSend: function(xhdr,settings){
                settings.data=file; //workaround for safari - see http://www.redmine.org/issues/13932
                if (param.starthandler){
                    param.starthandler(param,xhdr);
                }
            },
            success: function (data) {
                if (data.status && data.status != "OK"){
                    if (param.errorhandler){
                        param.errorhandler(param,data.status);
                    }
                    return;
                }
                if (param.okhandler) {
                    param.okhandler(param, data);
                }
            },
            error: function (err) {
                if (param.errorhandler) {
                    param.errorhandler(param, err);
                }
            },
            //Work around #3
            xhr: function () {
                var myXhr = $.ajaxSettings.xhr();
                if (myXhr.upload && param.progresshandler) {
                    myXhr.upload.addEventListener('progress', function (ev) {
                        param.progresshandler(param, ev);
                    }, false);
                }
                return myXhr;
            }
        });
    }catch (e){
        avnav.util.overlay.Toast("upload error: "+e);
    }
};

Helper.endsWith=function(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
};

Helper.startsWith=function(str, prefix) {
    return (str.indexOf(prefix, 0) == 0);
};

Helper.addEntryToListItem=function(list,keyname,keyvalue,key,value){
  list.forEach(function(item){
      if(item[keyname] === keyvalue){
          item[key]=value;
      }
  })  
};

/**
 * helper for shouldComponentUpdate
 * @param oldVals
 * @param newVals
 * @param keyObject
 * @returns {boolean} true if properties differ
 */

Helper.compareProperties=function(oldVals,newVals,keyObject){
    if (! oldVals !== ! newVals) return true;
    for (let k in keyObject){
        if ( ! compare(oldVals[k],newVals[k])) return true;
    }
    return false;
};

Helper.entityMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': '&quot;',
    "'": '&#39;',
    "/": '&#x2F;'
};

Helper.escapeHtml=function(string) {
    return String(string).replace(/[&<>"'\/]/g, function (s) {
        return Helper.entityMap[s];
    });
};


Helper.scrollItemIntoView=function(itemSelector,parent){
  $(parent).find(itemSelector).each(function(i,el){
      el.scrollIntoView();
  });
};

module.exports=Helper;



