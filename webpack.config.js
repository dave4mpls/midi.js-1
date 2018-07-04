const webpack = require('webpack')
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')
const path = require('path')
const isBuild = !!process.env.BUILD || false

const libraryName = 'midi'

const plugins = []
let outputFile

if (isBuild) {
  plugins.push(new UglifyJsPlugin())
  outputFile = libraryName + '.min.js'
} else {
  outputFile = libraryName + '.js'
}

const config = {
  entry: {
    main: [__dirname + '/src/index.js']
  },
  devtool: 'source-map',
  output: {
    path: __dirname + '/lib',
    filename: outputFile,
    library: libraryName.toUpperCase(),
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  module: {
    rules: [
      {
        test: /(\.js)$/,
        use: ['babel-loader'],
        exclude: /(node_modules|bower_components)/
      }
    ]
  },
  resolve: {
    extensions: ['*', '.js']
  },
  plugins: plugins
}

module.exports = config
