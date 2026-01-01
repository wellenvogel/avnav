const webpack = require('webpack')
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    target: ['web','browserslist'],
    context: __dirname,
    entry: "./index",
    output: {
        path: __dirname + "/../../build/debug",
        filename: "oltest.js"
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules\/maplibre-gl/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [["@babel/preset-env",
                            {
                                useBuiltIns: false,
                                //debug: true
                            },
                        ]]
                    }
                }
            },
            {
                test: /\.css$/i,
                use: ["style-loader", "css-loader"],
            },
        ]
    },
    mode:"development",
    devtool: "source-map",
    plugins: [
        new CopyWebpackPlugin({
            patterns:[
                { from: "oltest.html"},
            ]
        })
    ]
}