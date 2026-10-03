console.log("searchtest loaded")
async function handler(message) {
    console.log({ message })
}

let oworker=new Worker("search.2c215733.min.js");
oworker.onmessage=async (msg) => {
    console.log("oworker onmessage", msg)
    postMessage(msg.data);
}
self.onmessage=async (msg) => {
        console.log("searchtest onmessage", msg)
        oworker.postMessage(msg.data);
    }
