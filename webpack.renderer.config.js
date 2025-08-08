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
};
