const path = require('path');
const base = require('../webpack.config');
const HtmlWebpackPlugin = require('html-webpack-plugin');
module.exports = (env, argv) => {
    const config = base(env, {...argv, mode: 'development'});
    config.entry = './test/map-widget-coordinates.jsx';
    config.output = {path: path.resolve(__dirname, '../build/map-widget-coordinates'), filename: 'test.js'};
    config.optimization = {minimize: false};
    config.plugins = config.plugins.filter(p => p.constructor.name === 'MiniCssExtractPlugin');
    config.plugins.push(new HtmlWebpackPlugin({templateContent: '<!doctype html><meta charset="utf-8"><title>Map widget coordinate regression</title>'}));
    return config;
};
