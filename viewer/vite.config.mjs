import path from "node:path";
import {fileURLToPath} from "node:url";
import {defineConfig, loadEnv, transformWithEsbuild,normalizePath} from "vite";
import react from "@vitejs/plugin-react";
import {resolve} from "path";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const formatDate = (date) => {
    const yyyy = date.getFullYear();
    const mm = date.getMonth() < 9 ? `0${date.getMonth() + 1}` : `${date.getMonth() + 1}`;
    const dd = date.getDate() < 10 ? `0${date.getDate()}` : `${date.getDate()}`;
    const hh = date.getHours() < 10 ? `0${date.getHours()}` : `${date.getHours()}`;
    const min = date.getMinutes() < 10 ? `0${date.getMinutes()}` : `${date.getMinutes()}`;
    return `${yyyy}${mm}${dd}-${hh}${min}`;
};

const createVersion = (mode) => {
    if (process.env.AVNAV_VERSION) return process.env.AVNAV_VERSION;
    return (mode === "production" ? "" : "dev-") + formatDate(new Date());
};

const userEntryPoints = {
    'avnavui': resolve(__dirname, 'exportmodules/avnavui-direct.js'),
    'ol': resolve(__dirname, 'exportmodules/ol.js'),
    'htm': resolve(__dirname, 'exportmodules/htm.js'),
    'lat-lon': resolve(__dirname, 'exportmodules/lat-lon.js'),
    'react': resolve(__dirname, 'exportmodules/react.js'),
    'react-dom': resolve(__dirname, 'exportmodules/react-dom.js'),
};
const userEntryPaths = new Set(Object.values(userEntryPoints));


const jsxInJsPlugin = {
    name: "jsx-in-js",
    enforce: "pre",
    async transform(code, id) {
        if (!id.endsWith(".js")) return null;
        if (id.includes("/node_modules/")) return null;
        return transformWithEsbuild(code, id, {
            loader: "jsx",
            jsx: "automatic"
        });
    }
};
let normalizedBase;
const preserveUserEntries={
    name: 'preserve-user-entries-only',
    enforce: 'post',
    // Capture Vite's resolved config so `base` works whether set to '/', '/my-app/', or './'
    configResolved(config) {
        // Normalize relative base ('./' or '') to '/' for dev server URL matching
        const resolvedBase =
            config.base === './' || config.base === '' ? '/' : config.base;

        // Ensure trailing slash (e.g., '/my-app/')
        normalizedBase = resolvedBase.endsWith('/')
            ? resolvedBase
            : `${resolvedBase}/`;
    },
    // 1. DEV SERVER: Rewrite `/api/<name>.js` -> `/@fs/<absolute-path>`
    configureServer(server) {
        server.middlewares.use((req, res, next) => {
            if (!req.url) return next();

            // Strip query params (e.g., ?t=12345 from HMR) before matching
            const [pathname, query] = req.url.split('?');
            const match = pathname.match(/^\/modules\/([^/]+)\.[jt]s$/);
            if (match && match[1] in userEntryPoints) {
                const targetPath = normalizePath(userEntryPoints[match[1]]);
                console.log("devserver",pathname, match,targetPath);
                // Rewrite to Vite's /@fs/ prefix so Vite transforms and serves the source file directly
                req.url = `${normalizedBase}/@fs/${targetPath}${query ? `?${query}` : ''}`;
            }

            next();
        });
    },
    // Run during build to prevent tree-shaking only on userEntryPoints
    transform(code, id) {
        if (userEntryPaths.has(id)) {
            return {
                code,
                moduleSideEffects: 'no-treeshake',
            };
        }
    },
    // Ensure Rollup emits all exports for these specific modules
    moduleParsed(moduleInfo) {
        if (userEntryPaths.has(moduleInfo.id)) {
            moduleInfo.moduleSideEffects = 'no-treeshake';
        }
    },
    // Also disable tree-shaking for modules directly re-exported via `export *`
    async resolveId(source, importer, options) {
        if (importer && userEntryPaths.has(normalizePath(importer))) {
            const resolved = await this.resolve(source, importer, {
                ...options,
                skipSelf: true,
            });
            if (resolved && !resolved.external) {
                return {
                    ...resolved,
                    moduleSideEffects: 'no-treeshake',
                };
            }
        }
        return null;
    },
}
export default defineConfig(({command, mode}) => {
    const env = loadEnv(mode, process.cwd(), "");
    const avnavVersion = createVersion(mode);
    const outDir = mode === "production" ? "build/release-vite" : "build/debug-vite";
    const devRoot = "/viewer/";
    const devApiTarget = env.VITE_API_TARGET || "http://localhost:8080";
    const devHost = env.VITE_DEV_HOST || "0.0.0.0";
    const devPort = Number.parseInt(env.VITE_DEV_PORT || "5173", 10);


    // Vite only enables CSS modules for .module.less; keep the shared source
    // filenames and let LESS track the imported files for hot updates.
    const styleModules = new Map(
        ["icons", "button_text"].map(name => [
            path.resolve(__dirname, "style", `${name}.less`),
            path.resolve(__dirname, "style", `${name}.module.less`)
        ])
    );
    const styleModuleSources = new Map([...styleModules].map(([source, module]) => [module, source]));
    const styleModulesPlugin = {
        name: "avnav-style-modules",
        enforce: "pre",
        resolveId(source, importer) {
            if (!importer || !source.startsWith(".")) return null;
            return styleModules.get(path.resolve(path.dirname(importer), source)) || null;
        },
        load(id) {
            const source = styleModuleSources.get(id);
            if (!source) return null;
            return `@import "./${path.basename(source)}";`;
        }
    };

    return {
        base: command === "serve" ? devRoot : "./",
        plugins: [
            preserveUserEntries,
            styleModulesPlugin,
            jsxInJsPlugin,
            react({
            include: /\.(js|jsx|ts|tsx)$/
        })],
        publicDir: "static",
        define: {
            __AVNAV_VERSION__: JSON.stringify(avnavVersion)
        },
        resolve: {
            alias: [
                {find: "React", replacement: "react"},
                {find: /^(?:\.\.\/|\.\/)?version(?:\.js)?$/, replacement: path.resolve(__dirname, "version.vite.js")}
            ]
        },
        css: {
            modules: {
                generateScopedName: "[local]"
            },
            preprocessorOptions: {
                less: {
                    javascriptEnabled: true
                }
            }
        },
        optimizeDeps: {
            esbuildOptions: {
                loader: {
                    ".js": "jsx"
                }
            }
        },
        server: {
            host: devHost,
            port: Number.isNaN(devPort) ? 5173 : devPort,
            proxy: {
                "^/(?!viewer/|@vite/|@fs/|src/|node_modules/|__vite_ping).*": {
                    target: devApiTarget,
                    changeOrigin: true,
                    ws: true
                }
            }
        },
        build: {
            outDir,
            emptyOutDir: true,
            rollupOptions: {
                input: {
                    main: path.resolve(__dirname, "index-vite.html"),
                    ...userEntryPoints
                },
                preserveEntrySignatures: 'allow-extension',
                output: {
                    entryFileNames: (chunkInfo) => {
                        return chunkInfo.name in userEntryPoints
                            ? 'modules/[name].js'
                            : 'assets/[name]-[hash].js';
                    },
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash][extname]',
                },
            }
        }
    };
});

