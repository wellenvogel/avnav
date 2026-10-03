console.log("searchtest loaded")
async function handler(message) {
    console.log({ message })
}

const filterByLanguage=(docs)=>{
    let lan=new URLSearchParams(location.search).get("lang");
    if (!lan) return docs;
    //for now only de/en
    return docs.filter((doc)=>{
        if (!doc.location) return true;
        if (doc.location.startsWith(lan+"/")) return true;
        if (lan == "de" && ! doc.location.startsWith("en/"))return true;
        return false;
    })
}

let oworker=new Worker("search.2c215733.min.js");
oworker.onmessage=async (msg) => {
    console.log("oworker onmessage", msg);
    postMessage(msg.data);
}
self.onmessage=async (msg) => {
        console.log("searchtest onmessage", msg)
        if (msg.data && msg.data.type == 0) {
            //filter docs by language
            let fdocs=filterByLanguage(msg.data.data.docs);
            msg.data.data.docs=fdocs;
        }
        oworker.postMessage(msg.data);
    }
