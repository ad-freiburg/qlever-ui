const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

module.exports = {
	entry: './formatter/index.js',
	output: {
		path: path.resolve(__dirname, './backend/static/js/formatter/'),
		filename: 'index.js',
		globalObject: 'this',
		library: {
			name: 'formatter',
			type: 'umd',

		}
	},
	mode: 'development',
	experiments: {
		asyncWebAssembly: true
	}
};
