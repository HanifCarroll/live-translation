const rules = require('./webpack.rules');
const Dotenv = require('dotenv-webpack');

rules.push({
  test: /\.css$/,
  use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
});

module.exports = {
  // Put your normal webpack config below here
  module: {
    rules,
  },
  plugins: [
    new Dotenv({
      systemvars: true,
      silent: true,
    }),
  ],
  devServer: {
    headers: {
      'Content-Security-Policy': "default-src 'self' 'unsafe-inline' data:; connect-src 'self' wss://api.deepgram.com https://translation.googleapis.com; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
    },
  },
};
