const path = require('path');
const base = require('../webpack.config');
const HtmlWebpackPlugin = require('html-webpack-plugin');
module.exports = (env, argv) => {
    const config = base(env, {...argv, mode: 'development'});
    config.entry = './test/leg-eta.js';
    config.output = {path: path.resolve(__dirname, '../build/leg-eta'), filename: 'test.js'};
    config.optimization = {minimize: false};
    config.plugins = config.plugins.filter(p => p.constructor.name === 'MiniCssExtractPlugin');
    config.plugins.push(new HtmlWebpackPlugin({templateContent: '<!doctype html><html><head><meta charset="utf-8"><title>Waypoint ETA regression</title></head><body></body></html>'}));
    return config;
};
