(function (){const src=new URL(document.currentScript.src,window.location.href)
const query=src.searchParams;
const configElement=document.getElementById('__config');
console.log("injectsearch",configElement?.textContent,query.get('lang'),query.get('worker'));
})()