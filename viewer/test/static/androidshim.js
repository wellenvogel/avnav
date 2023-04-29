console.log("android shim loaded");


(function(){
    function getRoute(name) {
        name=name.replace(/\.gpx$/,"");
        if (name === 'error') return;
        return `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
    <gpx version="1.1" creator="avnav">
    <rte>
    <name>${name}</name>
    <rtept lat="54.4075366667" lon="11.0655483333">
    <name>WP 1</name></rtept>
    <rtept lat="54.4266616667" lon="11.0576733333">
    <name>WP 2xxx</name></rtept>
    <rtept lat="54.43068" lon="11.0561816667">
    <name>WP 3</name></rtept></rte></gpx>`;
    }
    var androidEvents={
        JS_RELOAD:"reloadData",
        JS_BACK:"backPressed",
        JS_PROPERTY_CHANGE:"propertyChange",
        JS_UPLOAD_AVAILABLE:"uploadAvailable",
        JS_FILE_COPY_READY:"fileCopyReady",
        JS_FILE_COPY_PERCENT:"fileCopyPercent", //id will be percent
        JS_FILE_COPY_DONE:"fileCopyDone"
    }
    function log(){
        var i;
        var txt="("+arguments[0]+"):";
        for (i=1;i<arguments.length;i++){
            txt+=" "+arguments[i];
        }
        console.log("##ANDROIDSHIM: "+txt);
    }
    function event(key,id){
        window.avnav.android.receiveEvent(key , id);
    }
    var openTransfers={};
    window.avnavAndroid = {
        downloadFile: function (name, type, url) {
            log("downloadFile",name,type,url)
            return false;
        },
        handleUpload: function (url, data) {
            log("handleUpload",url,data)
            return { status:"not implemented"};
        },
        requestFile: function (type, id, readFile) {
            var pf=function(){
                var name=prompt("enter android upload filename","dummy");
                if (name){
                    openTransfers[id]={name:name,size:0,type:type,readFile:readFile};
                    if (readFile){
                        if (type === 'route') {
                            openTransfers[id].data = getRoute(name);
                        }
                        event(androidEvents.JS_UPLOAD_AVAILABLE,id);
                    }
                    else {
                        event(androidEvents.JS_FILE_COPY_READY, id);
                    }
                }
            }
            log("requestFile",type,id,"readFile="+readFile)
            window.setTimeout(pf,1);
            log("requestFile","done");
            return true
        },
        getFileName: function(id){
            log("getFileName",id)
            var entry=openTransfers[id];
            if (entry){
                log("getFileName","found",entry.name)
                return entry.name;
            }
            return null;
        },
        getFileData: function(id){
            log("getFileData",id)
            var entry=openTransfers[id];
            if (entry){
                log("getFileData","found",entry.name)
                return entry.data;
            }
            return null;
        },
        copyFile: function(id,name){
            log("copyFile",id,name);
            var entry=openTransfers[id];
            if (entry) {
                log("copyFile", "found", entry.name, entry.size)
                entry.size = 100;
                let transfer = 10;
                let iv = window.setInterval(function () {
                        if (transfer >= entry.size) {
                            window.clearInterval(iv);
                            event(androidEvents.JS_FILE_COPY_DONE,entry.name.match(/error/)?1:0);
                        }
                        event(androidEvents.JS_FILE_COPY_PERCENT, transfer * 100 / entry.size);
                        transfer += 10;
                    }
                    , 1000);
                entry.iv=iv;
                return true;
            }
            return false;
        },
        getFileSize:function(id){
            log("getFileSize",id);
            var entry=openTransfers[id];
            if (entry){
                log("getFileSize","found",entry.size)
                return entry.size;
            }
            return -1;
        },
        interruptCopy: function(id){
            log("interruptCopy",id);
            if (openTransfers[id]){
                log("interruptCopy","open transfer found, deleting");
                window.clearInterval(openTransfers[id].iv);
                delete openTransfers[id];
            }
            return false;
        },
        setLeg: function(legData){
            log("setLeg",legData);
            return null;
        },
        unsetLeg: function(){
            log("unsetLeg");
            return null;
        },
        goBack: function(){
            log("goBack");
            return null;
        },
        acceptEvent: function(key,num){
            log("accepEvent",key,num);
        },
        showSettings: function(){
            log("showSettings");
        },
        applicationStarted: function(){
            log("applicationStarted");
        },
        externalLink: function(url){
            log("externalLink",url);
        },
        getVersion: function(){
            log("getVersion");
            return "AndroidShim";
        },
        dimScreen:function(percent){
            log("dimScreen",percent);
            return true;
        },
        dialogClosed:function(){
            log("dialogClosed");
        },
        channelOpen:function(url){
            let rt=(new Date()).getTime();
            log("channelOpen "+url+" -> "+rt);
            return rt;
        },
        channelClose:function(id){
            log("channelClose "+id);
        },
        sendChannelMessage:function(id,msg){
            log("sendRemoteMessage: "+id+" "+msg);
        },
        readChannelMessage:function(id){
            log("readChannelMessage: "+id);
            return "hello";
        },
        isChannelOpen:function(id){
            log("isChannelOpen: "+id);
            return true;
        }



    };
})();
