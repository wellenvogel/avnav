const path = require('path');
const base = require('../webpack.config');
const HtmlWebpackPlugin = require('html-webpack-plugin');
module.exports = (env, argv) => {
    const config = base(env, {...argv, mode: 'development'});
    config.entry = './test/chart-proxy.js';
    config.output = {path: path.resolve(__dirname, '../build/chart-proxy'), filename: 'test.js'};
    config.optimization = {minimize: false};
    config.plugins = config.plugins.filter(p => p.constructor.name === 'MiniCssExtractPlugin');
    config.plugins.push(new HtmlWebpackPlugin({templateContent: '<!doctype html><title>Chart proxy regression</title>'}));
    return config;
};
