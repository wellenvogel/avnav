const findTagsByName = require("xml-utils/find-tags-by-name");
const getAttribute = require("xml-utils/get-attribute");
const findTagByName = require("xml-utils/find-tag-by-name");
const fs=require('fs');
const myArgs = process.argv.slice(2);


const fromXml=function(xml){
    let rt=[];
    let points=findTagsByName(xml,'rtept');
    points.forEach((point)=>{
        let obj={};
        obj.lon=getAttribute(point,'lon');
        obj.lat=getAttribute(point,'lat');
        obj.name=findTagByName(point.outer,'name').inner;
        rt.push(obj);
    });
    return rt;
};
fs.readFile(myArgs[0], 'utf8', (err, data) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(data);
    let points=fromXml(data);
    fs.writeFile(myArgs[1],
        JSON.stringify(points,undefined,3),
        ()=>console.log("written "+myArgs[1]));
});
