import "./util/maplibreWorker";
import "./style/avnav_viewer_new.less";
import main from "./avnav_viewer.js";

const needLegacyPolyfills = () =>
    typeof globalThis === "undefined" ||
    typeof Promise.allSettled !== "function" ||
    typeof Object.fromEntries !== "function";

const bootstrap = async () => {
    if (needLegacyPolyfills()) {
        await import("./util/legacy-polyfills.js");
    }
    main();
};

bootstrap();
