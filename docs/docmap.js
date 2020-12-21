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

function nameFromPage(pageName){
   return pageName.replace(/[/.]/g,'_');  
}
function headingTextToAnchor(tag,txt){
    if (! txt) return;
    return tag+":"+txt.replaceAll(/[^a-zA-Z0-9_-]/g,'');
}

function buildOnePage(lang,container){
    let name=lang+'_docmapdata.json'
    fetch(name)
    .then(function(response){
        if (response.status < 200 || response.status >= 300){
            throw Error(name+":"+response.statusText);
            return;
        }
        return response.json();
    }).then(function(json){
        let parent=$(container);
        let pages={}
        json.forEach(function(item){
            var page=item.href.replace(/[?#].*/,'');
            pages[page]=1;
        });
        let base=window.location.href.replace(/[#?].*/,'');
        let toc=$('<div class="onePageToc"/>');
        $(container).append(toc);
        for (let pageName in pages){
            let name=nameFromPage(pageName);
            let el=$('<div class="printPage"/>').attr('id',name)
            let anchor=$('<a>').attr('name',name);
            $(parent).append(anchor);
            $(parent).append(el);
            let pageBase=pageName.replace(/[^/]*$/,'');
            let replacements=[];
            if (pageBase != '') {
                let baseParts=pageBase.split(/[/]+/);
                for (let i=baseParts.length-1;i--;i>=0){
                    replacements.push(new RegExp(baseParts[i]+"\\/\\.\\."))
                }
                pageBase+="/";
            }
            
            fetch(pageName+"?lang="+lang)
                .then(function(response){return response.text()})
                .then(function(pageData){
                    let tocInserted=false;
                    let page=$('<div/>',{html:pageData});
                    //insert first h1 of page as TOC
                    $(page).find('h1').each(function(idx,hdl){
                        if (tocInserted) return true;
                        let tocEntry=$('<div class="tocEntry tocLevel0"/>');
                        tocEntry.append($('<a/>').attr('href','#'+name).text($(hdl).text()));
                        toc.append(tocEntry);
                        tocInserted=true;
                    });
                    $(page).find('a').each(function(idx,link){
                        let href=$(link).attr('href');
                        if (! href) {
                            let anchor=$(link).attr('name');
                            if (! anchor) return;
                            anchor=name+":"+anchor;
                            $(link).attr('name',anchor);
                            return;
                        };
                        if (href.match(/^http/)) return;
                        if (href.match(/^mailto:/)) return;
                        if (href.match(/.*software\/avnav\/docs[/]*/)){
                            href=href.replace(/.*software\/avnav\/docs[/]*/,'');
                        }
                        else{
                            href=(pageBase+href).replace(/[/]+/,'/');
                        }
                        replacements.forEach(function(repl){
                            href=href.replace(repl,"");
                        });
                        //check if we are still outside
                        if (href.match(/^\.\./)) return;
                        href=href.replace(/^\/*/,'').replace(/[?].*/,'');
                        let parts=href.split("#");
                        let newTarget="#"+nameFromPage(parts[0]);
                        if (parts.length > 1 && parts[1]){
                            newTarget+=":"+parts[1];
                        }
                        $(link).attr('href',newTarget);
                    })
                    $(page).find('img').each(function(idx,link){
                        let href=$(link).attr('src');
                        if (! href) return;
                        if (href.match(/^http/)) return;
                        if (href.match(/.*software\/avnav\/docs[/]*/)){
                            href=href.replace(/.*software\/avnav\/docs[/]*/,'');
                        }
                        else{
                            href=(pageBase+href).replace(/[/]+/,'/');
                            replacements.forEach(function(repl){
                                href=href.replace(repl,"");
                            });
                            href=href.replace(/^\/*/,'');
                        }
                    
                        $(link).attr('src',href);
                    })
                    $('#'+name).html(page);
                    generateToc($('#'+name),name+":");
                })
                .catch(function(error){});
            continue;    
        };
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
