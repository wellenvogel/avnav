/**
 * Created by andreas on 28.02.17.
 */
var nlf = require('nlf');

var generateLicenseFile=function(cb){
    var rt="";
    nlf.find({depth:0}, function (err, data) {
        // do something with the response object.
        rt+='<div class="licenseList">';
        data.forEach(function(el){
            if (el.name == "avnav-viewer") return;
            var repo=el.repository.replace(/ssh:\/\/git@github.com/,'https://github.com/');
            rt+=(`<div class="elEntry"><span class="elName">${el.name}</span>
        <span class="elVersion">${el.version}</span>
        <a class="elRepo" href="${repo}">${repo}</a>
        <span class="elLicense">${el.licenseSources.package.summary()}</span>
        </div>`);
        });
        rt+=('</div>');
        cb(rt);
    });
};

//generateLicenseFile(console.log);

module.exports=generateLicenseFile;
