var webpack = require("webpack");
var common = require("./webpack.config.common");
var CopyWebpackPlugin = require('copy-webpack-plugin');

console.log("Bundling for production...");

module.exports = {
  entry: common.config.entry,
  output: {
		library: "MyLibrary",
    libraryTarget: "umd",
    filename: 'wrattler-[name].js',
    path: common.config.buildDir,
  },
  node: {
    fs: 'empty'
  },
  module: {
    rules: common.getModuleRules()
  },
  plugins: common.getPlugins().concat([
    new CopyWebpackPlugin([ { from: common.config.publicDir } ])
  ]),
  resolve: {
    modules: [common.config.nodeModulesDir],
    extensions: [".ts", ".tsx", ".js", ".fs"]
  },
};
