function buildDocMap(lang,container){
    var name=lang+'_docmapdata.json'
    fetch(name)
    .then(function(response){
        if (response.status < 200 || response.status >= 300){
            throw Error(name+":"+response.statusText);
            return;
        }
        return response.json();
    }).then(function(json){
        var parent=$(container);
        json.forEach(function(item){
            var el=$('<div class="docMapItem docMapLevel'+item.tag+'"/>');
            var link=$('<a/>').appendTo($(el)).attr('href',item.href).text(item.text);
            $(parent).append(el);
        });
        updateLanguage();
    })
    .catch(function(error){
        $('<p class="error"/>')
        .text('Unable to load docmap: '+error)
        .appendTo($(container));
    });
}

function buildOnePage(lang,container){
    var name=lang+'_docmapdata.json'
    fetch(name)
    .then(function(response){
        if (response.status < 200 || response.status >= 300){
            throw Error(name+":"+response.statusText);
            return;
        }
        return response.json();
    }).then(function(json){
        var parent=$(container);
        var pages={}
        json.forEach(function(item){
            var page=item.href.replace(/[?#].*/,'');
            pages[page]=1;
        });
        let base=window.location.href.replace(/[#?].*/,'');
        for (var pageName in pages){
            var el=$('<iframe class="printPage"/>').attr('src',pageName).attr('frameborder',0).attr('scrolling','no');
            $(el).on('load',function(ev) {
                var obj=ev.target;
                var body=obj.contentWindow.document.body;
                obj.style.height = body.scrollHeight + 'px';
                $(obj.contentWindow.document.body).addClass('printBody');
                $(body).find('a').each(function(idx,link){
                    var href=$(link).attr('href');
                    if (! href) return;
                    if (href.match(/^http/)) return;
                    href=href.replace(/.*software\/avnav\/docs[/]*/,'');
                    $(link).attr('href',base+'#'+href.replace(/[#?].*/,'')); //no idea how to link into the iframe...
                })
            })
            var anchor=$('<a/>').attr('name',pageName);
            $(parent).append(anchor);
            $(parent).append(el);
        };
        updateLanguage();
    })
    .catch(function(error){
        $('<p class="error"/>')
        .text('Unable to load docmap: '+error)
        .appendTo($(container));
    });
}

function enqBuildDocMap(lang,container){
    var hasBuild=false;
    var maxTry=100;
    var tryBuild=function(){
        if (hasBuild) return;
        var celem=$(container);
        if (celem && celem.length){
            hasBuild=true;
            buildDocMap(lang,container);
        }
        else{
            maxTry--;
            if (maxTry >= 0){
                window.setTimeout(tryBuild,50);
            }
        } 
    }
    window.setTimeout(tryBuild,50);
}

function enqBuildOnePage(lang,container){
    var hasBuild=false;
    var maxTry=100;
    var tryBuild=function(){
        if (hasBuild) return;
        var celem=$(container);
        if (celem && celem.length){
            hasBuild=true;
            buildOnePage(lang,container);
        }
        else{
            maxTry--;
            if (maxTry >= 0){
                window.setTimeout(tryBuild,50);
            }
        } 
    }
    window.setTimeout(tryBuild,50);
}
