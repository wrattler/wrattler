var webpack = require("webpack");
var common = require("./webpack.config.common");
var CopyWebpackPlugin = require('copy-webpack-plugin');

console.log("Bundling Wrattler for production...");

module.exports = {
  devtool: "source-map",
  entry: common.config.entry,
  output: {
		library: "MyLibrary",
    libraryTarget: "umd",
    filename: 'wrattler-[name].js',
    path: common.config.buildDir
  },
  optimization: {
    minimize: false
  },
  node: {
    fs: 'empty'
  },
  module: {
    rules: common.getModuleRules()
  },
  plugins:
    common.getPlugins().concat([new CopyWebpackPlugin([ { from: common.config.publicDir } ]),new webpack.optimize.LimitChunkCountPlugin({maxChunks: 1})])
    // new webpack.optimize.LimitChunkCountPlugin({maxChunks: 1})
  ,
  resolve: {
    modules: [common.config.nodeModulesDir],
    extensions: [".ts", ".tsx", ".js"]
  },
};
