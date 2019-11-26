var path = require('path');
var webpack = require('webpack');
var CopyWebpackPlugin= require('copy-webpack-plugin');
var ExtractTextPlugin = require("extract-text-webpack-plugin");
var generateLicense=require('./collectLicense');
var GenerateAssetsPlugin=require('generate-asset-webpack-plugin');

var cssLoaderQuery="&localIdentName=[path][name]---[local]---[hash:base64:5]";
var outDir="build/debug";
var isProduction=(process.env.NODE_ENV === 'production') || (process.argv.indexOf('-p') !== -1);
if (isProduction) {
    cssLoaderQuery="";
    outDir="build/release";
}

var copyList=[
    {from: './avnav_viewer.html'},
    {from: './info.html'},
    {from: './manifest.json'},
    {from: './privacy-en.html'},
    {from: './privacy-de.html'},
    {from: './webpack-loader.js',to:'loader.js'},
    {from: './util/polyfill.js',to:'polyfill.js'},
    {from: './images/icons-new/*svg'},
    {from: './images/icons-new/ic_*png'},
    {from: '../libraries/movable-type/geo.js', to: 'libraries'},
    {from: '../libraries/movable-type/latlon.js',to: 'libraries'},
    {from: '../sounds/1-minute-of-silence.mp3',to: 'sounds'},
    {from: './layout',to:'layout'}
    ];
var images=[
    'Chart60.png',
    'GreyBubble40.png',
    'GreenBubble40.png',
    'YellowBubble40.png',
    'RedBubble40.png',
    'Boat1.png',
    'Marker2.png',
    'MarkerOrange.png',
    'Boat2.png',
    'nadel_mit.png',
    'WebIcon-512.png'

];
images.forEach(function(el){
   copyList.push({from: "./images/"+el,to:'images'});
});

if (isProduction) {
    copyList.push({from: 'node_modules/openlayers/dist/ol.js', to:'libraries/ol.js'})
}
else{
    copyList.push({from: 'node_modules/openlayers/dist/ol-debug.js', to: 'libraries/ol.js'})
}

var devtool="inline-source-map";
var resolveAlias={

};
if (isProduction) {
    devtool="";
}
if (! isProduction) {
    resolveAlias['openlayers$']=__dirname+"/node_modules/openlayers/dist/ol-debug.js";
}

var plugins = [
    new CopyWebpackPlugin(copyList),
    new ExtractTextPlugin("avnav_viewer.css", {allChunks: true}),
    new GenerateAssetsPlugin({
        filename: 'license.html',
        fn: function (compilation, cb) {
            generateLicense(function(data){cb(null,data)});
        }
    })
];
if (process.env.AVNAV_VERSION_FILE){
    plugins.push(new webpack.NormalModuleReplacementPlugin(/version\.js/,process.env.AVNAV_VERSION_FILE));
    console.log("using version "+process.env.AVNAV_VERSION_FILE);
}
//console.log(process.env);

module.exports = {
    //see http://humaan.com/getting-started-with-webpack-and-react-es6-style/
    entry: getEntrySources([
        '@babel/polyfill',
        './webpack-main.js',
        './avnav_viewer.less',
        './avnav_viewer_new.less'
    ]),
    //entry: './app/main.jsx',
    publicPath: 'http://localhost:8081/viewer',
    output: { path: __dirname+"/"+outDir, filename: 'avnav_min.js' },
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
                exclude: /avnav_viewer.*\.less/,
                loader: ExtractTextPlugin.extract("style-loader","css-loader?-url&modules&"+cssLoaderQuery+"!less-loader")

            },
            {
                test: /(\.scss)$/,
                exclude: /commons\.scss$/,
                loader: ExtractTextPlugin.extract('style-loader','css-loader?modules&'+cssLoaderQuery+'!sass')
            },
            {
                test: /commons\.scss$/,
                loader: ExtractTextPlugin.extract('style-loader','css-loader!sass-loader')
            },

            {
                test: /avnav_viewer.*\.less$/,
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
    mode: isProduction?'production':'development'
};

function getEntrySources(sources) {
    if (isProduction) {
        //sources.push('webpack-dev-server/client?http://localhost:8082');
    }

    return sources;
};
