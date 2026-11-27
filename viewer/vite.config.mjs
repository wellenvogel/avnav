import path from "node:path";
import {fileURLToPath} from "node:url";
import {defineConfig, loadEnv, normalizePath, transformWithOxc} from "vite";
import react from "@vitejs/plugin-react";
import generateLicense from "./collectLicense.mjs";
import {resolve,parse} from "path";
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

    // Inject import map in both dev and production:
    // - Dev:  '/modules/' -> './exportmodules/'
    // - Prod: '/modules/' -> './modules/'
    transformIndexHtml() {
        const rawImports = {
            [`/${API_OUT_DIR}/`]: command === "serve" ? "./exportmodules/" : `./${API_OUT_DIR}/`
        };

        return [
            {
                tag: "script",
                attrs: {type: "importmap"},
                children: JSON.stringify({imports: rawImports}),
                injectTo: "head-prepend",
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

const copyEntries = async (src, dst, options = {}) => {
    if (!existsSync(src)) return;
    const srcInfo = await stat(src);
    if (!srcInfo.isDirectory()) {
        await mkdir(path.dirname(dst), {recursive: true});
        await cp(src, dst, {recursive: true});
        return;
    }
    await mkdir(dst, {recursive: true});
    const entries = await readdir(src);
    for (const entry of entries) {
        if (options.match && !options.match(entry)) continue;
        await cp(path.join(src, entry), path.join(dst, entry), {recursive: true});
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

const buildParityPlugin = (outDir, isProduction, avnavVersion) => ({
    name: "avnav-build-parity",
    apply: "build",
    async closeBundle() {
        const staticDir = path.resolve(__dirname, "static");

        await transformStaticFiles(staticDir, outDir, avnavVersion);
        await copyEntries(path.resolve(__dirname, "layout"), path.join(outDir, "layout"));
        await copyEntries(path.resolve(__dirname, "settings"), path.join(outDir, "settings"));
        await copyEntries(path.resolve(__dirname, "../sounds/1-minute-of-silence.mp3"), path.join(outDir, "sounds/1-minute-of-silence.mp3"));
        await copyEntries(path.resolve(__dirname, "demo"), path.join(outDir, "demo"), {match: (entry) => /\.xml$/i.test(entry)});
        await copyEntries(path.resolve(__dirname, "images"), path.join(outDir, "images"), {match: (entry) => /\.(png|svg)$/i.test(entry)});
        await copyEntries(path.resolve(__dirname, "images/icons-new/default"), path.join(outDir, "images/default"), {match: (entry) => /\.(png|svg)$/i.test(entry)});
        await copyEntries(path.resolve(__dirname, "images/icons-new/legacy"), path.join(outDir, "images/legacy"), {match: (entry) => /\.(png|svg)$/i.test(entry)});
        if (!isProduction) {
            await copyEntries(path.resolve(__dirname, "test/static"), path.join(outDir, "test"));
        }

        const license = await generateLicense();
        await writeFile(path.join(outDir, "license.html"), license);

    }
});

export default defineConfig(({command, mode}) => {
    const env = loadEnv(mode, process.cwd(), "");
    const avnavVersion = createVersion(mode);
    const isProduction = mode === "production";
    const isUnminified = mode === "development-unminified";
    const outDir = isProduction ? "build/release-vite" : (isUnminified ? "build/debug-vite-unminified" : "build/debug-vite");
    const devRoot = "/viewer/";
    const devApiTarget = env.VITE_API_TARGET || "http://localhost:8080";
    const devHost = env.VITE_DEV_HOST || "0.0.0.0";
    const devPort = Number.parseInt(env.VITE_DEV_PORT || "5173", 10);
    const outDirAbs = path.resolve(__dirname, outDir);


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
            buildParityPlugin(outDirAbs, isProduction, avnavVersion),
            styleModulesPlugin,
            jsxInJsPlugin,
            react({
            include: /\.(js|jsx|ts|tsx)$/
        })],
        publicDir: command === "serve" ? false : "static",
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
            minify: isUnminified ? false : undefined,
            cssMinify: isUnminified ? false : undefined,
            assetsInlineLimit: 0,
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
                assetFileNames: (assetInfo) => {
                    const sources = [
                        ...(assetInfo.originalFileNames || []),
                        ...(assetInfo.names || []),
                        assetInfo.name || ""
                    ].map((entry) => entry.replaceAll("\\", "/"));
                    if (sources.some((entry) => /(^|\/)images\/icons-new\/default\/[^/]+\.(png|svg)$/i.test(entry))) return "images/default/[name][extname]";
                    if (sources.some((entry) => /(^|\/)images\/icons-new\/legacy\/[^/]+\.(png|svg)$/i.test(entry))) return "images/legacy/[name][extname]";
                    if (sources.some((entry) => /(^|\/)images\/[^/]+\.(png|svg)$/i.test(entry))) return "images/[name][extname]";
                    return "assets/[name]-[hash][extname]";
                },
                },
            }
        }
    };
});
