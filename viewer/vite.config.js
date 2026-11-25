const path = require("node:path");
const {defineConfig, transformWithEsbuild} = require("vite");
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

module.exports = defineConfig(({mode}) => {
    const avnavVersion = createVersion(mode);
    const outDir = mode === "production" ? "build/release-vite" : "build/debug-vite";

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

    return {
        plugins: [jsxInJsPlugin, react({
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
            preprocessorOptions: {
                less: {
                    javascriptEnabled: true
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
