const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const config = require("./package.json");


module.exports = {
  entry: path.resolve(__dirname, config.main),
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  resolve: {
    modules: [path.resolve('./dist'), 'node_modules'],
    fallback: {
      "fs": false,
      "path": require.resolve("path-browserify"),
    }
  },
  mode: 'development',
  devServer: {
    static: {
      directory: path.join(__dirname, './'),
    },
    compress: true,
    port: 9000,
    hot: true,
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './index.html',
    }),
    new CopyPlugin({
        patterns: [
            { from: 'output-test10089.json', to: 'output-test10089.json' }
        ]
    })

  ],
};