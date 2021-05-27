var path = require('path');
var webpack = require('webpack');
var CopyWebpackPlugin= require('copy-webpack-plugin');
var MiniCssExtractPlugin=require('mini-css-extract-plugin');
var generateLicense=require('./collectLicense');
var GenerateAssetsPlugin=require('generate-asset-webpack-plugin');

var outDir="build/debug";
var isProduction=(process.env.NODE_ENV === 'production') || (process.argv.indexOf('-p') !== -1);
if (isProduction) {
    outDir="build/release";
}

var formatDate = function (date) {
    var yyyy = date.getFullYear();
    var mm = date.getMonth() < 9 ? "0" + (date.getMonth() + 1) : (date.getMonth() + 1); // getMonth() is zero-based
    var dd = date.getDate() < 10 ? "0" + date.getDate() : date.getDate();
    var yyyymmdd= "".concat(yyyy).concat(mm).concat(dd);
    var hh = date.getHours() < 10 ? "0" + date.getHours() : date.getHours();
    var min = date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes();
    return "".concat(yyyymmdd).concat("-").concat(hh).concat(min);

};
var avnavVersion=process.env.AVNAV_VERSION?process.env.AVNAV_VERSION:(isProduction?"":"dev-")+(formatDate(new Date()));
console.log("VERSION="+avnavVersion);

var replaceSuffix=function(content,path){
    //console.log("suffix replace "+path);
    return content.toString()
        .replace(/SUFFIX=1/,"SUFFIX='"+avnavVersion+"'")
        .replace(/_SFX=1/,"_SFX="+avnavVersion);
}
var copyList=[
    {from: './static/',transform: replaceSuffix},
    {from: './webpack-loader.js',to:'loader.js',transform:replaceSuffix},
    {from: './util/polyfill.js',to:'polyfill.js'},
    {from: '../libraries/movable-type/geo.js', to: 'libraries'},
    {from: '../libraries/movable-type/latlon.js',to: 'libraries'},
    {from: '../sounds/1-minute-of-silence.mp3',to: 'sounds'},
    {from: './layout',to:'layout'},
    {context: './demo',from: '*.xml',to:'demo/'}
    ];
var images=[
    'WebIcon-512.png'

];
images.forEach(function(el){
   copyList.push({from: "./images/"+el,to:'images'});
});
if (!isProduction) {
    copyList.push({
        from: 'test/static',
        to: 'test'
    })
}

var devtool="inline-source-map";
var resolveAlias={

};
resolveAlias['React$']=__dirname+"/node_modules/react/index.js";
if (isProduction) {
    devtool="";
}

var plugins = [
    new CopyWebpackPlugin(copyList),
    new MiniCssExtractPlugin({
        filename: "avnav_viewer.css",
        allChunks: true}),
    new GenerateAssetsPlugin({
        filename: 'license.html',
        fn: function (compilation, cb) {
            generateLicense(function(data){cb(null,data)});
        }
    })
];

//console.log(process.env);

module.exports = {
    //see http://humaan.com/getting-started-with-webpack-and-react-es6-style/
    entry: getEntrySources([
        '@babel/polyfill',
        './webpack-main.js',
        './style/avnav_viewer_new.less'
    ]),
    //entry: './app/main.jsx',
    //publicPath: 'http://localhost:8081/viewer',
    output: { path: __dirname+"/"+outDir, filename: 'avnav_min.js' },
    resolve: {
        extensions: ['.jsx', '.scss', '.js', '.json'],
        alias: resolveAlias
    },
    module: {
        rules: [
            {
                test: /version\.js$/,
                loader: 'val-loader',
                options:{
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
                            { targets: {
                                browsers: "> 0.25%, not dead, safari 9, safari 10, safari 11"
                                }
                            }
                            ]],
                        plugins: [
                            ["prismjs", {
                                "languages": ["javascript", "css", "markup","json"],
                                "plugins": ["line-numbers"],
                                "theme": "default",
                                "css": false
                            }]
                        ]
                    }
                }

            },

            {
                test: /\.css$/,
                use:[
                    {
                        loader: MiniCssExtractPlugin.loader
                    },
                    'css-loader'
                ]
            },


            {
                test: /avnav_viewer.*\.less$/,
                use:[
                    {
                        loader: MiniCssExtractPlugin.loader
                    },
                    {
                        loader: 'css-loader',
                        options:{
                            url:true
                        }
                    },
                    {
                        loader: 'less-loader'
                    }
                    ]
            },

            {
                test: /images[\\\/].*\.png$|images[\\\/].*\.svg$/,
                loader: 'file-loader',
                options:{
                    name: "images/[name].[ext]"
                }
            }


        ]
    },
    plugins:plugins,
    devtool:devtool,
    mode: isProduction?'production':'development'
};

function getEntrySources(sources) {
    if (isProduction) {
        //sources.push('webpack-dev-server/client?http://localhost:8082');
    }

    return sources;
};
