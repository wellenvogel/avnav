/**
 * Created by andreas on 28.02.17.
 */
import nlf from "nlf";

const generateLicenseFile = () => {
    return new Promise((resolve, reject) => {
        let rt = "";
        nlf.find({depth: 1}, (err, data) => {
            if (err) {
                reject(err);
                return;
            }
            rt += '<div class="licenseList">';
            data.forEach((el) => {
                if (el.name === "avnav-viewer") return;
                const repo = el.repository.replace(/ssh:\/\/git@github.com/, "https://github.com/");
                rt += (`<div class="elEntry"><h3 class="elName">${el.name} ${el.version}</h3>
            <p><a class="elRepo" href="${repo}">${repo}</a></p>
            <p class="elLicense">${el.licenseSources.package.summary()}</p>
            </div>`);
            });
            rt += ("</div>");
            resolve(rt);
        });
    });
};

export default generateLicenseFile;

