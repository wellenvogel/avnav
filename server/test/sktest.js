var http = require("http"),
    url = require("url"),
    path = require("path"),
    fs = require("fs"),
    port = process.argv[2] || 3000;

const BASE="/signalk"    
const API="/v1/api/"
const VESSELS='vessels'
const ALLDATA='api.json'
http.createServer(function(request, response) {

  var uri = url.parse(request.url).pathname;
  console.log("uri:",uri);
  if (uri.startsWith(BASE)){
    uri=uri.substring(BASE.length);
    var data;
    var laddr=request.socket.localAddress;
    var lport=request.socket.localPort;
    if (uri === ""){
      data={endpoints:{
        'http':{
          'signalk-http':`http://${laddr}:${lport}${BASE}${API}`
        }
      }};
    }
    else if (uri.startsWith(API)){
      uri=uri.substring(API.length)
      if (uri.startsWith(VESSELS)){
        uri=uri.substring(VESSELS.length);
        console.log("vessels",uri);
        uri=uri.replace(/^\//,'');
        var fn=path.join(process.cwd(),uri+".json")
        if (fs.existsSync(fn)){
          data=fs.readFileSync(fn)
          response.writeHead(200);
          response.write(data,"binary");
          response.end();
          return;
        }
        var fn=path.join(process.cwd(),ALLDATA);
        if (fs.existsSync(fn)){
          var fdata=fs.readFileSync(fn);
          var jdata=JSON.parse(fdata);
          if (uri == 'self'){
            uri=jdata.self;
            if (uri) uri=uri.replace(/^vessels\./,'');
            console.log("self from ",ALLDATA,uri);
          }
          var vessels=jdata.vessels;
          if (uri == ""){
            data=vessels;
          }
          else if (uri){
            if (vessels){
              data=vessels[uri];
            }
          }
        }
      }
    }
    if (data){
      response.writeHead(200);
      var txt=JSON.stringify(data);
      response.write(txt, "binary");
      response.end();
      return;
    }
  }

  response.writeHead(404, {"Content-Type": "text/plain"});
  response.write("404 Not Found\n");
  response.end();
}).listen(parseInt(port, 10),'127.0.0.1');

console.log("Static file server running at\n  => http://127.0.0.1:" + port + "/\nCTRL + C to shutdown");
