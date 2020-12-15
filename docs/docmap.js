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
