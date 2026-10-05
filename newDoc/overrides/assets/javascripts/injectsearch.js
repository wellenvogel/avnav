(function (){
const src=new URL(document.currentScript.src,window.location.href)
const query=src.searchParams;
const configElement=document.getElementById('__config');
if (!configElement) {
    console.error("injectsearch: no config found");
    return;
}
const jconfig=JSON.parse(configElement.textContent);
const worker='workers/searchframe.js';
const origWorker=jconfig.search.replace(/.*\//,'');
const workerUrl=(new URL(worker,src.href).toString())+'?lang='+query.get('lang')+
    '&worker='+encodeURIComponent(origWorker);
jconfig.search=workerUrl;
configElement.textContent=JSON.stringify(jconfig);
//console.log("injectsearch",configElement?.textContent,workerUrl);
console.log("injectsearch: search worker replaced with",workerUrl);
})()