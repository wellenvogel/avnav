/**
 * Created by andreas on 28.02.17.
 */
var nlf = require('nlf');

var generateLicenseFile=function(){
    return new Promise(function(resolve,reject) {
        var rt = "";
        nlf.find({depth: 1}, function (err, data) {
            // do something with the response object.
            rt += '<div class="licenseList">';
            data.forEach(function (el) {
                if (el.name == "avnav-viewer") return;
                var repo = el.repository.replace(/ssh:\/\/git@github.com/, 'https://github.com/');
                rt += (`<div class="elEntry"><h3 class="elName">${el.name} ${el.version}</h3>
            <p><a class="elRepo" href="${repo}">${repo}</a></p>
            <p class="elLicense">${el.licenseSources.package.summary()}</p>
            </div>`);
            });
            rt += ('</div>');
            resolve(rt);
        });
    });
};

//generateLicenseFile(console.log);

module.exports=generateLicenseFile;
