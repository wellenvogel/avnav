const path = require("node:path");
const {defineConfig, loadEnv, transformWithEsbuild} = require("vite");
const react = require("@vitejs/plugin-react");

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

module.exports = defineConfig(({command, mode}) => {
    const env = loadEnv(mode, process.cwd(), "");
    const avnavVersion = createVersion(mode);
    const outDir = mode === "production" ? "build/release-vite" : "build/debug-vite";
    const devRoot = "/viewer/";
    const devApiTarget = env.VITE_API_TARGET || "http://localhost:8080";
    const devHost = env.VITE_DEV_HOST || "0.0.0.0";
    const devPort = Number.parseInt(env.VITE_DEV_PORT || "5173", 10);

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
        plugins: [styleModulesPlugin, jsxInJsPlugin, react({
            include: /\.(js|jsx|ts|tsx)$/
        })],
        publicDir: "static",
        define: {
            __AVNAV_VERSION__: JSON.stringify(avnavVersion)
        },
        resolve: {
            alias: [
                {find: "React", replacement: "react"}
                ,{find: /^(?:\.\.\/|\.\/)?version(?:\.js)?$/, replacement: path.resolve(__dirname, "version.vite.js")}
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
                input: path.resolve(__dirname, "index-vite.html")
            }
        }
    };
});
