const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

module.exports = {
	entry: './formatter/index.js',
	output: {
		path: path.resolve(__dirname, './backend/static/js/formatter/'),
		filename: 'index.js',
	},
	mode: 'development',
	experiments: {
		asyncWebAssembly: true
	}
};
