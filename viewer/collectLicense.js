/**
 * Created by andreas on 28.02.17.
 */
var nlf = require('nlf');

nlf.find({depth:0}, function (err, data) {
    // do something with the response object.
    console.log('<div class="licenseList">');
    data.forEach(function(el){
        if (el.name == "avnav-viewer") return;
        var repo=el.repository.replace(/ssh:\/\/git@github.com/,'https://github.com/');
        console.log(`<div class="elEntry"><span class="elName">${el.name}</span>
        <span class="elVersion">${el.version}</span>
        <a class="elRepo" href="${repo}">${repo}</a>
        <span class="elLicense">${el.licenseSources.package.summary()}</span>
        </div>`);
    });
    console.log('</div>');
});
