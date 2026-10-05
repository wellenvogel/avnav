/**
 * injectsearch.js
 * injects a search worker into the config to allow filtering by language
 * it is loaded via a script tag in main.html and replaces the search worker with a custom one
 * that filters the docs by language before passing them to the original search worker
 * the original search worker is passed as a query parameter to the custom worker
 * the custom worker is located in assets/javascripts/workers/searchframe.js
 * the original search worker is located in assets/javascripts/workers/search.2c215733.min.js
 */

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