const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const generateLicense = require('./collectLicense');
const GenerateFilePlugin = require('generate-file-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TerserPlugin = require("terser-webpack-plugin");

module.exports = (env, argv) => {
    var outDir = "build/debug";
    var isProduction = argv.mode === 'production';
    if (isProduction) {
        outDir = "build/release";
    }

    var formatDate = function (date) {
        var yyyy = date.getFullYear();
        var mm = date.getMonth() < 9 ? "0" + (date.getMonth() + 1) : (date.getMonth() + 1); // getMonth() is zero-based
        var dd = date.getDate() < 10 ? "0" + date.getDate() : date.getDate();
        var yyyymmdd = "".concat(yyyy).concat(mm).concat(dd);
        var hh = date.getHours() < 10 ? "0" + date.getHours() : date.getHours();
        var min = date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes();
        return "".concat(yyyymmdd).concat("-").concat(hh).concat(min);

    };
    var avnavVersion = process.env.AVNAV_VERSION ? process.env.AVNAV_VERSION : (isProduction ? "" : "dev-") + (formatDate(new Date()));
    console.log("VERSION=" + avnavVersion);
    console.log("isProduction=", isProduction);

    var replaceSuffix = function (content, path) {
        //console.log("suffix replace "+path,"content=",content.toString());
        return content.toString()
            .replace(/SUFFIX=1/, "SUFFIX='" + avnavVersion + "'")
            .replace(/_SFX=1/, "_SFX=" + avnavVersion);
    }
    var copyList = [
        {from: './static/', transform: replaceSuffix, globOptions: {ignore: ['**/avnav_viewer.html']}},
        {from: '../sounds/1-minute-of-silence.mp3', to: 'sounds'},
        {from: './layout', to: 'layout'},
        {from: './settings', to: 'settings'},
        {context: './demo', from: '*.xml', to: 'demo/'},
        {context: './images', from: 'ais-default*png', to: 'images/'},
        {context: './images', from: 'ais-aton*png', to: 'images/'}
    ];
    var images = [
        'WebIcon-512.png',
        'SailBoatRed96.png',
        'signalk.svg'

    ];
    images.forEach(function (el) {
        copyList.push({from: "./images/" + el, to: 'images'});
    });
    if (!isProduction) {
        copyList.push({
            from: 'test/static',
            to: 'test'
        })
    }

    var devtool = "inline-source-map";
    var resolveAlias = {};
    resolveAlias['React$'] = __dirname + "/node_modules/react/index.js";
    var cleanOutput=false;
    var minify=false;
    if (isProduction) {
        devtool = undefined;
        cleanOutput=true;
        minify=true;
        resolveAlias['debugSupport.js']=false;
    }
    else{
        resolveAlias['debugSupport.js']=__dirname+"/util/debugSupport.js"
    }

    var plugins = [
        new CopyWebpackPlugin({
            patterns: copyList
        }),
        new MiniCssExtractPlugin({
            filename: "avnav_viewer.css",
        }),
        new GenerateFilePlugin({
            file: 'license.html',
            content: generateLicense()
        }),
        new HtmlWebpackPlugin({
            template: 'static/avnav_viewer.html',
            filename: 'avnav_viewer.html',
            hash: true
        })
    ];

//console.log(process.env);

    var config = {
        target: ['web','browserslist'],  //this way use the same config as babel is using
                                         //find the browserslist in package.json
        entry: {

            main: {import: './webpack-main.js', filename: 'avnav_min.js'},
            style: {import: './style/avnav_viewer_new.less'}
        },
        optimization: {
            splitChunks: {
                chunks: "all"
            },
            minimize: minify,
            minimizer: [new TerserPlugin({
                exclude: /user.js/
            })]
        },
        output: {
            path: __dirname + "/" + outDir,
            clean: cleanOutput
        },
        resolve: {
            extensions: ['.jsx', '.scss', '.js', '.json','.tsx','.ts'],
            alias: resolveAlias
        },
        module: {
            rules: [
                {
                    test: path.join(__dirname,"version.js"),
                    loader: 'val-loader',
                    options: {
                        version: avnavVersion
                    }
                },

                {
                    test: /.jsx$|.js$/,
                    exclude: /version\.js$/,
                    use: {
                        loader: 'babel-loader',
                        options:
                            {
                                presets: ['@babel/preset-react', ["@babel/preset-env",
                                    {
                                        useBuiltIns: false,
                                        //debug: true
                                    },
                                ]],
                                plugins: [
                                    ["prismjs", {
                                        "languages": ["javascript", "css", "markup", "json"],
                                        "plugins": ["line-numbers"],
                                        "theme": "default",
                                        "css": false
                                    }]
                                ]
                            }
                    }

                },
                { test: /\.tsx?$|\.ts$/, loader: 'ts-loader' },

                {
                    test: /\.css$/,
                    use: [
                        {
                            loader: MiniCssExtractPlugin.loader
                        },
                        'css-loader'
                    ]
                },


                {
                    test: /avnav_viewer.*\.less$/,
                    use: [
                        {
                            loader: MiniCssExtractPlugin.loader
                        },
                        {
                            loader: 'css-loader',
                            options: {
                                url: true
                            }
                        },
                        {
                            loader: 'less-loader',
                            options: {
                                lessOptions: {javascriptEnabled: true}
                            }
                        }
                    ]
                },

                {
                    test: /images[\\\/].*\.png$|images[\\\/].*\.svg$/,
                    type: 'asset/resource',
                    generator: {
                        filename: 'images/[name][ext]'
                    }
                }


            ]
        },
        plugins: plugins,
        devtool: devtool,
        mode: isProduction ? 'production' : 'development'
    }
    return config;
};


