const path = require('path');

module.exports = {
	entry: path.resolve(__dirname, './formatter/index.js'),
	output: {
		path: path.resolve(__dirname, './backend/static/js/formatter/'),
		filename: 'index.js',
		globalObject: 'this',
		library: {
			name: 'formatter',
			type: 'umd',

		}
	},
	mode: 'production',
	experiments: {
		asyncWebAssembly: true
	}
};
