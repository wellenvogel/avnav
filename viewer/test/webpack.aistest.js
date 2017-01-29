var path = require('path');
var webpack = require('webpack');
var CopyWebpackPlugin= require('copy-webpack-plugin');
var ExtractTextPlugin = require("extract-text-webpack-plugin");

var cssLoaderQuery="&localIdentName=[path][name]---[local]---[hash:base64:5]";
var outDir="../build/test";

var copyList=[
    {from: './test/aistest.html'},
    {from: '../libraries/jquery/jquery-1.11.0.min.js',to:'libraries'},
    {from: '../libraries/movable-type/geo.js', to: 'libraries'},
    {from: '../libraries/movable-type/latlon.js',to: 'libraries'}
    ];
var images=[
];
images.forEach(function(el){
   copyList.push({from: "./images/"+el,to:'images'});
});

var devtool="inline-source-map";
var resolveAlias={

};
if (process.env.NODE_ENV === 'production') {
    devtool="";
    resolveAlias['react$']=__dirname+"/node_modules/react/dist/react.min.js";
    resolveAlias['react-dom$']=__dirname+"/node_modules/react-dom/dist/react-dom.min.js";
}

var plugins=[
            new CopyWebpackPlugin(copyList),
            new ExtractTextPlugin("aistest.css",{ allChunks: true }),
            ];
module.exports = {
    //see http://humaan.com/getting-started-with-webpack-and-react-es6-style/
    entry: getEntrySources([
        './test/aistest.jsx',
        './test/aistest.less'
    ]),
    output: { path: __dirname+"/"+outDir, filename: 'aistest.js' },
    resolve: {
        extensions: ['', '.jsx', '.scss', '.js', '.json'],
        alias: resolveAlias
    },
    module: {
        loaders: [

            {
                test: /.jsx$|.js$/,
                exclude: /node_modules/,
                loader: 'babel-loader',
                query: {
                    presets: ['react', 'es2015','stage-0']
                }

            },

            {
                test: /\.css$/,
                loader: ExtractTextPlugin.extract("style-loader","css-loader")
            },
            {
                test: /\.less$/,
                exclude: /avnav_viewer\.less/,
                loader: ExtractTextPlugin.extract("style-loader","css-loader!less-loader")

            },
            {
                test: /(\.scss)$/,
                exclude: /commons\.scss$/,
                loader: ExtractTextPlugin.extract('style-loader','css-loader!sass')
            },
            {
                test: /commons\.scss$/,
                loader: ExtractTextPlugin.extract('style-loader','css-loader!sass-loader')
            },

            {
                test: /avnav_viewer\.less$/,
                loader: ExtractTextPlugin.extract('style-loader','css-loader?-url!less-loader')
            },
            {
                test: /images[\\\/].*\.png$|images[\\\/].*\.svg$/,
                loader: 'file-loader',
                //we are not really able to tell the file loader to copy files correctly
                //so we let it copy them and afterwards copy them again by the copy plugin
                query:{
                    name: "images/[name].[ext]"
                }
            }


        ]
    },
    plugins:plugins,
    devtool:devtool,
};

function getEntrySources(sources) {
    if (process.env.NODE_ENV !== 'production') {
        //sources.push('webpack-dev-server/client?http://localhost:8082');
    }

    return sources;
};
