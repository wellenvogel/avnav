import {setWorkerUrl} from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

const devWorkerUrl = new URL("./maplibreWorkerDev.cjs", import.meta.url).href;
const supportsModuleWorkers = () => {
    try {
        const blob = new Blob([""], {type: "text/javascript"});
        const url = URL.createObjectURL(blob);
        const worker = new Worker(url, {type: "module"});
        worker.terminate();
        URL.revokeObjectURL(url);
        return true;
    } catch {
        return false;
    }
};

setWorkerUrl(import.meta.env.DEV && !supportsModuleWorkers() ? devWorkerUrl : workerUrl);
