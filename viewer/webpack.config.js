var path = require('path');
var webpack = require('webpack');
var CopyWebpackPlugin= require('copy-webpack-plugin');
var ExtractTextPlugin = require("extract-text-webpack-plugin");

var cssLoaderQuery="&localIdentName=[path][name]---[local]---[hash:base64:5]";
var outDir="build/debug";
if (process.env.NODE_ENV === 'production') {
    cssLoaderQuery="";
    outDir="build/release";
}

var copyList=[
    {from: './avnav_viewer.html'},
    {from: './webpack-loader.js',to:'loader.js'},
    {from: './images/icons-new/*svg'},
    {from: '../libraries/jquery/jquery-1.11.0.min.js',to:'libraries'},
    {from: '../libraries/movable-type/geo.js', to: 'libraries'},
    {from: '../libraries/movable-type/latlon.js',to: 'libraries'},
    {from: '../libraries/rangeslider/rangeslider.css', to:'libraries'},
    {from: '../libraries/rangeslider/rangeslider.js', to: 'libraries'},
    {from: '../libraries/jscolor/jscolor.js', to: 'libraries'}
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

];
images.forEach(function(el){
   copyList.push({from: "./images/"+el,to:'images'});
});
if (process.env.NODE_ENV === 'production') {
    copyList.push({from: '../libraries/ol311/ol.js', to:'libraries/ol.js'})
}
else{
    copyList.push({from: '../libraries/ol311/ol-debug.js', to: 'libraries/ol.js'})
}
var devtool="eval";
if (process.env.NODE_ENV === 'production') {
    devtool="";
}
module.exports = {
    //see http://humaan.com/getting-started-with-webpack-and-react-es6-style/
    entry: getEntrySources([
        './webpack-main.js',
        './avnav_viewer.less'
    ]),
    //entry: './app/main.jsx',
    publicPath: 'http://localhost:8081/viewer',
    output: { path: __dirname+"/"+outDir, filename: 'avnav_min.js' },
    resolve: {
        extensions: ['', '.jsx', '.scss', '.js', '.json']
    },
    module: {
        loaders: [
            /*
            {
                test: /.jsx$|.js$/,
                exclude: /node_modules/,
                loader: 'babel-loader',
                query: {
                    presets: ['react', 'es2015']
                }

            },
            */
            {
                test: /\.css$/,
                loader: ExtractTextPlugin.extract("style-loader","css-loader")
            },
            {
                test: /\.less$/,
                exclude: /avnav_viewer\.less/,
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
    plugins:[

        new CopyWebpackPlugin(copyList),
        new ExtractTextPlugin("avnav_viewer.css",{ allChunks: true })
    ],
    devtool:devtool
};

function getEntrySources(sources) {
    if (process.env.NODE_ENV !== 'production') {
        //sources.push('webpack-dev-server/client?http://localhost:8082');
    }

    return sources;
};
