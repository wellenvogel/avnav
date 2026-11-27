import path from "node:path";
import {fileURLToPath} from "node:url";
import {defineConfig, loadEnv, normalizePath, transformWithOxc} from "vite";
import react from "@vitejs/plugin-react";
import generateLicense from "./collectLicense.mjs";
import {resolve,relative,parse} from "path";
import {existsSync,readdirSync} from "fs";
import {cp, mkdir, readFile, readdir, stat, writeFile} from "node:fs/promises";


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
// 1. Central Constants
const API_SRC_DIR = 'exportmodules'; // Source folder containing .ts / .js API entry modules
const API_OUT_DIR = 'modules';     // Output folder in dist/ and public URL prefix (/api/...)

// Auto-discover all .ts / .js entry modules in API_SRC_DIR
const apiSrcAbsDir = resolve(__dirname, API_SRC_DIR);
const apiEntries = existsSync(apiSrcAbsDir)
    ? Object.fromEntries(
        readdirSync(apiSrcAbsDir)
            .filter((file) => /\.(ts|js)$/.test(file) && !file.endsWith('.d.ts'))
            .map((file) => [parse(file).name, resolve(apiSrcAbsDir, file)])
    )
    : {};

const apiEntryPaths = new Set(
    Object.values(apiEntries).map((p) => normalizePath(p))
);

const handleApiPlugin=(command)=>({
    name: 'user-api-entries',
    enforce: 'post',

    // Inject Import Map in BOTH dev and production:
    // - Dev:  '/api/<name>.js' -> './src/api/<name>.ts' (Vite compiles TS on the fly)
    // - Prod: '/api/'          -> './api/' (resolves relative to /viewer/ or /viewer/abc/)
    transformIndexHtml() {
        const rawImports =
            command === 'serve'
                ? Object.fromEntries(
                    Object.entries(apiEntries).map(([name, absPath]) => [
                        `/${API_OUT_DIR}/${name}.js`,
                        `./${normalizePath(relative(__dirname, absPath))}`,
                    ])
                )
                : {
                    [`/${API_OUT_DIR}/`]: `./${API_OUT_DIR}/`,
                };

        return [
            {
                tag: 'script',
                children: `
              const imports = Object.fromEntries(
                Object.entries(${JSON.stringify(rawImports)}).map(([k, v]) => [k, new URL(v, document.baseURI).href])
              );
              const el = document.createElement('script');
              el.type = 'importmap';
              el.textContent = JSON.stringify({ imports });
              document.currentScript.after(el);
            `,
                injectTo: 'head-prepend',
            },
        ];
    },

    // PROD BUILD: Disable tree-shaking on API entry points while keeping it active for `main`
    transform(code, id) {
        if (apiEntryPaths.has(normalizePath(id))) {
            return { code, moduleSideEffects: 'no-treeshake' };
        }
    },

    moduleParsed(moduleInfo) {
        if (apiEntryPaths.has(normalizePath(moduleInfo.id))) {
            moduleInfo.moduleSideEffects = 'no-treeshake';
        }
    },

    async resolveId(source, importer, options) {
        if (importer && apiEntryPaths.has(normalizePath(importer))) {
            const resolved = await this.resolve(source, importer, {
                ...options,
                skipSelf: true,
            });
            if (resolved && !resolved.external) {
                return { ...resolved, moduleSideEffects: 'no-treeshake' };
            }
        }
        return null;
    },
})

const jsxInJsPlugin = {
    name: "jsx-in-js",
    enforce: "pre",
    async transform(code, id) {
        if (!id.endsWith(".js")) return null;
        if (id.includes("/node_modules/")) return null;
        return transformWithOxc(code, id, {
            lang: 'jsx',
            runtime: 'automatic'
        });
    }
};

const replaceSuffix = (content, suffix) => content
    .replace(/SUFFIX=1/g, `SUFFIX='${suffix}'`)
    .replace(/_SFX=1/g, `_SFX=${suffix}`);

const copyIfExists = async (src, dst) => {
    if (!existsSync(src)) return;
    await mkdir(path.dirname(dst), {recursive: true});
    await cp(src, dst, {recursive: true});
};

const copyByRegex = async (srcDir, dstDir, regex) => {
    if (!existsSync(srcDir)) return;
    await mkdir(dstDir, {recursive: true});
    const entries = await readdir(srcDir);
    for (const entry of entries) {
        if (!regex.test(entry)) continue;
        await cp(path.join(srcDir, entry), path.join(dstDir, entry), {recursive: true});
    }
};

const transformStaticFiles = async (srcDir, dstDir, suffix) => {
    if (!existsSync(srcDir)) return;
    const entries = await readdir(srcDir, {withFileTypes: true});
    for (const entry of entries) {
        const src = path.join(srcDir, entry.name);
        const dst = path.join(dstDir, entry.name);
        if (entry.isDirectory()) {
            await mkdir(dst, {recursive: true});
            await transformStaticFiles(src, dst, suffix);
            continue;
        }
        if (entry.name === "avnav_viewer.html") continue;
        const info = await stat(src);
        if (!info.isFile()) continue;
        const content = await readFile(src, "utf-8");
        await mkdir(path.dirname(dst), {recursive: true});
        await writeFile(dst, replaceSuffix(content, suffix));
    }
};

const buildParityPlugin = (isProduction, avnavVersion) => ({
    name: "avnav-build-parity",
    apply: "build",
    async closeBundle() {
        const outDir = path.resolve(__dirname, isProduction ? "build/release-vite" : "build/debug-vite");
        const staticDir = path.resolve(__dirname, "static");

        await transformStaticFiles(staticDir, outDir, avnavVersion);
        await copyIfExists(path.resolve(__dirname, "layout"), path.join(outDir, "layout"));
        await copyIfExists(path.resolve(__dirname, "settings"), path.join(outDir, "settings"));
        await copyIfExists(path.resolve(__dirname, "../sounds/1-minute-of-silence.mp3"), path.join(outDir, "sounds/1-minute-of-silence.mp3"));
        await copyByRegex(path.resolve(__dirname, "demo"), path.join(outDir, "demo"), /\.xml$/i);
        await copyByRegex(path.resolve(__dirname, "images"), path.join(outDir, "images"), /^ais-default.*\.png$/i);
        await copyByRegex(path.resolve(__dirname, "images"), path.join(outDir, "images"), /^ais-aton.*\.png$/i);
        await copyByRegex(path.resolve(__dirname, "images"), path.join(outDir, "images"), /^rpi.*$/i);
        await copyIfExists(path.resolve(__dirname, "images/WebIcon-512.png"), path.join(outDir, "images/WebIcon-512.png"));
        await copyIfExists(path.resolve(__dirname, "images/SailBoatRed96.png"), path.join(outDir, "images/SailBoatRed96.png"));
        await copyIfExists(path.resolve(__dirname, "images/signalk.svg"), path.join(outDir, "images/signalk.svg"));
        if (!isProduction) {
            await copyIfExists(path.resolve(__dirname, "test/static"), path.join(outDir, "test"));
        }

        const license = await generateLicense();
        await writeFile(path.join(outDir, "license.html"), license);

    }
});

export default defineConfig(({command, mode}) => {
    const env = loadEnv(mode, process.cwd(), "");
    const avnavVersion = createVersion(mode);
    const outDir = mode === "production" ? "build/release-vite" : "build/debug-vite";
    const devRoot = "/viewer/";
    const devApiTarget = env.VITE_API_TARGET || "http://localhost:8080";
    const devHost = env.VITE_DEV_HOST || "0.0.0.0";
    const devPort = Number.parseInt(env.VITE_DEV_PORT || "5173", 10);
    const isProduction = mode === "production";


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
            handleApiPlugin(command),
            buildParityPlugin(isProduction, avnavVersion),
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
                    main: path.resolve(__dirname, "avnav_viewer.html"),
                    ...apiEntries
                },
                preserveEntrySignatures: 'allow-extension',
                output: {
                    entryFileNames: (chunkInfo) =>
                        chunkInfo.name in apiEntries
                            ? `${API_OUT_DIR}/[name].js`
                            : 'assets/[name]-[hash].js',

                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash][extname]',
                },
            }
        }
    };
});
